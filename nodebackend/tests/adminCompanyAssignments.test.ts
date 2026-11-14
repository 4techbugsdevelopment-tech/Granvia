import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { Request, Response } from 'express';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/prisma';
import router from '../src/routes/adminCompanyRoutes';
import { errorHandler } from '../src/middleware/error';
import { assignedCompany, effectiveDepartments } from '../src/services/adminCompanyAccess';
import * as controller from '../src/controllers/adminCompanyController';
import { saveRole } from '../src/controllers/adminEmployeeController';
import { canOpenAdminPage } from '../../frontend/src/web-admin/adminAccess';

const ids = { owner: '10000000-0000-4000-8000-000000000001', employee: '10000000-0000-4000-8000-000000000002', company: '10000000-0000-4000-8000-000000000003', employer: '10000000-0000-4000-8000-000000000004' };
const owner = { id: ids.owner, role: 'super_admin', accountStatus: 'active' };
const user = { id: 'staff-user', role: 'admin_employee', accountStatus: 'active' };
const employer = { id: ids.employer, role: 'employer', accountStatus: 'active' };
const role = { id: 'role', name: 'HR', ownerUserId: owner.id, status: 'active', permissions: '["Company HR"]' };
const employee = { id: ids.employee, userId: user.id, ownerUserId: owner.id, role, user: { accountStatus: 'active' } };
const company = { id: ids.company, employerUserId: employer.id, accountStatus: 'active', companyName: 'Assigned Company', companyEmail: 'company@example.test' };
function mock(t: { after: (fn: () => void) => void }, object: any, method: string, fn: any) {
  const previous = object[method]; object[method] = fn; t.after(() => { object[method] = previous; });
}
function fixtures(t: any, changes: { employee?: any; assignment?: any; employerAssignment?: any; employer?: any; owner?: any } = {}) {
  mock(t, prisma.adminEmployee, 'findUnique', async () => changes.employee ?? employee);
  mock(t, prisma.user, 'findUnique', async ({ where }: any) => where.id === owner.id ? changes.owner ?? owner : changes.employer ?? employer);
  mock(t, prisma.adminCompanyAssignment, 'findFirst', async ({ where }: any) => Object.prototype.hasOwnProperty.call(changes, 'assignment') ? changes.assignment : (where.companyId === company.id && where.department === 'hr' ? { company } : null));
  mock(t, prisma.adminEmployeeCompanyAssignment, 'findUnique', async () => null);
  mock(t, prisma.adminEmployeeCompanyAssignment, 'findMany', async () => []);
  mock(t, prisma.employerCompany, 'findUnique', async ({ where }: any) => where.id === company.id ? company : null);
  mock(t, prisma.adminEmployerAssignment, 'findUnique', async () => changes.employerAssignment ?? null);
}
const req = (department = 'hr', companyId = company.id) => ({ user: { ...user }, params: { company: companyId, department }, body: {} }) as unknown as Request;
function response() { return { body: null as any, statusCode: 200, json(body: any) { this.body = body; return this; }, status(code: number) { this.statusCode = code; return this; }, once() {} } as unknown as Response & { body: any }; }

test('department permissions intersect assignments and never imply platform access', () => {
  assert.deepEqual(effectiveDepartments(['Company HR'], ['hr', 'sales', 'accounts', 'operations', 'unknown']), ['hr']);
  assert.deepEqual(effectiveDepartments(['Hiring Workflow'], ['hr']), []);
  const profile = { role: 'admin_employee', account_status: 'active', admin_permissions: ['Company HR'] } as any;
  assert.equal(canOpenAdminPage(profile, 'company-jobs'), true);
  assert.equal(canOpenAdminPage(profile, 'company-associates'), true);
  assert.equal(canOpenAdminPage(profile, 'company-profile'), false);
  for (const page of ['employers', 'hiring', 'employees', 'company-allocations', 'wallet', 'reports'] as const) assert.equal(canOpenAdminPage(profile, page), false);
});

test('assignment is required for every company and department request', async t => {
  fixtures(t);
  assert.equal((await assignedCompany(req())).company.id, company.id);
  await assert.rejects(assignedCompany(req('hr', 'foreign-company')), /not assigned/);
  await assert.rejects(assignedCompany(req('accounts')), /permission required/);
  await assert.rejects(assignedCompany(req('unknown')), /permission required/);
});

