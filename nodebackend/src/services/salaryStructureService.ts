import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../utils/http';
import { applyEffectiveLwfSetting, policySnapshot, resolveEffectiveLwfSetting, resolveLwfPolicy, scheduledMonths } from './lwfService';

const decimalInput = (label: string, max = '9999999999.99') => z.union([z.string(), z.number()]).transform((raw, context) => {
  try {
    const value = new Prisma.Decimal(raw);
    if (!value.isFinite() || value.isNegative() || value.greaterThan(max)) throw new Error();
    return value.toFixed(2);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a non-negative amount.` });
    return z.NEVER;
  }
});

const optionalDecimal = (label: string) => decimalInput(label).nullish().transform(value => value ?? null);
export const salaryComponentSchema = z.object({
  code: z.string().trim().min(2).max(80).regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Use letters, numbers and underscores.').transform(value => value.toUpperCase()),
  name: z.string().trim().min(2).max(150),
  category: z.enum(['earning', 'deduction', 'employer_contribution']),
  calculation_type: z.enum(['fixed', 'percentage']),
  fixed_amount: optionalDecimal('Fixed amount'),
  percentage: z.union([z.string(), z.number()]).nullish().transform((raw, context) => {
    if (raw == null || raw === '') return null;
    try {
      const value = new Prisma.Decimal(raw);
      if (!value.isFinite() || value.isNegative() || value.greaterThan(100)) throw new Error();
      return value.toFixed(4);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Percentage must be between 0 and 100.' });
      return z.NEVER;
    }
  }),
  percentage_basis: z.enum(['basic_salary', 'fixed_earnings', 'gross_salary']).nullish().transform(value => value ?? null),
  enabled: z.boolean().default(true),
  classification: z.enum(['optional', 'mandatory']).default('optional'),
  statutory_code: z.string().trim().min(2).max(50).nullish().transform(value => value ? value.toUpperCase() : null),
  applicability_min_gross: optionalDecimal('Minimum applicable gross'),
  applicability_max_gross: optionalDecimal('Maximum applicable gross'),
  monthly_cap: optionalDecimal('Monthly cap'),
  is_custom: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(1000).default(0),
}).superRefine((component, context) => {
  if (component.calculation_type === 'fixed' && component.fixed_amount == null) context.addIssue({ code: z.ZodIssueCode.custom, path: ['fixed_amount'], message: 'Enter a fixed amount.' });
  if (component.calculation_type === 'percentage' && (component.percentage == null || component.percentage_basis == null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['percentage'], message: 'Enter a percentage and calculation basis.' });
  if (component.category === 'earning' && component.calculation_type === 'percentage' && component.percentage_basis === 'gross_salary') context.addIssue({ code: z.ZodIssueCode.custom, path: ['percentage_basis'], message: 'An earning cannot be based on gross salary because that creates a circular calculation.' });
  if (component.applicability_min_gross && component.applicability_max_gross && new Prisma.Decimal(component.applicability_min_gross).greaterThan(component.applicability_max_gross)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['applicability_max_gross'], message: 'Maximum applicable gross must be at least the minimum.' });
});

export const salaryStructureInputSchema = z.object({ components: z.array(salaryComponentSchema).min(1).max(50) }).strict().superRefine((structure, context) => {
  const seen = new Set<string>();
  structure.components.forEach((component, index) => {
    if (seen.has(component.code)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['components', index, 'code'], message: `Duplicate component identifier: ${component.code}.` });
    seen.add(component.code);
  });
  if (!structure.components.some(component => component.enabled && component.category === 'earning')) context.addIssue({ code: z.ZodIssueCode.custom, path: ['components'], message: 'Enable at least one earning component.' });
});

export type SalaryStructureInput = z.infer<typeof salaryStructureInputSchema>;
export type SalaryPaymentFrequency = 'Monthly' | 'Daily';
type Rule = { code: string; category: string; percentage: Prisma.Decimal | null; percentageBasis: string | null; applicabilityMinGross: Prisma.Decimal | null; applicabilityMaxGross: Prisma.Decimal | null; monthlyCap: Prisma.Decimal | null; enabled: boolean };
const zero = () => new Prisma.Decimal(0);
const round = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const sum = (values: Prisma.Decimal[]) => round(values.reduce((total, value) => total.add(value), zero()));

export function normalizeSalaryPaymentFrequency(value: unknown): SalaryPaymentFrequency {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'monthly') return 'Monthly';
  if (normalized === 'daily') return 'Daily';
  throw new HttpError(422, 'Salary structures require a Monthly or Daily payment type.');
}

export function calculateSalaryStructure(raw: unknown, statutoryRules: Rule[] = [], paymentFrequency: SalaryPaymentFrequency = 'Monthly') {
  const input = salaryStructureInputSchema.parse(raw);
  const ruleMap = new Map(statutoryRules.map(rule => [rule.code.toUpperCase(), rule]));
  const configured = input.components.map(component => {
    const rule = component.statutory_code ? ruleMap.get(component.statutory_code) : undefined;
    return {
      ...component,
      enabled: component.enabled && (rule?.enabled ?? true),
      percentage: rule?.percentage?.toString() ?? component.percentage,
      percentage_basis: rule?.percentageBasis as typeof component.percentage_basis ?? component.percentage_basis,
      applicability_min_gross: rule?.applicabilityMinGross?.toString() ?? component.applicability_min_gross,
      applicability_max_gross: rule?.applicabilityMaxGross?.toString() ?? component.applicability_max_gross,
      monthly_cap: rule?.monthlyCap?.toString() ?? component.monthly_cap,
    };
  });
  const fixedEarnings = configured.filter(component => component.enabled && component.category === 'earning' && component.calculation_type === 'fixed');
  const basic = sum(fixedEarnings.filter(component => component.code === 'BASIC_SALARY').map(component => new Prisma.Decimal(component.fixed_amount ?? 0)));
  const fixedEarningsTotal = sum(fixedEarnings.map(component => new Prisma.Decimal(component.fixed_amount ?? 0)));
  const basis = (name: string | null, gross: Prisma.Decimal) => name === 'basic_salary' ? basic : name === 'fixed_earnings' ? fixedEarningsTotal : gross;
  const initialAmounts = configured.map(component => component.enabled && component.category === 'earning'
    ? component.calculation_type === 'fixed' ? round(new Prisma.Decimal(component.fixed_amount ?? 0)) : round(basis(component.percentage_basis, zero()).mul(component.percentage ?? 0).div(100))
    : zero());
  const gross = sum(initialAmounts);
  const components = configured.map((component, index) => {
    let amount = component.category === 'earning' ? initialAmounts[index] : component.calculation_type === 'fixed'
      ? round(new Prisma.Decimal(component.fixed_amount ?? 0))
      : round(basis(component.percentage_basis, gross).mul(component.percentage ?? 0).div(100));
    const min = component.applicability_min_gross ? new Prisma.Decimal(component.applicability_min_gross) : null;
    const max = component.applicability_max_gross ? new Prisma.Decimal(component.applicability_max_gross) : null;
    if (!component.enabled || (min && gross.lessThan(min)) || (max && gross.greaterThan(max))) amount = zero();
    const cap = component.monthly_cap ? new Prisma.Decimal(component.monthly_cap) : null;
    if (cap && amount.greaterThan(cap)) amount = cap;
    return { ...component, monthly_amount: round(amount).toFixed(2) };
  });
  const grossMonthly = sum(components.filter(component => component.category === 'earning').map(component => new Prisma.Decimal(component.monthly_amount)));
  const deductionsMonthly = sum(components.filter(component => component.category === 'deduction').map(component => new Prisma.Decimal(component.monthly_amount)));
  if (deductionsMonthly.greaterThan(grossMonthly)) throw new HttpError(422, 'Total deductions cannot exceed gross salary.');
  const employerContributions = sum(components.filter(component => component.category === 'employer_contribution').map(component => new Prisma.Decimal(component.monthly_amount)));
  const netMonthly = round(grossMonthly.sub(deductionsMonthly));
  const employerCostMonthly = round(grossMonthly.add(employerContributions));
  const annualCtc = paymentFrequency === 'Monthly' ? round(employerCostMonthly.mul(12)) : zero();
  if (grossMonthly.lessThanOrEqualTo(0)) throw new HttpError(422, `Gross ${paymentFrequency.toLowerCase()} pay must be greater than zero.`);
  return {
    components,
    payment_frequency: paymentFrequency,
    gross_per_period: grossMonthly.toFixed(2),
    deductions_per_period: deductionsMonthly.toFixed(2),
    net_per_period: netMonthly.toFixed(2),
    employer_contributions_per_period: employerContributions.toFixed(2),
    employer_cost_per_period: employerCostMonthly.toFixed(2),
    // Keep the established API/database names for compatibility. For Daily jobs these
    // columns contain one daily payment period and payment_frequency disambiguates them.
    gross_monthly: grossMonthly.toFixed(2),
    deductions_monthly: deductionsMonthly.toFixed(2),
    net_monthly: netMonthly.toFixed(2),
    employer_contributions_monthly: employerContributions.toFixed(2),
    employer_cost_monthly: employerCostMonthly.toFixed(2),
    annual_ctc: annualCtc.toFixed(2),
    calculation_version: 3,
  };
}

export const salaryStructureInclude = { salaryStructure: { include: { components: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] } } } };

export async function saveJobSalaryStructure(tx: Prisma.TransactionClient, jobId: string, employerUserId: string, actorUserId: string, raw: unknown, requestedPaymentType?: unknown) {
  const [rules, job] = await Promise.all([
    tx.salaryStatutoryRule.findMany({ where: { employerUserId } }),
    tx.jobPost.findUnique({ where: { id: jobId }, include: { site: { select: { state: true } }, company: { select: { state: true, businessType: true } } } }),
  ]);
  if (!job) throw new HttpError(404, 'Job not found while saving its salary structure.');
  const paymentFrequency = normalizeSalaryPaymentFrequency(requestedPaymentType ?? job.paymentType ?? 'Monthly');
  const withoutClientLwf = applyEffectiveLwfSetting(raw, null);
  const applicableRules = paymentFrequency === 'Monthly' ? rules : [];
  const base = calculateSalaryStructure(withoutClientLwf.input, applicableRules, paymentFrequency);
  const effectiveDate = job.startDate ?? new Date();
  const stateText = job.site?.state ?? job.company?.state ?? null;
  // LWF policies and their schedules are monthly. Never inject them into a daily
  // payment period; daily custom deductions still follow the job's Daily frequency.
  const stateResolution = paymentFrequency === 'Monthly' && stateText ? await resolveLwfPolicy(tx, {
    stateText,
    establishmentType: job.company?.businessType,
    effectiveDate,
    grossAmount: base.gross_monthly,
    employeeCategory: job.guardType ?? job.category,
  }) : null;
  const legacySetting = paymentFrequency === 'Monthly' && !stateResolution ? await resolveEffectiveLwfSetting(tx, employerUserId) : null;
  const policySetting = stateResolution?.status === 'applied' && stateResolution.policy ? {
    id: stateResolution.policy.id,
    source: 'state_policy' as const,
    employeeAmount: stateResolution.isTriggerPeriod ? stateResolution.policy.employeeAmount : new Prisma.Decimal(0),
    employerAmount: stateResolution.isTriggerPeriod ? stateResolution.policy.employerAmount : new Prisma.Decimal(0),
    status: 'active',
  } : null;
  const managedLwf = applyEffectiveLwfSetting(withoutClientLwf.input, policySetting ?? legacySetting);
  const calculated = calculateSalaryStructure(managedLwf.input, applicableRules, paymentFrequency);
  if (stateResolution?.status === 'applied' && stateResolution.policy) {
    const annualBase = new Prisma.Decimal(base.gross_monthly).add(base.employer_contributions_monthly).mul(12);
    const occurrences = scheduledMonths(stateResolution.policy.frequency, stateResolution.policy.scheduleMonths).length;
    calculated.annual_ctc = annualBase.add(stateResolution.policy.employerAmount.mul(occurrences)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
  }
  const snapshot = stateResolution?.policy ? policySnapshot(stateResolution.policy, stateResolution.state) : null;
  const result = {
    ...calculated,
    lwf_source: managedLwf.setting?.source ?? null,
    lwf_setting_id: managedLwf.setting?.source === 'state_policy' ? null : managedLwf.setting?.id ?? null,
    lwf_policy_version_id: stateResolution?.policy?.id ?? null,
    lwf_state_id: stateResolution?.state?.id ?? null,
    lwf_frequency: stateResolution?.policy?.frequency ?? null,
    lwf_contribution_schedule: stateResolution?.policy?.scheduleMonths ?? null,
    lwf_effective_date: stateResolution ? effectiveDate : null,
    lwf_resolution_status: stateResolution?.status ?? (legacySetting ? 'legacy_compatibility' : paymentFrequency === 'Daily' ? 'not_applicable' : 'not_configured'),
    lwf_resolution_reason: stateResolution?.reason ?? (legacySetting ? 'legacy_global_or_employer_setting' : paymentFrequency === 'Daily' ? 'daily_payment_frequency' : 'jurisdiction_state_unresolved'),
    lwf_policy_snapshot: snapshot ? JSON.stringify(snapshot) : null,
  };
  const structure = await tx.jobSalaryStructure.upsert({
    where: { jobId },
    create: { jobId, grossMonthly: result.gross_monthly, deductionsMonthly: result.deductions_monthly, netMonthly: result.net_monthly, employerContributionsMonthly: result.employer_contributions_monthly, employerCostMonthly: result.employer_cost_monthly, annualCtc: result.annual_ctc, calculationVersion: result.calculation_version, lwfSource: result.lwf_source, lwfSettingId: result.lwf_setting_id, lwfPolicyVersionId: result.lwf_policy_version_id, lwfStateId: result.lwf_state_id, lwfFrequency: result.lwf_frequency, lwfContributionSchedule: result.lwf_contribution_schedule, lwfEffectiveDate: result.lwf_effective_date, lwfResolutionStatus: result.lwf_resolution_status, lwfResolutionReason: result.lwf_resolution_reason, lwfPolicySnapshot: result.lwf_policy_snapshot },
    update: { grossMonthly: result.gross_monthly, deductionsMonthly: result.deductions_monthly, netMonthly: result.net_monthly, employerContributionsMonthly: result.employer_contributions_monthly, employerCostMonthly: result.employer_cost_monthly, annualCtc: result.annual_ctc, calculationVersion: result.calculation_version, lwfSource: result.lwf_source, lwfSettingId: result.lwf_setting_id, lwfPolicyVersionId: result.lwf_policy_version_id, lwfStateId: result.lwf_state_id, lwfFrequency: result.lwf_frequency, lwfContributionSchedule: result.lwf_contribution_schedule, lwfEffectiveDate: result.lwf_effective_date, lwfResolutionStatus: result.lwf_resolution_status, lwfResolutionReason: result.lwf_resolution_reason, lwfPolicySnapshot: result.lwf_policy_snapshot },
  });
  await tx.jobSalaryComponent.deleteMany({ where: { structureId: structure.id } });
  await tx.jobSalaryComponent.createMany({ data: result.components.map(component => ({ structureId: structure.id, code: component.code, name: component.name, category: component.category, calculationType: component.calculation_type, fixedAmount: component.fixed_amount, percentage: component.percentage, percentageBasis: component.percentage_basis, monthlyAmount: component.monthly_amount, enabled: component.enabled, classification: component.classification, statutoryCode: component.statutory_code, applicabilityMinGross: component.applicability_min_gross, applicabilityMaxGross: component.applicability_max_gross, monthlyCap: component.monthly_cap, isCustom: component.is_custom, sortOrder: component.sort_order })) });
  await tx.jobSalaryAuditEvent.create({ data: { jobId, actorUserId, action: 'salary_structure_saved', snapshot: JSON.stringify(result) } });
  return result;
}
