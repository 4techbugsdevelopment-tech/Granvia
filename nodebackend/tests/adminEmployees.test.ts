import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../src/prisma';
import { requireAdminPanel } from '../src/middleware/adminPanel';
import { adminEmployeeSession } from '../src/services/adminEmployeeSession';
import * as controller from '../src/controllers/adminEmployeeController';
import { hashPassword, verifyPassword } from '../src/utils/password';
import { login } from '../src/controllers/authController';
import { env } from '../src/config/env';
import { asyncHandler } from '../src/utils/http';
import { parseAdminPermissions } from '../src/utils/adminEmployeeAccess';
import { serializeUser } from '../src/serializers/userSerializer';
import { canOpenAdminPage } from '../../frontend/src/web-admin/adminAccess';
import { withAdminEmployeeStorage } from '../src/services/adminEmployeeStorage';

// Prisma delegates expose methods through a Proxy rather than own descriptors.
function mockMethod(t: { after: (fn: () => void) => void }, object: any, key: string, fn: any) {
  const previous = object[key];
  object[key] = fn;
  t.after(() => { object[key] = previous; });
  return { mock: { mockImplementation(next: any) { object[key] = next; } } };
}

const ownerId = '10000000-0000-4000-8000-000000000001';
const roleId = '10000000-0000-4000-8000-000000000002';
const employeeId = '10000000-0000-4000-8000-000000000003';
const owner = { id: ownerId, role: 'super_admin', accountStatus: 'active' };
const role = { id: roleId, ownerUserId: ownerId, name: 'Attendance Clerk', status: 'active', permissions: '["Attendance"]' };
const employee = { id: employeeId, userId: 'employee-user', ownerUserId: ownerId, roleId, role };
const user = { id: 'employee-user', role: 'admin_employee', accountStatus: 'active' };
function response() {
  return { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; }, set() { return this; } };
}
function request(path = '/attendance', method = 'GET', actor: any = user) {
  return { user: { ...actor }, path, method, params: {}, body: {} } as unknown as Request;
}
async function gate(req: Request) {
  const res = response(); let allowed = false;
  await requireAdminPanel(req, res as unknown as Response, (() => { allowed = true; }) as NextFunction);
  return { ...res, allowed };
}

test('employee can use only assigned modules, including direct API calls and writes', async t => {
  mockMethod(t, prisma.adminEmployee, 'findUnique', async () => employee);
  mockMethod(t, prisma.user, 'findUnique', async () => owner);
  for (const method of ['GET', 'PATCH']) {
    const req = request('/attendance/record/status', method);
    assert.equal((await gate(req)).allowed, true);
    assert.equal(req.user?.role, 'super_admin');
    assert.equal(user.role, 'admin_employee'); // Never change the persisted user.
    assert.equal((await gate(request('/wallets', method))).statusCode, 403);
  }
  for (const path of ['/employees', '/employee-roles', '/roles', '/internal-staff', '/unregistered-module', '/employers/id/wallet-credit']) {
    assert.equal((await gate(request(path, 'POST'))).statusCode, 403, path);
  }
});

test('inactive roles and inactive owners stop existing employee access', async t => {
  const employeeMock = mockMethod(t, prisma.adminEmployee, 'findUnique', async () => ({ ...employee, role: { ...role, status: 'inactive' } }));
  const ownerMock = mockMethod(t, prisma.user, 'findUnique', async () => owner);
  assert.equal((await gate(request())).statusCode, 403);
  await assert.rejects(adminEmployeeSession(user), /unavailable/);
  employeeMock.mock.mockImplementation(async () => employee);
  ownerMock.mock.mockImplementation(async () => ({ ...owner, accountStatus: 'blocked' }));
  assert.equal((await gate(request())).statusCode, 403);
  await assert.rejects(adminEmployeeSession(user), /unavailable/);
});

test('blocked employees, other portal roles, missing assignments and cross-owner roles cannot enter admin', async t => {
  mockMethod(t, prisma.adminEmployee, 'findUnique', async () => null);
  mockMethod(t, prisma.user, 'findUnique', async () => owner);
  assert.equal((await gate(request())).statusCode, 403);
  assert.equal((await gate(request('/attendance', 'GET', { ...user, accountStatus: 'blocked' }))).statusCode, 403);
  assert.equal((await gate(request('/attendance', 'GET', { ...user, role: 'employer' }))).statusCode, 403);
  assert.equal((await gate(request('/employees', 'POST', owner))).allowed, true);
});