test('removing role permission revokes an existing assignment', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '[]' } } });
  await assert.rejects(assignedCompany(req()), /permission required/);
});

test('checked employer grants every company area allowed by the employee role', async t => {
  fixtures(t, {
    employee: { ...employee, role: { ...role, permissions: '["Company Sales"]' } },
    assignment: null,
    employerAssignment: { id: 'employer-assignment', employeeId: employee.id, employerUserId: employer.id },
  });
  const result = await assignedCompany(req('sales'));
  assert.equal(result.company.id, company.id);
  assert.equal(result.employer.id, employer.id);
  await assert.rejects(assignedCompany(req('accounts')), /permission required/);
});

test('employee company list automatically includes every current company for checked employers', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Sales"]' } } });
  mock(t, prisma.adminCompanyAssignment, 'findMany', async () => []);
  mock(t, prisma.adminEmployerAssignment, 'findMany', async ({ where }: any) => {
    assert.equal(where.employeeId, employee.id); return [{ employerUserId: employer.id }];
  });
  mock(t, prisma.employerCompany, 'findMany', async ({ where }: any) => {
    assert.deepEqual(where, { employerUserId: { in: [employer.id] }, accountStatus: 'active' });
    return [company, { ...company, id: 'future-company', companyName: 'Future Company' }];
  });
  const res = response(); await controller.mine(req('sales'), res);
  assert.deepEqual(res.body.map((row: any) => [row.companyId, row.department]), [[company.id, 'sales'], ['future-company', 'sales']]);
});

test('explicit company assignment expands only the current role departments', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Sales","Company Accounts"]' } } });
  mock(t, prisma.adminCompanyAssignment, 'findMany', async () => []);
  mock(t, prisma.adminEmployeeCompanyAssignment, 'findMany', async () => [{ employeeId: employee.id, companyId: company.id, createdAt: new Date(), company }]);
  mock(t, prisma.adminEmployerAssignment, 'findMany', async () => []);
  const res = response(); await controller.mine(req('sales'), res);
  assert.deepEqual(res.body.map((row: any) => [row.companyId, row.department]), [[company.id, 'sales'], [company.id, 'accounts']]);
});

test('employer employee uses the same department workspace but is limited to one assigned company', async t => {
  const employerEmployeeUser = { id: 'company-staff-user', role: 'employer_employee', accountStatus: 'active' };
  mock(t, prisma.staffMember, 'findUnique', async () => ({
    id: 'company-staff', userId: employerEmployeeUser.id, employerUserId: employer.id, companyId: company.id,
    status: 'Active', roleMaster: { id: 'company-sales-role', status: 'active', permissions: '["Company Sales"]' }, company,
  }));
  mock(t, prisma.user, 'findUnique', async () => employer);
  mock(t, prisma.employerCompany, 'findFirst', async ({ where }: any) => where.id === company.id ? company : null);
  const request = { user: employerEmployeeUser, params: { company: company.id, department: 'sales' } } as unknown as Request;
  const result = await assignedCompany(request);
  assert.equal(result.employee.kind, 'employer_employee');
  assert.equal(result.company.id, company.id);
  await assert.rejects(assignedCompany({ ...request, params: { company: 'foreign-company', department: 'sales' } } as any), /not assigned/);
  await assert.rejects(assignedCompany({ ...request, params: { company: company.id, department: 'accounts' } } as any), /permission required/);
});

for (const [label, changes] of [
  ['inactive role', { employee: { ...employee, role: { ...role, status: 'inactive' } } }],
  ['foreign role owner', { employee: { ...employee, role: { ...role, ownerUserId: 'foreign' } } }],
  ['blocked owner', { owner: { ...owner, accountStatus: 'blocked' } }],
  ['blocked employer', { employer: { ...employer, accountStatus: 'blocked' } }],
  ['inactive company', { assignment: { company: { ...company, accountStatus: 'inactive' } } }],
] as const) test(`${label} denies company access`, async t => {
  fixtures(t, changes); await assert.rejects(assignedCompany(req()), /unavailable|not active/);
});

