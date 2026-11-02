import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { calculateSalaryStructure, saveJobSalaryStructure } from '../src/services/salaryStructureService';
import { storeTemplate } from '../src/controllers/salaryStructureController';
import { store as storeJob, update as updateJob } from '../src/controllers/jobController';
import { requireRole } from '../src/middleware/role';
import { prisma } from '../src/prisma';
import { HttpError } from '../src/utils/http';
import { applyEffectiveLwfSetting, resolveEffectiveLwfSetting } from '../src/services/lwfService';
import { saveEmployerSetting, saveMaster } from '../src/controllers/lwfController';
import { adminEmployeeModules } from '../src/utils/adminEmployeeAccess';

const component = (code: string, name: string, category: 'earning' | 'deduction' | 'employer_contribution', changes: Record<string, unknown> = {}) => ({
  code, name, category, calculation_type: 'fixed', fixed_amount: '0', percentage: null,
  percentage_basis: null, enabled: true, classification: 'optional', statutory_code: null,
  applicability_min_gross: null, applicability_max_gross: null, monthly_cap: null,
  is_custom: false, sort_order: 0, ...changes,
});

function mock(t: { after: (fn: () => void) => void }, object: any, key: string, implementation: any) {
  const previous = object[key];
  object[key] = implementation;
  t.after(() => { object[key] = previous; });
}

function responseCapture() {
  let statusCode = 200; let body: any;
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(value: any) { body = value; return response; },
  } as unknown as Response;
  return { response, result: () => ({ statusCode, body }) };
}

test('earnings, deductions, net salary and employer costs are calculated independently', () => {
  const result = calculateSalaryStructure({ components: [
    component('BASIC_SALARY', 'Basic Salary', 'earning', { fixed_amount: '10000.00' }),
    component('HRA', 'HRA', 'earning', { fixed_amount: '2500.25' }),
    component('EMPLOYEE_PF', 'Employee PF', 'deduction', { fixed_amount: '800.10' }),
    component('EMPLOYER_PF', 'Employer PF', 'employer_contribution', { fixed_amount: '900.20' }),
  ] });
  assert.equal(result.gross_monthly, '12500.25');
  assert.equal(result.deductions_monthly, '800.10');
  assert.equal(result.net_monthly, '11700.15');
  assert.equal(result.employer_contributions_monthly, '900.20');
  assert.equal(result.employer_cost_monthly, '13400.45');
  assert.equal(result.annual_ctc, '160805.40');
});

test('percentage components use their configured basis with decimal-safe half-up rounding', () => {
  const result = calculateSalaryStructure({ components: [
    component('BASIC_SALARY', 'Basic Salary', 'earning', { fixed_amount: '100.00' }),
    component('HRA', 'HRA', 'earning', { calculation_type: 'percentage', fixed_amount: null, percentage: '33.3333', percentage_basis: 'basic_salary' }),
    component('EMPLOYEE_PF', 'Employee PF', 'deduction', { calculation_type: 'percentage', fixed_amount: null, percentage: '12', percentage_basis: 'basic_salary' }),
    component('EMPLOYER_PF', 'Employer PF', 'employer_contribution', { calculation_type: 'percentage', fixed_amount: null, percentage: '12', percentage_basis: 'basic_salary' }),
  ] });
  assert.equal(result.gross_monthly, '133.33');
  assert.equal(result.deductions_monthly, '12.00');
  assert.equal(result.net_monthly, '121.33');
  assert.equal(result.employer_cost_monthly, '145.33');
});

