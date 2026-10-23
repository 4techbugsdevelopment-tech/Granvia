import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
import { prisma } from '../src/prisma';
import { applyAdminEmployerAccess } from '../src/services/adminEmployerAccess';
import { requireAuth } from '../src/middleware/auth';
import { requireRole } from '../src/middleware/role';
import { asyncHandler } from '../src/utils/http';
import { errorHandler } from '../src/middleware/error';
import { logout, me } from '../src/controllers/authController';
import { initializeAdminEmployerAccess, getAdminEmployerId, exitAdminEmployerAccess, adminEmployerUrl } from '../../frontend/src/lib/adminEmployerAccess';

const actor = { id: '10000000-0000-4000-8000-000000000001', role: 'super_admin', fullName: 'Super Admin', accountStatus: 'active' };
const employer = { id: '10000000-0000-4000-8000-000000000002', role: 'employer', fullName: 'Example Employer', accountStatus: 'active', password: 'SECRET HASH' };
const otherEmployer = { ...employer, id: '10000000-0000-4000-8000-000000000003', fullName: 'Other Employer' };
function mockMethod(t: { after: (fn: () => void) => void }, object: any, key: string, fn: any) {
  const previous = object[key]; object[key] = fn;
  t.after(() => { object[key] = previous; });
  return { replace(next: any) { object[key] = next; } };
}
function req(path = '/api/employer/companies', user: any = actor, target: string | undefined = employer.id) {
  return { originalUrl: path, user: { ...user }, header: (name: string) => name.toLowerCase() === 'x-admin-employer-id' ? target : undefined } as unknown as Request;
}

test('ordinary requests retain the original account and do not load another user', async t => {
  let reads = 0;
  mockMethod(t, prisma.user, 'findFirst', async () => { reads++; return employer; });
  const request = req('/api/auth/me');
  request.header = (() => undefined) as any;
  await applyAdminEmployerAccess(request);
  assert.equal(request.user!.id, actor.id); assert.equal(request.adminEmployerAccess, undefined); assert.equal(reads, 0);
});

test('active Super Admin gets employer scope and keeps the true actor separately', async t => {
  let lookup: any;
  mockMethod(t, prisma.user, 'findFirst', async (args: any) => { lookup = args; return employer; });
  const request = req();
  await applyAdminEmployerAccess(request);
  assert.deepEqual(lookup.where, { id: employer.id, role: 'employer' });
  assert.equal(request.user!.id, employer.id); assert.equal(request.user!.role, 'employer');
  assert.equal(request.adminEmployerAccess!.actor_id, actor.id);
  assert.equal(request.adminEmployerAccess!.employer_id, employer.id);
  assert.equal(actor.role, 'super_admin');
});

test('Super Admin may manage blocked employers without changing their saved account status', async t => {
  const blocked = { ...employer, accountStatus: 'blocked' };
  mockMethod(t, prisma.user, 'findFirst', async () => blocked);
  const request = req(); await applyAdminEmployerAccess(request);
  assert.equal(request.user!.accountStatus, 'active');
  assert.equal(request.adminEmployerAccess!.employer_status, 'blocked');
  assert.equal(blocked.accountStatus, 'blocked');
});

test('employers, staff and other roles cannot request direct employer access', async () => {
  for (const role of ['employer', 'admin_employee', 'sub_admin', 'sales_executive', 'operations', 'finance', 'guard']) {
    await assert.rejects(applyAdminEmployerAccess(req('/api/employer/companies', { ...actor, role })), /Only an active Super Admin/);
  }
  for (const accountStatus of ['inactive', 'blocked', 'pending']) await assert.rejects(applyAdminEmployerAccess(req('/api/employer/companies', { ...actor, accountStatus })), /Only an active Super Admin/);
});

test('missing/invalid targets and requests outside employer/self APIs fail closed', async t => {
  mockMethod(t, prisma.user, 'findFirst', async () => null);
  await assert.rejects(applyAdminEmployerAccess(req()), /not found/);
  await assert.rejects(applyAdminEmployerAccess(req('/api/auth/me', actor, 'invalid-id')));
  for (const path of ['/api/admin/employers', '/api/finance/withdrawals', '/api/guard/profile', '/api/auth/login', '/api/employer-other', '/api/me-other']) {
    await assert.rejects(applyAdminEmployerAccess(req(path)), /limited to the employer workspace/);
  }
});

test('auth/me serializes selected employer and admin access without revealing credentials', async t => {
  mockMethod(t, prisma.user, 'findFirst', async () => employer);
  mockMethod(t, prisma.employerProfile, 'findUnique', async ({ where }: any) => { assert.equal(where.userId, employer.id); return { userId: employer.id, contactPersonName: employer.fullName }; });
  const request = req('/api/auth/me'); await applyAdminEmployerAccess(request);
  let body: any;
  await me(request, { json(value: any) { body = value; } } as any);
  assert.equal(body.user.id, employer.id); assert.equal(body.user.role, 'employer');
  assert.equal(body.user.admin_employer_access.actor_id, actor.id);
  assert.ok(!JSON.stringify(body).includes('SECRET HASH'));
});