test('assignment validates employee ownership and department compatibility before writing', async t => {
  let writes = 0;
  mock(t, prisma.adminEmployee, 'findFirst', async ({ where }: any) => { assert.equal(where.ownerUserId, owner.id); return employee; });
  mock(t, prisma.adminCompanyAssignment, 'upsert', async () => { writes++; });
  const request = { user: owner, body: { employee_id: employee.id, company_id: company.id, department: 'accounts' } } as Request;
  await assert.rejects(controller.assign(request, response()), /role allows/); assert.equal(writes, 0);
});

test('assigning repeatedly uses the unique employee-company-department key', async t => {
  mock(t, prisma.adminEmployee, 'findFirst', async () => employee);
  mock(t, prisma.employerCompany, 'findUnique', async () => company);
  mock(t, prisma.user, 'findUnique', async () => employer);
  mock(t, prisma.adminCompanyAssignment, 'upsert', async ({ where, create }: any) => { assert.deepEqual(where.employeeId_companyId_department, create); return { id: 'same-assignment', ...create }; });
  const request = { user: owner, body: { employee_id: employee.id, company_id: company.id, department: 'hr' } } as Request;
  const first = response(), second = response(); await controller.assign(request, first); await controller.assign(request, second);
  assert.equal(first.body.id, second.body.id);
});

test('only the owning Super Admin can remove an assignment', async t => {
  mock(t, prisma.adminCompanyAssignment, 'deleteMany', async ({ where }: any) => { assert.equal(where.employee.ownerUserId, owner.id); return { count: 0 }; });
  await assert.rejects(controller.unassign({ user: owner, params: { assignment: 'foreign' } } as any, response()), /not found/);
});

test('HR cannot update applications from another company or bypass hiring transitions', async t => {
  fixtures(t); mock(t, prisma.jobApplication, 'findFirst', async ({ where }: any) => { assert.equal(where.companyId, company.id); assert.equal(where.job.companyId, company.id); return null; });
  const request = req(); request.params.resource = 'applications'; request.params.record = 'foreign-application'; request.body = { status: 'hired' };
  await assert.rejects(controller.action(request, response()), /not found in this company/);
  request.body = { status: 'accepted' }; await assert.rejects(controller.action(request, response()));
});

test('Sales cannot alter ownership, status or billing fields', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Sales"]' } }, assignment: { company } });
  const request = req('sales'); request.params.resource = 'company'; request.params.record = company.id; request.body = { employer_user_id: 'foreign', billing_address: 'foreign', account_status: 'blocked' };
  await assert.rejects(controller.action(request, response()));
});

test('roles can combine granular company module permissions', async t => {
  let savedPermissions = '';
  mock(t, prisma.adminEmployeeRole, 'create', async ({ data }: any) => {
    savedPermissions = data.permissions;
    return { id: 'mixed-role', description: null, createdAt: new Date(), updatedAt: new Date(), ...data };
  });
  const res = response();
  await saveRole({ user: owner, params: {}, body: { name: 'Jobs and Profile', permissions: ['company.jobs', 'company.profile'], status: 'active' } } as unknown as Request, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(JSON.parse(savedPermissions), ['company.jobs', 'company.profile']);
  assert.deepEqual(res.body.permissions, ['company.jobs', 'company.profile']);
  await assert.rejects(
    saveRole({ user: owner, params: {}, body: { name: 'Legacy platform role', permissions: ['Hiring Workflow'], status: 'active' } } as unknown as Request, response()),
  );
});

test('Sales updates reuse company validation and preserve the true employee actor', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Sales"]' } }, assignment: { company } });
  mock(t, prisma.employerCompany, 'findUnique', async () => company);
  let saved = false;
  mock(t, prisma.employerCompany, 'update', async ({ where, data }: any) => {
    assert.equal(where.id, company.id); assert.deepEqual(data, { companyEmail: 'new@example.test', description: 'Contacted for hiring needs.' });
    saved = true; return { ...company, ...data };
  });
  const request = req('sales'); request.params.resource = 'company'; request.params.record = company.id;
  request.body = { company_email: 'new@example.test', description: 'Contacted for hiring needs.' };
  const res = response(); await controller.action(request, res);
  assert.equal(saved, true); assert.equal(res.body.company_email, 'new@example.test'); assert.equal(request.managedCompanyActorId, user.id);
  assert.equal(request.user!.id, employer.id);
});