test('configurable statutory rules override rates and enforce applicability and caps', () => {
  const raw = { components: [
    component('BASIC_SALARY', 'Basic Salary', 'earning', { fixed_amount: '20000' }),
    component('EMPLOYEE_PF', 'Employee PF', 'deduction', { calculation_type: 'percentage', fixed_amount: null, percentage: '1', percentage_basis: 'gross_salary', statutory_code: 'EMPLOYEE_PF' }),
  ] };
  const rule = [{ code: 'EMPLOYEE_PF', category: 'deduction', percentage: new Prisma.Decimal(12), percentageBasis: 'basic_salary', applicabilityMinGross: null, applicabilityMaxGross: new Prisma.Decimal(25000), monthlyCap: new Prisma.Decimal(1800), enabled: true }];
  assert.equal(calculateSalaryStructure(raw, rule).deductions_monthly, '1800.00');
  rule[0].applicabilityMaxGross = new Prisma.Decimal(15000);
  assert.equal(calculateSalaryStructure(raw, rule).deductions_monthly, '0.00');
});

test('invalid salary structures fail closed', () => {
  assert.throws(() => calculateSalaryStructure({ components: [component('BASIC_SALARY', 'Basic', 'earning', { fixed_amount: '-1' })] }), /non-negative/);
  assert.throws(() => calculateSalaryStructure({ components: [component('BASIC_SALARY', 'Basic', 'earning'), component('BASIC_SALARY', 'Duplicate', 'earning')] }), /Duplicate component identifier/);
  assert.throws(() => calculateSalaryStructure({ components: [component('BASIC_SALARY', 'Basic', 'earning')] }), (error) => error instanceof HttpError && error.status === 422);
  assert.throws(() => calculateSalaryStructure({ components: [component('BASIC_SALARY', 'Basic', 'earning', { fixed_amount: '100' }), component('RECOVERY', 'Recovery', 'deduction', { fixed_amount: '101' })] }), /cannot exceed gross/);
});

test('saving a job structure replaces normalized components and writes an audit snapshot', async () => {
  const writes: Record<string, any>[] = []; let deleted = false;
  const tx = {
    salaryStatutoryRule: { findMany: async () => [] },
    employerLwfSetting: { findUnique: async () => null },
    lwfMasterSetting: { findUnique: async () => null },
    jobSalaryStructure: { upsert: async ({ create }: any) => ({ id: 'structure-1', ...create }) },
    jobSalaryComponent: {
      deleteMany: async () => { deleted = true; },
      createMany: async ({ data }: any) => { writes.push(...data); },
    },
    jobSalaryAuditEvent: { create: async ({ data }: any) => { writes.push({ audit: data }); } },
  } as unknown as Prisma.TransactionClient;
  const result = await saveJobSalaryStructure(tx, 'job-1', 'employer-1', 'actor-1', { components: [component('BASIC_SALARY', 'Basic Salary', 'earning', { fixed_amount: '15000' })] });
  assert.equal(result.gross_monthly, '15000.00');
  assert.equal(deleted, true);
  assert.equal(writes[0].structureId, 'structure-1');
  assert.equal(writes[0].monthlyAmount, '15000.00');
  assert.equal(writes.at(-1)?.audit.actorUserId, 'actor-1');
  assert.match(writes.at(-1)?.audit.snapshot, /"gross_monthly":"15000.00"/);
});

test('templates are employer-scoped and persist reusable normalized components', async t => {
  let templateCreate: any; let componentCreate: any;
  const fakeTx = {
    salaryStructureTemplate: {
      create: async ({ data }: any) => { templateCreate = data; return { id: 'template-1', ...data }; },
      findUniqueOrThrow: async () => ({ id: 'template-1', ...templateCreate, components: componentCreate }),
    },
    salaryTemplateComponent: { createMany: async ({ data }: any) => { componentCreate = data; } },
  };
  mock(t, prisma, '$transaction', async (callback: any) => callback(fakeTx));
  const { response, result } = responseCapture();
  await storeTemplate({ user: { id: 'employer-1' }, body: { name: 'Security Team', components: [component('BASIC_SALARY', 'Basic Salary', 'earning', { fixed_amount: '18000' })] } } as unknown as Request, response);
  assert.equal(result().statusCode, 201);
  assert.equal(templateCreate.employerUserId, 'employer-1');
  assert.equal(componentCreate[0].templateId, 'template-1');
  assert.equal(result().body.components[0].fixed_amount, '18000.00');
});

