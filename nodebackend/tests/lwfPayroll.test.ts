import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { createAdjustmentRun, createPayrollPreview } from '../src/services/payrollService';
import { isLwfTriggerPeriod, lwfContributionPeriodKey, parseScheduleMonths, resolveLwfPolicy, scheduledMonths } from '../src/services/lwfService';

const state = { id: 'state-1', code: 'DL', name: 'Delhi' };
const policy = (overrides: Record<string, unknown> = {}) => ({
  id: 'policy-1', stateId: state.id, versionNumber: 1, establishmentType: null,
  employeeAmount: new Prisma.Decimal(25), employerAmount: new Prisma.Decimal(50), frequency: 'monthly', scheduleMonths: '[]',
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), effectiveTo: null, eligibilityMinGross: null, eligibilityMaxGross: null,
  eligibleEmployeeCategories: '[]', exemptionCodes: '[]', status: 'active', legalReference: 'Approved notification', ...overrides,
});

function lwfClient(policies: any[]) {
  return {
    stateMaster: { findMany: async () => [state], findFirst: async () => state },
    lwfPolicyVersion: { findMany: async () => policies },
  } as any;
}

test('schedule engine applies explicit months and deterministic contribution keys', () => {
  assert.deepEqual(parseScheduleMonths('[12,6,6,0,13]'), [6, 12]);
  assert.deepEqual(scheduledMonths('monthly', '[]'), [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal(isLwfTriggerPeriod('half_yearly', '[6,12]', new Date('2026-06-30T00:00:00Z')), true);
  assert.equal(isLwfTriggerPeriod('half_yearly', '[6,12]', new Date('2026-07-31T00:00:00Z')), false);
  assert.equal(lwfContributionPeriodKey('policy-1', new Date('2026-06-30T00:00:00Z')), 'policy-1:2026-06');
});

test('state policy resolver honors effective dates, eligibility and explicit non-trigger periods', async () => {
  const resolved = await resolveLwfPolicy(lwfClient([policy({ frequency: 'half_yearly', scheduleMonths: '[6,12]', eligibilityMaxGross: new Prisma.Decimal(20000) })]), { stateText: 'Delhi', effectiveDate: new Date('2026-07-31T00:00:00Z'), grossAmount: 18000 });
  assert.equal(resolved.status, 'applied');
  assert.equal(resolved.isTriggerPeriod, false);
  assert.equal(resolved.reason, 'non_trigger_period');
  const ineligible = await resolveLwfPolicy(lwfClient([policy({ eligibilityMaxGross: new Prisma.Decimal(15000) })]), { stateText: 'DL', effectiveDate: new Date('2026-07-31T00:00:00Z'), grossAmount: 18000 });
  assert.equal(ineligible.status, 'not_applicable');
  assert.equal(ineligible.reason, 'gross_above_eligibility_maximum');
});

test('state policy resolver never falls back to a global rate when jurisdiction is unconfigured or ambiguous', async () => {
  const missing = await resolveLwfPolicy(lwfClient([]), { stateText: 'Delhi', effectiveDate: new Date('2026-07-31T00:00:00Z'), grossAmount: 18000 });
  assert.equal(missing.status, 'not_configured');
  const ambiguous = await resolveLwfPolicy(lwfClient([policy(), policy({ id: 'policy-2', versionNumber: 2 })]), { stateText: 'Delhi', effectiveDate: new Date('2026-07-31T00:00:00Z'), grossAmount: 18000 });
  assert.equal(ambiguous.status, 'ambiguous');
});

function payrollTx(activePolicies: any[], periodEnd = new Date('2026-06-30T00:00:00Z')) {
  const resultWrites: any[] = [], lineWrites: any[] = [];
  const components = [
    { id: 'c1', code: 'BASIC_SALARY', name: 'Basic Salary', category: 'earning', monthlyAmount: new Prisma.Decimal(10000), enabled: true, sortOrder: 1, calculationType: 'fixed', statutoryCode: null },
    { id: 'c2', code: 'EMPLOYEE_PF', name: 'Employee PF', category: 'deduction', monthlyAmount: new Prisma.Decimal(1000), enabled: true, sortOrder: 2, calculationType: 'fixed', statutoryCode: 'PF' },
    { id: 'c3', code: 'EMPLOYER_PF', name: 'Employer PF', category: 'employer_contribution', monthlyAmount: new Prisma.Decimal(500), enabled: true, sortOrder: 3, calculationType: 'fixed', statutoryCode: 'PF' },
    { id: 'c4', code: 'EMPLOYEE_LWF', name: 'Stale estimate LWF', category: 'deduction', monthlyAmount: new Prisma.Decimal(999), enabled: true, sortOrder: 4, calculationType: 'fixed', statutoryCode: 'LWF' },
  ];
  const tx: any = {
    payrollRun: { findUnique: async () => null, create: async ({ data }: any) => ({ id: 'run-1', ...data }), findUniqueOrThrow: async () => ({ id: 'run-1', results: resultWrites.map((row, index) => ({ id: `result-${index + 1}`, ...row, lines: lineWrites })) }) },
    payrollPeriod: { findFirst: async () => ({ id: 'period-1', status: 'open', periodStart: new Date('2026-06-01T00:00:00Z'), periodEnd }) },
    jobApplication: { findMany: async () => [{ id: 'app-1', employerUserId: 'employer-1', guardUserId: 'guard-1', status: 'hired', createdAt: new Date(), job: { id: 'job-1', paymentType: 'Monthly', guardType: 'SECURITY_GUARD', category: null, site: { state: 'Delhi' }, company: { state: 'Delhi', businessType: null }, salaryStructure: { id: 'salary-1', calculationVersion: 2, components } } }] },
    attendanceRecord: { findMany: async () => [{ id: 'att-1', attendanceDate: new Date('2026-06-10T00:00:00Z'), totalHours: new Prisma.Decimal(8), status: 'approved' }] },
    stateMaster: { findMany: async () => [state] }, lwfPolicyVersion: { findMany: async () => activePolicies },
    payrollResult: { create: async ({ data }: any) => { resultWrites.push(data); return { id: `result-${resultWrites.length}`, ...data }; } },
    payrollLine: { createMany: async ({ data }: any) => { lineWrites.push(...data); return { count: data.length }; } },
    payrollAuditEvent: { create: async () => ({ id: 'audit-1' }) },
  };
  return { tx, resultWrites, lineWrites };
}

test('full-period payroll applies scheduled LWF once and preserves PF/employer contribution separation', async () => {
  const { tx, resultWrites, lineWrites } = payrollTx([policy({ frequency: 'half_yearly', scheduleMonths: '[6,12]' })]);
  await createPayrollPreview(tx, { periodId: 'period-1', employerUserId: 'employer-1', actorUserId: 'employer-1', idempotencyKey: 'preview-key-1', fullPeriodConfirmed: true });
  assert.equal(resultWrites[0].grossPayable.toFixed(2), '10000.00');
  assert.equal(resultWrites[0].employeeDeductions.toFixed(2), '1025.00');
  assert.equal(resultWrites[0].netPayable.toFixed(2), '8975.00');
  assert.equal(resultWrites[0].employerContributions.toFixed(2), '550.00');
  assert.equal(lineWrites.filter(row => row.code === 'EMPLOYEE_LWF').length, 1);
  assert.equal(lineWrites.some(row => row.name === 'Stale estimate LWF'), false);
});

test('non-trigger payroll does not deduct non-monthly LWF and an unconfigured state blocks approval', async () => {
  const nonTrigger = payrollTx([policy({ frequency: 'half_yearly', scheduleMonths: '[6,12]' })], new Date('2026-07-31T00:00:00Z'));
  await createPayrollPreview(nonTrigger.tx, { periodId: 'period-1', employerUserId: 'employer-1', actorUserId: 'employer-1', idempotencyKey: 'preview-key-2', fullPeriodConfirmed: true });
  assert.equal(nonTrigger.resultWrites[0].netPayable.toFixed(2), '9000.00');
  assert.equal(nonTrigger.lineWrites.some((row: any) => row.code.includes('LWF')), false);
  const missing = payrollTx([]);
  await createPayrollPreview(missing.tx, { periodId: 'period-1', employerUserId: 'employer-1', actorUserId: 'employer-1', idempotencyKey: 'preview-key-3', fullPeriodConfirmed: true });
  assert.equal(missing.resultWrites[0].status, 'blocked');
});

test('partial-month payroll is blocked until an approved proration rule exists', async () => {
  const { tx } = payrollTx([policy()]);
  await assert.rejects(() => createPayrollPreview(tx, { periodId: 'period-1', employerUserId: 'employer-1', actorUserId: 'employer-1', idempotencyKey: 'preview-key-4', fullPeriodConfirmed: false }), (error) => error instanceof Error && /proration is not configured/i.test(error.message));
});

test('reversal creates immutable signed adjustment lines instead of editing finalized payroll', async () => {
  const writes: any[] = [], lines: any[] = [];
  const tx: any = {
    payrollRun: {
      findUnique: async () => null,
      findFirst: async () => ({ id: 'original-run', periodId: 'period-1', employerUserId: 'employer-1', status: 'finalized', results: [{ id: 'original-result', applicationId: 'app-1', guardUserId: 'guard-1', jobId: 'job-1', stateId: state.id, lwfPolicyVersionId: 'policy-1', lwfContributionPeriodKey: 'policy-1:2026-06', policySnapshot: '{}', lines: [{ code: 'BASIC_SALARY', name: 'Basic', category: 'earning', amount: new Prisma.Decimal(10000) }, { code: 'EMPLOYEE_LWF', name: 'LWF', category: 'deduction', amount: new Prisma.Decimal(25) }] }] }),
      create: async ({ data }: any) => ({ id: 'reversal-run', ...data }),
      findUniqueOrThrow: async () => ({ id: 'reversal-run', results: writes }),
    },
    payrollResult: { create: async ({ data }: any) => { writes.push(data); return { id: 'reversal-result', ...data }; }, count: async () => writes.length },
    payrollLine: { createMany: async ({ data }: any) => { lines.push(...data); } }, payrollAuditEvent: { create: async () => ({}) },
  };
  await createAdjustmentRun(tx, { originalRunId: 'original-run', employerUserId: 'employer-1', actorUserId: 'employer-1', idempotencyKey: 'reversal-key', reason: 'Approved correction', runType: 'reversal' });
  assert.equal(writes[0].originalResultId, 'original-result');
  assert.equal(lines.find(row => row.code === 'BASIC_SALARY').amount.toFixed(2), '-10000.00');
  assert.equal(lines.find(row => row.code === 'EMPLOYEE_LWF').amount.toFixed(2), '-25.00');
});