test('permission updates are read afresh and malformed permissions fail closed', async t => {
  const assignment = mockMethod(t, prisma.adminEmployee, 'findUnique', async () => employee);
  mockMethod(t, prisma.user, 'findUnique', async () => owner);
  assert.equal((await gate(request())).allowed, true);
  assignment.mock.mockImplementation(async () => ({ ...employee, role: { ...role, permissions: '["Reports"]' } }));
  assert.equal((await gate(request())).statusCode, 403);
  assert.equal((await gate(request('/reports/attendance'))).allowed, true);
  assignment.mock.mockImplementation(async () => ({ ...employee, role: { ...role, ownerUserId: 'someone-else' } }));
  assert.equal((await gate(request('/reports/attendance'))).statusCode, 403);
  assert.deepEqual(parseAdminPermissions('{broken'), []);
  assert.deepEqual(parseAdminPermissions('["Super Admin Employees","Attendance",1]'), ['Attendance']);
});

test('employee creation stores a hashed password and a separate login identity', async t => {
  let createdUser: any; let createdEmployee: any;
  mockMethod(t, prisma.adminEmployeeRole, 'findFirst', async () => role);
  mockMethod(t, prisma.user, 'findFirst', async () => null);
  mockMethod(t, prisma, '$transaction', async (callback: any) => callback({
    user: { create: async ({ data }: any) => { createdUser = data; return { ...data, id: 'created-user' }; } },
    adminEmployee: { create: async ({ data }: any) => { createdEmployee = data; return data; } },
  }));
  const req = request('/employees', 'POST', owner);
  req.body = { full_name: 'Example Employee', email: 'EMPLOYEE@example.com', mobile: '+91 98765 43210', password: 'ExamplePass123!', role_id: roleId, account_status: 'active' };
  const res = response();
  await controller.saveEmployee(req, res as unknown as Response);
  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.role, 'admin_employee');
  assert.equal(createdUser.email, 'employee@example.com');
  assert.equal(createdUser.mobile, '9876543210');
  assert.notEqual(createdUser.password, req.body.password);
  assert.equal(await verifyPassword(req.body.password, createdUser.password), true);
  assert.equal(createdEmployee.ownerUserId, ownerId);
  assert.equal(createdEmployee.roleId, roleId);
  assert.ok(!JSON.stringify(res.body).includes(req.body.password));
});

test('employee cannot be assigned another owners role and cannot use a weak password', async t => {
  let query: any;
  mockMethod(t, prisma.adminEmployeeRole, 'findFirst', async (args: any) => { query = args; return null; });
  const req = request('/employees', 'POST', owner);
  req.body = { full_name: 'Example Employee', email: 'employee@example.com', mobile: '9876543210', password: 'ExamplePass123!', role_id: roleId, account_status: 'active' };
  await assert.rejects(controller.saveEmployee(req, response() as unknown as Response), /available Super Admin role/);
  assert.equal(query.where.ownerUserId, ownerId);
  assert.equal(query.where.status, 'active');
  req.body.password = 'weak';
  await assert.rejects(controller.saveEmployee(req, response() as unknown as Response));
});

test('employee edit without password preserves hash; resetting password revokes sessions', async t => {
  let userUpdate: any; let revocations = 0;
  mockMethod(t, prisma.adminEmployee, 'findFirst', async () => employee);
  mockMethod(t, prisma.adminEmployeeRole, 'findFirst', async () => role);
  mockMethod(t, prisma.user, 'findFirst', async () => null);
  mockMethod(t, prisma, '$transaction', async (callback: any) => callback({
    user: { update: async ({ data }: any) => { userUpdate = data; } },
    adminEmployee: { update: async () => ({}) },
    personalAccessToken: { deleteMany: async ({ where }: any) => { assert.equal(where.tokenableId, employee.userId); revocations++; } },
  }));
  const req = request('/employees', 'PATCH', owner); req.params.employee = employeeId;
  req.body = { full_name: 'Updated Employee', email: 'employee@example.com', mobile: '9876543210', role_id: roleId, account_status: 'active' };
  await controller.saveEmployee(req, response() as unknown as Response);
  assert.ok(!('password' in userUpdate)); assert.equal(revocations, 0);
  req.body.password = 'UpdatedPass123!';
  await controller.saveEmployee(req, response() as unknown as Response);
  assert.equal(await verifyPassword(req.body.password, userUpdate.password), true); assert.equal(revocations, 1);
  delete req.body.password; req.body.account_status = 'blocked';
  await controller.saveEmployee(req, response() as unknown as Response);
  assert.equal(revocations, 2);
});