test('Add Job persists server-calculated gross salary and returns the normalized structure', async t => {
  const companyId = '10000000-0000-4000-8000-000000000001';
  let legacyGross: unknown;
  mock(t, prisma.associateType, 'findFirst', async () => ({ id: 'associate-type-1' }));
  mock(t, prisma.employerWallet, 'findUnique', async () => ({ depositBalance: new Prisma.Decimal(10000) }));
  mock(t, prisma.employerCompany, 'findFirst', async () => ({ id: companyId, employerUserId: 'employer-1' }));
  const fakeTx = {
    salaryStatutoryRule: { findMany: async () => [] },
    employerLwfSetting: { findUnique: async () => null },
    lwfMasterSetting: { findUnique: async () => null },
    jobPost: {
      create: async ({ data }: any) => ({ id: 'job-1', ...data }),
      update: async ({ data }: any) => { legacyGross = data.salaryAmount; },
      findUniqueOrThrow: async () => ({ id: 'job-1', title: 'Guard', salaryAmount: legacyGross, salaryStructure: { grossMonthly: legacyGross, components: [] } }),
    },
    jobSalaryStructure: { upsert: async ({ create }: any) => ({ id: 'structure-1', ...create }) },
    jobSalaryComponent: { deleteMany: async () => ({}), createMany: async () => ({ count: 1 }) },
    jobSalaryAuditEvent: { create: async () => ({ id: 'audit-1' }) },
  };
  mock(t, prisma, '$transaction', async (callback: any) => callback(fakeTx));
  const { response, result } = responseCapture();
  await storeJob({ user: { id: 'employer-1' }, body: {
    company_id: companyId, title: 'Guard', guard_type: 'SECURITY_GUARD', payment_type: 'Monthly',
    salary_structure: { components: [component('BASIC_SALARY', 'Basic Salary', 'earning', { fixed_amount: '22000.50' })] },
  } } as unknown as Request, response);
  assert.equal(result().statusCode, 201);
  assert.equal(legacyGross, '22000.50');
  assert.equal(result().body.salary_amount, '22000.50');
});

test('editing a historical job without a structure preserves its legacy salary amount', async t => {
  let updateData: any;
  mock(t, prisma.jobPost, 'findUnique', async () => ({ id: 'job-1', employerUserId: 'employer-1', salaryAmount: new Prisma.Decimal(9000), salaryStructure: null }));
  const fakeTx = {
    jobPost: {
      update: async ({ data }: any) => { updateData = data; return { id: 'job-1', ...data }; },
      findUniqueOrThrow: async () => ({ id: 'job-1', employerUserId: 'employer-1', salaryAmount: new Prisma.Decimal(9000), title: 'Updated', salaryStructure: null }),
    },
  };
  mock(t, prisma, '$transaction', async (callback: any) => callback(fakeTx));
  await updateJob({ user: { id: 'employer-1' }, params: { job: 'job-1' }, body: { title: 'Updated' } } as unknown as Request, responseCapture().response);
  assert.equal(updateData.salaryAmount, undefined);
});

test('employer LWF override wins over the Super Admin master and is injected server-side', async () => {
  const client = {
    employerLwfSetting: { findUnique: async () => ({ id: 'override-1', employeeAmount: new Prisma.Decimal(40), employerAmount: new Prisma.Decimal(80), status: 'active' }) },
    lwfMasterSetting: { findUnique: async () => ({ id: 'master-1', employeeAmount: new Prisma.Decimal(35), employerAmount: new Prisma.Decimal(70), status: 'active' }) },
  } as any;
  const setting = await resolveEffectiveLwfSetting(client, 'employer-1');
  assert.equal(setting?.source, 'employer');
  const applied = applyEffectiveLwfSetting({ components: [component('BASIC_SALARY', 'Basic', 'earning', { fixed_amount: '10000' })] }, setting);
  const calculated = calculateSalaryStructure(applied.input);
  assert.equal(calculated.deductions_monthly, '40.00');
  assert.equal(calculated.employer_contributions_monthly, '80.00');
});