test('workspace logout never revokes the Super Admin token; normal logout still does', async t => {
  let revoked = 0;
  mockMethod(t, prisma.personalAccessToken, 'deleteMany', async () => { revoked++; return { count: 1 }; });
  const request = req('/api/auth/logout');
  request.header = ((name: string) => name === 'authorization' ? 'Bearer 1|example' : employer.id) as any;
  const res = { json() {} } as any;
  await logout(request, res); assert.equal(revoked, 0);
  request.header = ((name: string) => name === 'authorization' ? 'Bearer 1|example' : undefined) as any;
  await logout(request, res); assert.equal(revoked, 1);
});

test('HTTP requests use separate employer scopes with the same unchanged admin token', async t => {
  const token = mockMethod(t, prisma.personalAccessToken, 'findUnique', async () => ({ tokenableId: actor.id, tokenableType: 'App\\Models\\User', id: 1n, expiresAt: null }));
  mockMethod(t, prisma.personalAccessToken, 'update', async () => ({}));
  const actorQuery = mockMethod(t, prisma.user, 'findUnique', async () => actor);
  mockMethod(t, prisma.user, 'findFirst', async ({ where }: any) => where.id === employer.id ? employer : where.id === otherEmployer.id ? otherEmployer : null);
  const app = express();
  app.use('/api', asyncHandler(requireAuth));
  app.get('/api/employer/companies', requireRole('employer'), (request, response) => response.json({ employer_id: request.user!.id, actor_id: request.adminEmployerAccess?.actor_id }));
  app.get('/api/admin/employers', requireRole('super_admin'), (request, response) => response.json({ admin_id: request.user!.id }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { Authorization: 'Bearer 1|same-admin-token' };
  for (const target of [employer, otherEmployer]) {
    const response = await fetch(`${base}/api/employer/companies`, { headers: { ...headers, 'X-Admin-Employer-Id': target.id } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { employer_id: target.id, actor_id: actor.id });
  }
  const originalTab = await fetch(`${base}/api/admin/employers`, { headers });
  assert.equal(originalTab.status, 200); assert.deepEqual(await originalTab.json(), { admin_id: actor.id });
  assert.equal((await fetch(`${base}/api/admin/employers`, { headers: { ...headers, 'X-Admin-Employer-Id': employer.id } })).status, 403);
  actorQuery.replace(async () => ({ ...actor, accountStatus: 'blocked' }));
  assert.equal((await fetch(`${base}/api/employer/companies`, { headers: { ...headers, 'X-Admin-Employer-Id': employer.id } })).status, 403);
  actorQuery.replace(async () => actor);
  token.replace(async () => null);
  assert.equal((await fetch(`${base}/api/employer/companies`, { headers: { ...headers, 'X-Admin-Employer-Id': employer.id } })).status, 401);
});

test('tab scope survives reload, isolates two employers and never writes the shared login', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const previousLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const sharedLogin = new Map([['granvia_api_token', 'unchanged-super-admin-token']]);
  const makeTab = (url: string) => {
    const storage = new Map<string, string>();
    const location = new URL(url);
    let destination = '';
    const tab = { location: { pathname: location.pathname, href: location.href, replace(value: string) { destination = value; } }, history: { replaceState(_state: unknown, _title: string, value: string) { const next = new URL(value, location.origin); tab.location.href = next.href; tab.location.pathname = next.pathname; } } };
    return { tab, storage, destination: () => destination };
  };
  const select = (tab: ReturnType<typeof makeTab>) => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: tab.tab });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => tab.storage.get(key) ?? null, setItem: (key: string, value: string) => tab.storage.set(key, value), removeItem: (key: string) => tab.storage.delete(key) } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => sharedLogin.get(key), setItem() { throw new Error('Shared login must not change'); }, removeItem() { throw new Error('Shared login must not change'); } } });
  };
  try {
    const original = makeTab('https://example.test/admin/employers'); select(original); initializeAdminEmployerAccess(); assert.equal(getAdminEmployerId(), null);
    const first = makeTab(`https://example.test${adminEmployerUrl(employer.id)}`); select(first); initializeAdminEmployerAccess(); assert.equal(getAdminEmployerId(), employer.id);
    assert.ok(!first.tab.location.href.includes('admin_employer')); initializeAdminEmployerAccess(); assert.equal(getAdminEmployerId(), employer.id);
    const second = makeTab(`https://example.test${adminEmployerUrl(otherEmployer.id)}`); select(second); initializeAdminEmployerAccess(); assert.equal(getAdminEmployerId(), otherEmployer.id);
    select(first); assert.equal(getAdminEmployerId(), employer.id); exitAdminEmployerAccess(); assert.equal(getAdminEmployerId(), null); assert.equal(first.destination(), '/admin/employers');
    select(second); assert.equal(getAdminEmployerId(), otherEmployer.id);
    select(original); assert.equal(getAdminEmployerId(), null); assert.equal(sharedLogin.get('granvia_api_token'), 'unchanged-super-admin-token');
  } finally {
    for (const [key, descriptor] of [['window', previousWindow], ['sessionStorage', previousSession], ['localStorage', previousLocal]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