test('cross-owner employee edit and delete are rejected before mutation', async t => {
  let query: any;
  mockMethod(t, prisma.adminEmployee, 'findFirst', async (args: any) => { query = args; return null; });
  const req = request('/employees', 'DELETE', owner); req.params.employee = employeeId;
  await assert.rejects(controller.deleteEmployee(req, response() as unknown as Response), /not found/);
  await assert.rejects(controller.saveEmployee(req, response() as unknown as Response), /not found/);
  assert.equal(query.where.ownerUserId, ownerId);
});

test('assigned role deletion is rejected', async t => {
  mockMethod(t, prisma.adminEmployeeRole, 'findFirst', async () => role);
  mockMethod(t, prisma.adminEmployee, 'count', async () => 1);
  const req = request('/employee-roles', 'DELETE', owner); req.params.role = roleId;
  await assert.rejects(controller.deleteRole(req, response() as unknown as Response), /Reassign employees/);
});

test('deleting an employee removes tokens, assignment and login in one transaction', async t => {
  const calls: string[] = [];
  mockMethod(t, prisma.adminEmployee, 'findFirst', async () => employee);
  mockMethod(t, prisma, '$transaction', async (callback: any) => callback({
    personalAccessToken: { deleteMany: async () => calls.push('tokens') },
    adminCompanyAssignment: { deleteMany: async () => calls.push('company-assignments') },
    adminEmployee: { delete: async () => calls.push('assignment') },
    user: { delete: async () => calls.push('user') },
  }));
  const req = request('/employees', 'DELETE', owner); req.params.employee = employeeId;
  await controller.deleteEmployee(req, response() as unknown as Response);
  assert.deepEqual(calls, ['tokens', 'company-assignments', 'assignment', 'user']);
});

test('session exposes effective modules and role name without a password', async t => {
  mockMethod(t, prisma.adminEmployee, 'findUnique', async () => employee);
  mockMethod(t, prisma.user, 'findUnique', async () => owner);
  const session = serializeUser(await adminEmployeeSession({ ...user, password: 'DO NOT EXPOSE' }));
  assert.equal(session.role, 'admin_employee');
  assert.deepEqual(session.admin_permissions, ['Attendance']);
  assert.equal(session.admin_role_name, role.name);
  assert.ok(!JSON.stringify(session).includes('DO NOT EXPOSE'));
});

test('employee uses the existing web admin password login and cannot use another portal', async t => {
  const password = 'ExampleLogin123!';
  mockMethod(t, prisma.user, 'findUnique', async ({ where }: any) => where.id === ownerId ? owner : { ...user, email: 'employee@example.com', password: await hashPassword(password), emailVerifiedAt: new Date() });
  mockMethod(t, prisma.adminEmployee, 'findUnique', async () => employee);
  let issued = 0;
  mockMethod(t, prisma.personalAccessToken, 'create', async () => { issued++; return { id: 12n }; });
  const previousOtp = env.loginOtpEnabled;
  env.loginOtpEnabled = false;
  t.after(() => { env.loginOtpEnabled = previousOtp; });
  const req = request(); req.body = { email: 'employee@example.com', password, role: 'super_admin' };
  const res = response();
  await login(req, res as unknown as Response);
  assert.equal(issued, 1);
  assert.equal(res.body.user.role, 'admin_employee');
  assert.deepEqual(res.body.user.admin_permissions, ['Attendance']);
  assert.ok(res.body.token.startsWith('12|'));
  assert.ok(!JSON.stringify(res.body).includes(password));
  req.body.role = 'employer';
  await assert.rejects(login(req, response() as unknown as Response), /not registered for this portal/);
  assert.equal(issued, 1);
});