test('Operations cannot approve another company attendance or edit its sites', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Operations"]' } }, assignment: { company } });
  for (const [resource, delegate] of [['attendance', prisma.attendanceRecord], ['sites', prisma.companySite]] as const) {
    mock(t, delegate, 'findFirst', async ({ where }: any) => { assert.equal(where.companyId, company.id); assert.equal(where.employerUserId, employer.id); return null; });
    const request = req('operations'); request.params.resource = resource; request.params.record = 'foreign-record';
    await assert.rejects(controller.action(request, response()), /not found in this company/);
  }
});

test('Operations can create a site only inside the assigned company', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Operations"]' } }, assignment: { company } });
  mock(t, prisma.employerCompany, 'findFirst', async ({ where }: any) => {
    assert.deepEqual(where, { id: company.id, employerUserId: employer.id });
    return company;
  });
  mock(t, prisma.companySite, 'create', async ({ data }: any) => {
    assert.equal(data.companyId, company.id);
    assert.equal(data.employerUserId, employer.id);
    return { id: 'site-created', siteName: data.siteName, companyId: data.companyId, employerUserId: data.employerUserId, status: data.status };
  });
  const request = req('operations');
  request.method = 'POST'; request.params.resource = 'sites';
  request.body = { company_id: '20000000-0000-4000-8000-000000000099', site_name: 'Assigned Site', address: 'Assigned address', contact_mobile: '9876543210', status: 'active' };
  const res = response(); await controller.create(request, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.company_id, company.id);
});

test('HR cannot move a managed job to a foreign site', async t => {
  fixtures(t);
  mock(t, prisma.jobPost, 'findFirst', async ({ where }: any) => { assert.equal(where.companyId, company.id); return { id: 'job', ...where }; });
  mock(t, prisma.companySite, 'findFirst', async ({ where }: any) => { assert.equal(where.companyId, company.id); return null; });
  const request = req('hr'); request.params.resource = 'jobs'; request.params.record = 'job'; request.body = { site_id: '20000000-0000-4000-8000-000000000099' };
  await assert.rejects(controller.action(request, response()), /site from the assigned company/);
});

test('HR cannot schedule an interview for another company application', async t => {
  fixtures(t);
  mock(t, prisma.jobApplication, 'findFirst', async ({ where }: any) => { assert.equal(where.companyId, company.id); assert.equal(where.job.companyId, company.id); return null; });
  const request = req('hr'); request.params.resource = 'applications'; request.params.record = 'foreign-application'; request.params.operation = 'schedule-interview'; request.body = { remarks: 'Tomorrow at 10 AM' };
  await assert.rejects(controller.operation(request, response()), /not found in this company/);
});

test('Operations cannot delete a site outside the assigned company', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Operations"]' } }, assignment: { company } });
  mock(t, prisma.companySite, 'findFirst', async ({ where }: any) => { assert.equal(where.companyId, company.id); assert.equal(where.employerUserId, employer.id); return null; });
  const request = req('operations'); request.params.resource = 'sites'; request.params.record = 'foreign-site';
  await assert.rejects(controller.destroy(request, response()), /not found in this company/);
});

test('Accounts cannot access attendance actions or change company contacts', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Accounts"]' } }, assignment: { company } });
  const request = req('accounts'); request.params.resource = 'attendance'; request.params.record = 'record';
  await assert.rejects(controller.action(request, response()), /unavailable/);
  request.params.resource = 'company'; request.params.record = company.id; request.body = { company_email: 'foreign@example.test' };
  await assert.rejects(controller.action(request, response()));
});

