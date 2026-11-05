import { Prisma } from '@prisma/client';

export type EffectiveLwfSetting = {
  id: string;
  source: 'master' | 'employer' | 'state_policy';
  employeeAmount: Prisma.Decimal;
  employerAmount: Prisma.Decimal;
  status: string;
};

type LegacyLwfClient = Pick<Prisma.TransactionClient, 'lwfMasterSetting' | 'employerLwfSetting'>;
type StateLwfClient = Pick<Prisma.TransactionClient, 'lwfPolicyVersion' | 'stateMaster'>;

export type LwfResolutionStatus = 'applied' | 'not_applicable' | 'not_configured' | 'ambiguous';
export type LwfPolicyResolution = {
  status: LwfResolutionStatus;
  reason: string;
  state: { id: string; code: string; name: string } | null;
  policy: any | null;
  isTriggerPeriod: boolean;
  contributionPeriodKey: string | null;
  scheduleMonths: number[];
};

export type LwfResolutionContext = {
  stateId?: string | null;
  stateText?: string | null;
  establishmentType?: string | null;
  effectiveDate: Date;
  grossAmount?: Prisma.Decimal | string | number | null;
  employeeCategory?: string | null;
  exemptionCode?: string | null;
};

export async function resolveEffectiveLwfSetting(client: LegacyLwfClient, employerUserId: string): Promise<EffectiveLwfSetting | null> {
  const override = await client.employerLwfSetting.findUnique({ where: { employerUserId } });
  if (override) return { ...override, source: 'employer' };
  const master = await client.lwfMasterSetting.findUnique({ where: { scopeKey: 'STANDARD' } });
  return master ? { ...master, source: 'master' } : null;
}

export function parseJsonStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

export function parseScheduleMonths(value: string | null | undefined): number[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map(Number).filter(month => Number.isInteger(month) && month >= 1 && month <= 12))].sort((a, b) => a - b);
  } catch { return []; }
}

export function scheduledMonths(frequency: string, stored: string | null | undefined): number[] {
  return frequency === 'monthly' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : parseScheduleMonths(stored);
}

export function isLwfTriggerPeriod(frequency: string, stored: string | null | undefined, date: Date) {
  return scheduledMonths(frequency, stored).includes(date.getUTCMonth() + 1);
}