test('mounted HTTP admin guard checks the module before projecting the employee role', async t => {
  mockMethod(t, prisma.adminEmployee, 'findUnique', async () => employee);
  mockMethod(t, prisma.user, 'findUnique', async () => owner);
  const app = express();
  app.use((req, _res, next) => { req.user = { ...user } as any; next(); });
  app.use('/admin', asyncHandler(requireAdminPanel));
  app.get('/admin/attendance', (req, res) => res.json({ effectiveRole: req.user!.role }));
  app.post('/admin/employees', (_req, res) => res.json({ unexpected: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const allowed = await fetch(`${base}/admin/attendance`);
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { effectiveRole: 'super_admin' });
  const forbidden = await fetch(`${base}/admin/employees`, { method: 'POST' });
  assert.equal(forbidden.status, 403);
});

test('role CRUD retains ownership and normalizes module grants', async t => {
  let payload: any;
  mockMethod(t, prisma.adminEmployeeRole, 'findFirst', async ({ where }: any) => { assert.equal(where.ownerUserId, ownerId); return role; });
  mockMethod(t, prisma.adminEmployeeRole, 'create', async ({ data }: any) => { payload = data; return { id: roleId, ...data }; });
  mockMethod(t, prisma.adminEmployeeRole, 'update', async ({ data }: any) => { payload = data; return { ...role, ...data }; });
  mockMethod(t, prisma.adminEmployeeRole, 'delete', async () => role);
  mockMethod(t, prisma.adminEmployee, 'count', async () => 0);
  const req = request('/employee-roles', 'POST', owner);
  req.body = { name: '  Attendance Clerk  ', permissions: ['Attendance', 'Attendance'], status: 'active' };
  const res = response();
  await controller.saveRole(req, res as unknown as Response);
  assert.equal(payload.ownerUserId, ownerId);
  assert.equal(payload.name, 'Attendance Clerk');
  assert.equal(payload.permissions, '["Attendance"]');
  assert.deepEqual(res.body.permissions, ['Attendance']);
  req.params.role = roleId; req.body.status = 'inactive';
  await controller.saveRole(req, response() as unknown as Response);
  assert.equal(payload.status, 'inactive');
  assert.ok(!('ownerUserId' in payload));
  await controller.deleteRole(req, response() as unknown as Response);
});

test('employee list queries only owned assignments and public user fields', async t => {
  let query: any;
  mockMethod(t, prisma.adminEmployee, 'findMany', async (args: any) => { query = args; return [{ ...employee, user: { fullName: 'Employee', email: 'employee@example.com', mobile: '9876543210', accountStatus: 'active' } }]; });
  const res = response();
  await controller.employees(request('/employees', 'GET', owner), res as unknown as Response);
  assert.equal(query.where.ownerUserId, ownerId);
  assert.deepEqual(Object.keys(query.include.user.select).sort(), ['accountStatus', 'email', 'fullName', 'mobile']);
  assert.deepEqual(res.body[0].permissions, ['Attendance']);
});

test('frontend menu and page guard deny unassigned modules and management screens', () => {
  const profile: any = { role: 'admin_employee', account_status: 'active', admin_permissions: ['Attendance', 'Job Management'] };
  assert.equal(canOpenAdminPage(profile, 'attendance'), true);
  assert.equal(canOpenAdminPage(profile, 'jobs'), true);
  for (const page of ['employees', 'employee-roles', 'roles', 'settings', 'dashboard', 'wallet', 'reports'] as const) assert.equal(canOpenAdminPage(profile, page), false);
  assert.equal(canOpenAdminPage({ ...profile, account_status: 'blocked' }, 'attendance'), false);
  assert.equal(canOpenAdminPage({ ...profile, role: 'super_admin' }, 'employees'), true);
  assert.equal(canOpenAdminPage(null, 'dashboard'), false);
});

test('stale generated client returns a deployment error rather than undefined.findMany', async t => {
  mockMethod(t, prisma, 'adminEmployeeRole', undefined);
  let called = false;
  const handler = withAdminEmployeeStorage(async () => { called = true; });
  await assert.rejects(handler(request('/employee-roles', 'GET', owner), response() as any), (error: any) => error.status === 503 && /Prisma Client/.test(error.message));
  assert.equal(called, false);
});

test('missing employee schema returns unavailable rather than a successful empty list', async () => {
  for (const code of ['P2021', 'P2022']) {
    const handler = withAdminEmployeeStorage(async () => { throw Object.assign(new Error('database setup missing'), { code }); });
    await assert.rejects(handler(request(), response() as any), (error: any) => error.status === 503 && /20261023120000_super_admin_employees/.test(error.message));
  }
});

test('employee storage wrapper preserves successful results and unrelated errors', async () => {
  const handler = withAdminEmployeeStorage(async () => 'ready');
  assert.equal(await handler(request(), response() as any), 'ready');
  const original = new Error('unrelated');
  const failing = withAdminEmployeeStorage(async () => { throw original; });
  await assert.rejects(failing(request(), response() as any), error => error === original);
});