test('Super Admin LWF master applies when the employer has no override', async () => {
  const client = {
    employerLwfSetting: { findUnique: async () => null },
    lwfMasterSetting: { findUnique: async () => ({ id: 'master-1', employeeAmount: new Prisma.Decimal(35), employerAmount: new Prisma.Decimal(70), status: 'active' }) },
  } as any;
  const setting = await resolveEffectiveLwfSetting(client, 'employer-1');
  assert.equal(setting?.source, 'master');
  const applied = applyEffectiveLwfSetting({ components: [component('BASIC_SALARY', 'Basic', 'earning', { fixed_amount: '10000' })] }, setting);
  const calculated = calculateSalaryStructure(applied.input);
  assert.equal(calculated.net_monthly, '9965.00');
  assert.equal(calculated.employer_cost_monthly, '10070.00');
});

test('client-supplied LWF is discarded when no managed LWF setting exists', () => {
  const applied = applyEffectiveLwfSetting({ components: [
    component('BASIC_SALARY', 'Basic', 'earning', { fixed_amount: '10000' }),
    component('EMPLOYEE_LWF', 'Client supplied LWF', 'deduction', { fixed_amount: '9999' }),
  ] }, null);
  const calculated = calculateSalaryStructure(applied.input);
  assert.equal(calculated.deductions_monthly, '0.00');
  assert.equal(calculated.components.some(row => row.code === 'EMPLOYEE_LWF'), false);
});

test('Job Management employees may read effective LWF but cannot manage the master', () => {
  assert.deepEqual(adminEmployeeModules('/lwf-effective/employer-1', 'GET'), ['Job Management']);
  assert.deepEqual(adminEmployeeModules('/lwf-master', 'POST'), []);
});

test('delegated admin employees cannot change the Super Admin LWF master', async t => {
  let writes = 0;
  mock(t, prisma.user, 'findUnique', async () => ({ role: 'admin_employee', accountStatus: 'active' }));
  mock(t, prisma.lwfMasterSetting, 'upsert', async () => { writes += 1; return {}; });
  await assert.rejects(
    () => saveMaster({ user: { id: 'employee-1' }, body: { employee_amount: '10', employer_amount: '20', status: 'active' } } as unknown as Request, responseCapture().response),
    (error) => error instanceof HttpError && error.status === 403,
  );
  assert.equal(writes, 0);
});

test('employer LWF changes are scoped to the authenticated employer', async t => {
  let write: any;
  mock(t, prisma.lwfMasterSetting, 'findUnique', async () => ({ id: 'master-1' }));
  mock(t, prisma.employerLwfSetting, 'upsert', async (args: any) => { write = args; return { id: 'override-1', ...args.create }; });
  await saveEmployerSetting({ user: { id: 'employer-1' }, body: { employee_amount: '45', employer_amount: '90', status: 'active' } } as unknown as Request, responseCapture().response);
  assert.deepEqual(write.where, { employerUserId: 'employer-1' });
  assert.equal(write.create.employerUserId, 'employer-1');
  assert.equal(write.create.employeeAmount.toFixed(2), '45.00');
});

test('salary routes reject missing, wrong-role and inactive users', () => {
  const gate = requireRole('employer');
  for (const user of [undefined, { role: 'super_admin', accountStatus: 'active' }, { role: 'employer', accountStatus: 'blocked' }]) {
    const { response, result } = responseCapture(); let nextCalled = false;
    gate({ user } as Request, response, (() => { nextCalled = true; }) as NextFunction);
    assert.equal(nextCalled, false);
    assert.equal(result().statusCode, 403);
  }
});
