import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/http';
import { policySnapshot, resolveLwfPolicy } from './lwfService';

const zero = () => new Prisma.Decimal(0);
const round = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const sum = (values: Array<Prisma.Decimal | string | number>) => round(values.reduce<Prisma.Decimal>((total, value) => total.add(value), zero()));
const LWF_CODES = new Set(['EMPLOYEE_LWF', 'EMPLOYER_LWF']);

type PreviewInput = { periodId: string; employerUserId: string; actorUserId: string; idempotencyKey: string; applicationIds?: string[]; fullPeriodConfirmed: boolean };

export async function createPayrollPreview(tx: Prisma.TransactionClient, input: PreviewInput) {
  const existing = await tx.payrollRun.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { results: { include: { lines: true } } } });
  if (existing) {
    if (existing.employerUserId !== input.employerUserId) throw new HttpError(409, 'Idempotency key is already used by another employer.');
    return existing;
  }
  if (!input.fullPeriodConfirmed) throw new HttpError(422, 'Monthly salary proration is not configured. Confirm a full, unprorated payroll period or configure an approved proration rule before processing partial salary.');
  const period = await tx.payrollPeriod.findFirst({ where: { id: input.periodId, employerUserId: input.employerUserId } });
  if (!period) throw new HttpError(404, 'Payroll period not found.');
  if (period.status !== 'open') throw new HttpError(409, 'This payroll period is closed.');
  const applications = await tx.jobApplication.findMany({
    where: { employerUserId: input.employerUserId, status: 'hired', ...(input.applicationIds?.length ? { id: { in: input.applicationIds } } : {}) },
    include: {
      job: {
        include: {
          salaryStructure: { include: { components: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } },
          site: { select: { state: true } },
          company: { select: { state: true, businessType: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!applications.length) throw new HttpError(422, 'No hired associates with matching applications are available for this payroll preview.');
  const missing = applications.find(application => !application.job.salaryStructure || !String(application.job.paymentType ?? '').toLocaleLowerCase('en-IN').includes('month'));
  if (missing) throw new HttpError(422, `Application ${missing.id} does not have an approved monthly salary structure.`);
  const run = await tx.payrollRun.create({ data: { periodId: period.id, employerUserId: input.employerUserId, runType: 'regular', status: 'draft', idempotencyKey: input.idempotencyKey, createdByUserId: input.actorUserId } });
  for (const application of applications) {
    const job = application.job;
    const structure = job.salaryStructure!;
    const attendance = await tx.attendanceRecord.findMany({
      where: { employerUserId: input.employerUserId, guardUserId: application.guardUserId, jobId: job.id, status: 'approved', attendanceDate: { gte: period.periodStart, lte: period.periodEnd } },
      select: { id: true, attendanceDate: true, totalHours: true, status: true }, orderBy: { attendanceDate: 'asc' },
    });
    const baseComponents = structure.components.filter(component => component.enabled && !LWF_CODES.has(component.code.toUpperCase()));
    const gross = sum(baseComponents.filter(component => component.category === 'earning').map(component => component.monthlyAmount));
    const stateText = job.site?.state ?? job.company?.state ?? null;
    const resolution = await resolveLwfPolicy(tx, { stateText, establishmentType: job.company?.businessType, effectiveDate: period.periodEnd, grossAmount: gross, employeeCategory: job.guardType ?? job.category });
    const lines = baseComponents.map(component => ({ code: component.code, name: component.name, category: component.category, amount: component.monthlyAmount, sourceType: 'salary_structure', sourceId: structure.id, metadata: JSON.stringify({ calculation_type: component.calculationType, statutory_code: component.statutoryCode }) }));
    if (resolution.status === 'applied' && resolution.policy && resolution.isTriggerPeriod) {
      lines.push({ code: 'EMPLOYEE_LWF', name: 'Employee Labour Welfare Fund (LWF)', category: 'deduction', amount: resolution.policy.employeeAmount, sourceType: 'lwf_policy', sourceId: resolution.policy.id, metadata: JSON.stringify({ contribution_period_key: resolution.contributionPeriodKey }) });
      lines.push({ code: 'EMPLOYER_LWF', name: 'Employer Labour Welfare Fund (LWF)', category: 'employer_contribution', amount: resolution.policy.employerAmount, sourceType: 'lwf_policy', sourceId: resolution.policy.id, metadata: JSON.stringify({ contribution_period_key: resolution.contributionPeriodKey }) });
    }
    const deductions = sum(lines.filter(line => line.category === 'deduction').map(line => line.amount));
    const contributions = sum(lines.filter(line => line.category === 'employer_contribution').map(line => line.amount));
    const net = round(gross.sub(deductions));
    if (net.isNegative()) throw new HttpError(422, `Payroll deductions exceed gross salary for application ${application.id}.`);
    const blocked = resolution.status === 'not_configured' || resolution.status === 'ambiguous';
    const salarySnapshot = { structure_id: structure.id, calculation_version: structure.calculationVersion, full_period_confirmed: true, monthly_proration: 'not_applied', lwf_resolution_status: resolution.status, lwf_resolution_reason: resolution.reason };
    const result = await tx.payrollResult.create({ data: {
      runId: run.id, applicationId: application.id, guardUserId: application.guardUserId, jobId: job.id,
      stateId: resolution.state?.id ?? null, lwfPolicyVersionId: resolution.policy?.id ?? null, lwfContributionPeriodKey: resolution.contributionPeriodKey,
      payableDays: attendance.length, attendanceSnapshot: JSON.stringify(attendance), salarySnapshot: JSON.stringify(salarySnapshot),
      policySnapshot: resolution.policy ? JSON.stringify(policySnapshot(resolution.policy, resolution.state)) : JSON.stringify({ status: resolution.status, reason: resolution.reason, state: resolution.state }),
      grossPayable: gross, employeeDeductions: deductions, netPayable: net, employerContributions: contributions, employerCost: round(gross.add(contributions)), status: blocked ? 'blocked' : 'draft',
    } });
    await tx.payrollLine.createMany({ data: lines.map(line => ({ payrollResultId: result.id, ...line })) });
  }
  await tx.payrollAuditEvent.create({ data: { runId: run.id, actorUserId: input.actorUserId, action: 'preview_created', snapshot: JSON.stringify({ full_period_confirmed: true, application_count: applications.length }) } });
  return tx.payrollRun.findUniqueOrThrow({ where: { id: run.id }, include: { period: true, results: { include: { lines: true, payment: true } }, auditEvents: { orderBy: { createdAt: 'desc' } } } });
}

export async function approvePayrollRun(tx: Prisma.TransactionClient, runId: string, employerUserId: string, actorUserId: string) {
  const run = await tx.payrollRun.findFirst({ where: { id: runId, employerUserId }, include: { results: true } });
  if (!run) throw new HttpError(404, 'Payroll run not found.');
  if (run.status !== 'draft') throw new HttpError(409, 'Only a draft payroll run can be approved.');
  if (run.results.some(result => result.status === 'blocked')) throw new HttpError(422, 'This payroll run contains unresolved LWF jurisdiction or configuration. Resolve the blocked results before approval.');
  await tx.payrollResult.updateMany({ where: { runId }, data: { status: 'approved' } });
  const updated = await tx.payrollRun.update({ where: { id: runId }, data: { status: 'approved', approvedByUserId: actorUserId, approvedAt: new Date() } });
  await tx.payrollAuditEvent.create({ data: { runId, actorUserId, action: 'approved' } });
  return updated;
}

async function postLiability(tx: Prisma.TransactionClient, run: any, result: any, entryType: 'finalized' | 'correction' | 'reversal') {
  if (!result.stateId || !result.lwfPolicyVersionId || !result.lwfContributionPeriodKey) return;
  const employeeLine = result.lines.find((line: any) => line.code === 'EMPLOYEE_LWF');
  const employerLine = result.lines.find((line: any) => line.code === 'EMPLOYER_LWF');
  const employeeAmount = new Prisma.Decimal(employeeLine?.amount ?? 0);
  const employerAmount = new Prisma.Decimal(employerLine?.amount ?? 0);
  if (employeeAmount.isZero() && employerAmount.isZero()) return;
  const liability = await tx.lwfLiability.upsert({
    where: { employerUserId_stateId_policyVersionId_contributionPeriodKey: { employerUserId: run.employerUserId, stateId: result.stateId, policyVersionId: result.lwfPolicyVersionId, contributionPeriodKey: result.lwfContributionPeriodKey } },
    create: { employerUserId: run.employerUserId, stateId: result.stateId, policyVersionId: result.lwfPolicyVersionId, contributionPeriodKey: result.lwfContributionPeriodKey, employeeTotal: 0, employerTotal: 0, totalPayable: 0, remittedAmount: 0, outstandingAmount: 0 },
    update: {},
  });
  const totalDelta = round(employeeAmount.add(employerAmount));
  const nextTotal = round(liability.totalPayable.add(totalDelta));
  const nextEmployee = round(liability.employeeTotal.add(employeeAmount));
  const nextEmployer = round(liability.employerTotal.add(employerAmount));
  if (nextTotal.lessThan(liability.remittedAmount) || nextEmployee.isNegative() || nextEmployer.isNegative()) throw new HttpError(409, 'This correction would reduce an LWF liability below amounts already remitted or below zero. Void/reconcile the remittance first.');
  await tx.lwfLiabilityEntry.create({ data: { liabilityId: liability.id, payrollResultId: result.id, entryType, employeeAmount, employerAmount } });
  const outstanding = round(nextTotal.sub(liability.remittedAmount));
  await tx.lwfLiability.update({ where: { id: liability.id }, data: { employeeTotal: nextEmployee, employerTotal: nextEmployer, totalPayable: nextTotal, outstandingAmount: outstanding, status: outstanding.isZero() ? 'paid' : liability.remittedAmount.isZero() ? 'outstanding' : 'partially_paid' } });
}

export async function finalizePayrollRun(tx: Prisma.TransactionClient, runId: string, employerUserId: string, actorUserId: string) {
  const run = await tx.payrollRun.findFirst({ where: { id: runId, employerUserId }, include: { results: { include: { lines: true } } } });
  if (!run) throw new HttpError(404, 'Payroll run not found.');
  if (run.status !== 'approved') throw new HttpError(409, 'Only an approved payroll run can be finalized.');
  for (const result of run.results) {
    if (run.runType === 'regular' && result.lwfPolicyVersionId && result.lwfContributionPeriodKey && result.lines.some(line => LWF_CODES.has(line.code))) {
      try {
        await tx.payrollLwfOccurrence.create({ data: { payrollResultId: result.id, guardUserId: result.guardUserId, policyVersionId: result.lwfPolicyVersionId, contributionPeriodKey: result.lwfContributionPeriodKey } });
      } catch (cause) {
        if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2002') throw new HttpError(409, `LWF was already finalized for associate ${result.guardUserId} and contribution period ${result.lwfContributionPeriodKey}.`);
        throw cause;
      }
    }
    await postLiability(tx, run, result, run.runType === 'regular' ? 'finalized' : run.runType as 'correction' | 'reversal');
  }
  await tx.payrollResult.updateMany({ where: { runId }, data: { status: 'finalized' } });
  const updated = await tx.payrollRun.update({ where: { id: runId }, data: { status: 'finalized', finalizedByUserId: actorUserId, finalizedAt: new Date() } });
  if (run.runType === 'reversal' && run.correctionOfRunId) {
    await tx.payrollRun.update({ where: { id: run.correctionOfRunId }, data: { status: 'reversed', reversedByUserId: actorUserId, reversedAt: new Date() } });
    await tx.payrollLwfOccurrence.updateMany({ where: { payrollResult: { runId: run.correctionOfRunId } }, data: { status: 'reversed' } });
  }
  await tx.payrollAuditEvent.create({ data: { runId, actorUserId, action: 'finalized' } });
  return updated;
}

type Adjustment = { code: string; name: string; category: 'earning' | 'deduction' | 'employer_contribution'; amount: string };
export async function createAdjustmentRun(tx: Prisma.TransactionClient, input: { originalRunId: string; employerUserId: string; actorUserId: string; idempotencyKey: string; reason: string; runType: 'correction' | 'reversal'; adjustments?: Array<{ originalResultId: string; lines: Adjustment[] }> }) {
  const existing = await tx.payrollRun.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { results: { include: { lines: true } } } });
  if (existing) return existing;
  const original = await tx.payrollRun.findFirst({ where: { id: input.originalRunId, employerUserId: input.employerUserId, status: 'finalized' }, include: { results: { include: { lines: true } } } });
  if (!original) throw new HttpError(404, 'Finalized payroll run not found.');
  const run = await tx.payrollRun.create({ data: { periodId: original.periodId, employerUserId: input.employerUserId, runType: input.runType, status: 'draft', idempotencyKey: input.idempotencyKey, correctionOfRunId: original.id, reason: input.reason, createdByUserId: input.actorUserId } });
  for (const originalResult of original.results) {
    const provided = input.adjustments?.find(item => item.originalResultId === originalResult.id)?.lines;
    const adjustmentLines: Adjustment[] = input.runType === 'reversal'
      ? originalResult.lines.map(line => ({ code: line.code, name: `${line.name} reversal`, category: line.category as Adjustment['category'], amount: new Prisma.Decimal(line.amount).negated().toFixed(2) }))
      : (provided ?? []);
    if (!adjustmentLines.length) continue;
    const gross = sum(adjustmentLines.filter(line => line.category === 'earning').map(line => line.amount));
    const deductions = sum(adjustmentLines.filter(line => line.category === 'deduction').map(line => line.amount));
    const contributions = sum(adjustmentLines.filter(line => line.category === 'employer_contribution').map(line => line.amount));
    const result = await tx.payrollResult.create({ data: {
      runId: run.id, applicationId: originalResult.applicationId, guardUserId: originalResult.guardUserId, jobId: originalResult.jobId,
      stateId: originalResult.stateId, lwfPolicyVersionId: originalResult.lwfPolicyVersionId, lwfContributionPeriodKey: originalResult.lwfContributionPeriodKey,
      payableDays: 0, attendanceSnapshot: '[]', salarySnapshot: JSON.stringify({ adjustment_of_result_id: originalResult.id, reason: input.reason }), policySnapshot: originalResult.policySnapshot,
      grossPayable: gross, employeeDeductions: deductions, netPayable: round(gross.sub(deductions)), employerContributions: contributions, employerCost: round(gross.add(contributions)), status: 'draft', originalResultId: originalResult.id,
    } });
    await tx.payrollLine.createMany({ data: adjustmentLines.map(line => ({ payrollResultId: result.id, code: line.code, name: line.name, category: line.category, amount: new Prisma.Decimal(line.amount), sourceType: input.runType, sourceId: originalResult.id })) });
  }
  const count = await tx.payrollResult.count({ where: { runId: run.id } });
  if (!count) throw new HttpError(422, 'Provide at least one correction line.');
  await tx.payrollAuditEvent.create({ data: { runId: run.id, actorUserId: input.actorUserId, action: `${input.runType}_created`, reason: input.reason } });
  return tx.payrollRun.findUniqueOrThrow({ where: { id: run.id }, include: { results: { include: { lines: true } } } });
}