export function lwfContributionPeriodKey(policyId: string, date: Date) {
  return `${policyId}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function policySnapshot(policy: any, state?: { id: string; code: string; name: string } | null) {
  return {
    id: policy.id,
    version_number: policy.versionNumber,
    state: state ?? null,
    establishment_type: policy.establishmentType,
    employee_amount: policy.employeeAmount.toFixed(2),
    employer_amount: policy.employerAmount.toFixed(2),
    frequency: policy.frequency,
    schedule_months: scheduledMonths(policy.frequency, policy.scheduleMonths),
    effective_from: policy.effectiveFrom,
    effective_to: policy.effectiveTo,
    eligibility_min_gross: policy.eligibilityMinGross?.toFixed(2) ?? null,
    eligibility_max_gross: policy.eligibilityMaxGross?.toFixed(2) ?? null,
    eligible_employee_categories: parseJsonStringArray(policy.eligibleEmployeeCategories),
    exemption_codes: parseJsonStringArray(policy.exemptionCodes),
    legal_reference: policy.legalReference,
    status: policy.status,
  };
}

async function canonicalState(client: StateLwfClient, context: LwfResolutionContext) {
  if (context.stateId) return client.stateMaster.findFirst({ where: { id: context.stateId, status: 'active' }, select: { id: true, code: true, name: true } });
  const text = context.stateText?.trim().toLocaleLowerCase('en-IN');
  if (!text) return null;
  const states = await client.stateMaster.findMany({ where: { status: 'active' }, select: { id: true, code: true, name: true } });
  return states.find(state => state.code.trim().toLocaleLowerCase('en-IN') === text || state.name.trim().toLocaleLowerCase('en-IN') === text) ?? null;
}

export async function resolveLwfPolicy(client: StateLwfClient, context: LwfResolutionContext): Promise<LwfPolicyResolution> {
  const state = await canonicalState(client, context);
  if (!state) return { status: context.stateId || context.stateText ? 'ambiguous' : 'not_configured', reason: 'jurisdiction_state_unresolved', state: null, policy: null, isTriggerPeriod: false, contributionPeriodKey: null, scheduleMonths: [] };
  const at = new Date(Date.UTC(context.effectiveDate.getUTCFullYear(), context.effectiveDate.getUTCMonth(), context.effectiveDate.getUTCDate()));
  const candidates = await client.lwfPolicyVersion.findMany({
    where: { stateId: state.id, status: 'active', effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }] },
    orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
  });
  const establishment = context.establishmentType?.trim().toLocaleLowerCase('en-IN') || null;
  const scoped = candidates.filter(policy => !policy.establishmentType || (establishment && policy.establishmentType.trim().toLocaleLowerCase('en-IN') === establishment));
  if (!scoped.length) return { status: 'not_configured', reason: candidates.length ? 'establishment_not_covered' : 'no_effective_state_policy', state, policy: null, isTriggerPeriod: false, contributionPeriodKey: null, scheduleMonths: [] };
  const exact = establishment ? scoped.filter(policy => policy.establishmentType?.trim().toLocaleLowerCase('en-IN') === establishment) : [];
  const best = exact.length ? exact : scoped.filter(policy => !policy.establishmentType);
  if (best.length !== 1) return { status: 'ambiguous', reason: 'multiple_effective_policies', state, policy: null, isTriggerPeriod: false, contributionPeriodKey: null, scheduleMonths: [] };
  const policy = best[0];
  const gross = context.grossAmount == null ? null : new Prisma.Decimal(context.grossAmount);
  if (gross && policy.eligibilityMinGross && gross.lessThan(policy.eligibilityMinGross)) return { status: 'not_applicable', reason: 'gross_below_eligibility_minimum', state, policy, isTriggerPeriod: false, contributionPeriodKey: null, scheduleMonths: scheduledMonths(policy.frequency, policy.scheduleMonths) };
  if (gross && policy.eligibilityMaxGross && gross.greaterThan(policy.eligibilityMaxGross)) return { status: 'not_applicable', reason: 'gross_above_eligibility_maximum', state, policy, isTriggerPeriod: false, contributionPeriodKey: null, scheduleMonths: scheduledMonths(policy.frequency, policy.scheduleMonths) };
  const categories = parseJsonStringArray(policy.eligibleEmployeeCategories).map(value => value.toLocaleLowerCase('en-IN'));
  if (categories.length && (!context.employeeCategory || !categories.includes(context.employeeCategory.toLocaleLowerCase('en-IN')))) return { status: 'not_applicable', reason: 'employee_category_not_eligible', state, policy, isTriggerPeriod: false, contributionPeriodKey: null, scheduleMonths: scheduledMonths(policy.frequency, policy.scheduleMonths) };
  const exemptions = parseJsonStringArray(policy.exemptionCodes).map(value => value.toLocaleLowerCase('en-IN'));
  if (context.exemptionCode && exemptions.includes(context.exemptionCode.toLocaleLowerCase('en-IN'))) return { status: 'not_applicable', reason: 'configured_exemption', state, policy, isTriggerPeriod: false, contributionPeriodKey: null, scheduleMonths: scheduledMonths(policy.frequency, policy.scheduleMonths) };
  const trigger = isLwfTriggerPeriod(policy.frequency, policy.scheduleMonths, at);
  return { status: 'applied', reason: trigger ? 'policy_applied' : 'non_trigger_period', state, policy, isTriggerPeriod: trigger, contributionPeriodKey: trigger ? lwfContributionPeriodKey(policy.id, at) : null, scheduleMonths: scheduledMonths(policy.frequency, policy.scheduleMonths) };
}

type SalaryComponent = Record<string, unknown> & { code?: unknown };

export function applyEffectiveLwfSetting(raw: unknown, setting: EffectiveLwfSetting | null) {
  if (!raw || typeof raw !== 'object') return { input: raw, setting };
  const source = raw as { components?: unknown };
  if (!Array.isArray(source.components)) return { input: raw, setting };
  const managedCodes = new Set(['EMPLOYEE_LWF', 'EMPLOYER_LWF']);
  const components = source.components.filter(component => !managedCodes.has(String((component as SalaryComponent).code || '').toUpperCase())).map(component => ({ ...(component as SalaryComponent) }));
  if (!setting) return { input: { ...(raw as Record<string, unknown>), components }, setting };
  const enabled = setting.status === 'active';
  const upsert = (code: string, name: string, category: 'deduction' | 'employer_contribution', fixedAmount: Prisma.Decimal, sortOrder: number) => {
    const normalized = { code, name, category, calculation_type: 'fixed' as const, fixed_amount: enabled ? fixedAmount.toFixed(2) : '0.00', percentage: null, percentage_basis: null, enabled, classification: 'mandatory' as const, statutory_code: code, applicability_min_gross: null, applicability_max_gross: null, monthly_cap: null, is_custom: false, sort_order: sortOrder };
    const index = components.findIndex(component => String(component.code || '').toUpperCase() === code);
    if (index === -1) components.push(normalized); else components[index] = normalized;
  };
  upsert('EMPLOYEE_LWF', 'Employee Labour Welfare Fund (LWF)', 'deduction', setting.employeeAmount, 125);
  upsert('EMPLOYER_LWF', 'Employer Labour Welfare Fund (LWF)', 'employer_contribution', setting.employerAmount, 225);
  return { input: { ...(raw as Record<string, unknown>), components }, setting };
}