test('granular HR modules do not grant their sibling page or data', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["company.jobs"]' } } });
  mock(t, prisma.jobPost, 'findMany', async () => []);
  mock(t, prisma.companySite, 'findMany', async () => []);
  mock(t, prisma.associateType, 'findMany', async () => []);
  const jobsRequest = req('hr'); jobsRequest.query = { module: 'company.jobs' };
  const jobsResponse = response(); await controller.workspace(jobsRequest, jobsResponse);
  assert.deepEqual(jobsResponse.body.jobs, []);
  assert.equal(jobsResponse.body.applications, undefined);
  const associatesRequest = req('hr'); associatesRequest.query = { module: 'company.associates' };
  await assert.rejects(controller.workspace(associatesRequest, response()), /module is not assigned/);
});

test('HR workspace scopes both application and job to the assigned company and exposes only associate names', async t => {
  fixtures(t);
  mock(t, prisma.jobPost, 'findMany', async ({ where }: any) => { assert.deepEqual(where, { companyId: company.id, employerUserId: employer.id }); return []; });
  mock(t, prisma.companySite, 'findMany', async ({ where }: any) => { assert.deepEqual(where, { companyId: company.id, employerUserId: employer.id }); return []; });
  mock(t, prisma.associateType, 'findMany', async () => []);
  mock(t, prisma.jobApplication, 'findMany', async ({ where }: any) => {
    assert.equal(where.companyId, company.id); assert.equal(where.job.companyId, company.id); assert.equal(where.job.employerUserId, employer.id);
    return [{ id: 'application', guardUserId: 'associate-1', job: { title: 'Security' } }];
  });
  mock(t, prisma.user, 'findMany', async ({ where, select }: any) => {
    assert.deepEqual(where.id.in, ['associate-1']); assert.deepEqual(select, { id: true, fullName: true });
    return [{ id: 'associate-1', fullName: 'Associate One' }];
  });
  const res = response(); await controller.workspace(req(), res);
  assert.equal(res.body.applications[0].associateName, 'Associate One'); assert.equal(res.body.invoices, undefined);
});

test('Accounts invoice reads always retain company and employer scope', async t => {
  fixtures(t, { employee: { ...employee, role: { ...role, permissions: '["Company Accounts"]' } }, assignment: { company } });
  mock(t, prisma.invoice, 'findMany', async ({ where }: any) => { assert.deepEqual(where, { companyId: company.id, employerUserId: employer.id }); return [{ id: 'invoice', totalAmount: '100.00' }]; });
  const res = response(); await controller.workspace(req('accounts'), res);
  assert.equal(res.body.invoices.length, 1); assert.equal(res.body.wallet, undefined); assert.equal(res.body.applications, undefined);
});

test('real HTTP guards deny allocation to employees and enforce assignment removal immediately', async t => {
  fixtures(t);
  mock(t, prisma.personalAccessToken, 'findUnique', async () => ({ id: 1n, tokenableId: user.id, tokenableType: 'App\\Models\\User', expiresAt: null }));
  mock(t, prisma.personalAccessToken, 'update', async () => ({}));
  mock(t, prisma.user, 'findUnique', async ({ where }: any) => where.id === user.id ? user : where.id === owner.id ? owner : employer);
  let assigned = true;
  mock(t, prisma.adminEmployee, 'findUnique', async () => ({ ...employee, role: { ...role, permissions: '["Company Sales"]' } }));
  mock(t, prisma.adminCompanyAssignment, 'findFirst', async ({ where }: any) => assigned && where.companyId === company.id && where.department === 'sales' ? { company } : null);
  const app = express(); app.use(express.json()); app.use('/api', router); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const headers = { Authorization: 'Bearer 1|test' };
  assert.equal((await fetch(`${base}/company-allocations`, { headers })).status, 403);
  assert.equal((await fetch(`${base}/managed-companies/${company.id}/sales`)).status, 401);
  const valid = await fetch(`${base}/managed-companies/${company.id}/sales`, { headers }); assert.equal(valid.status, 200);
  const body = await valid.json() as any; assert.equal(body.company.companyName, company.companyName); assert.equal(body.company.employerUserId, undefined);
  assert.equal((await fetch(`${base}/managed-companies/foreign/sales`, { headers })).status, 403);
  assert.equal((await fetch(`${base}/managed-companies/${company.id}/accounts`, { headers })).status, 403);
  assigned = false; assert.equal((await fetch(`${base}/managed-companies/${company.id}/sales`, { headers })).status, 403);
});
