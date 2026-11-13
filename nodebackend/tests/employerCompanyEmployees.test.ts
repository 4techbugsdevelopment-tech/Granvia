import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { prisma } from '../src/prisma';
import * as controller from '../src/controllers/employerTeamController';
import { verifyPassword } from '../src/utils/password';

const employerId = '10000000-0000-4000-8000-000000000001';
const companyId = '10000000-0000-4000-8000-000000000002';
const roleId = '10000000-0000-4000-8000-000000000003';
const memberId = '10000000-0000-4000-8000-000000000004';
const userId = '10000000-0000-4000-8000-000000000005';
const role = { id: roleId, name: 'Company Sales', status: 'active', permissions: '["Company Sales"]' };
const company = { id: companyId, employerUserId: employerId, companyName: 'Client Company', accountStatus: 'active' };

function mock(t: { after: (fn: () => void) => void }, object: any, method: string, fn: any) {
  const previous = object[method]; object[method] = fn; t.after(() => { object[method] = previous; });
}
function response() {
  return { body: null as any, statusCode: 200, json(body: any) { this.body = body; return this; }, status(code: number) { this.statusCode = code; return this; } } as Response & { body: any; statusCode: number };
}

test('Employer creates a real company employee login tied to one company and role', async t => {
  let createdUser: any; let createdMember: any;
  mock(t, prisma.role, 'findUnique', async () => role);
  mock(t, prisma.employerCompany, 'findFirst', async () => company);
  mock(t, prisma.user, 'findFirst', async () => null);
  mock(t, prisma, '$transaction', async (work: any) => work({
    user: { create: async ({ data }: any) => { createdUser = data; return { id: userId, ...data }; } },
    staffMember: { create: async ({ data }: any) => { createdMember = data; return { id: memberId, ...data }; } },
  }));
  mock(t, prisma.staffMember, 'findUnique', async () => ({ id: memberId, ...createdMember, roleMaster: role, company, user: { accountStatus: 'active' } }));
  const req = { user: { id: employerId }, body: { name: 'Company User', email: 'company.user@example.com', mobile: '9876543210', password: 'Aa1!xy', role_id: roleId, company_id: companyId, status: 'Active' } } as unknown as Request;
  const res = response();
  await controller.storeStaff(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.role, 'employer_employee');
  assert.equal(await verifyPassword('Aa1!xy', createdUser.password), true);
  assert.equal(createdMember.employerUserId, employerId);
  assert.equal(createdMember.companyId, companyId);
  assert.equal(createdMember.roleId, roleId);
  assert.equal(res.body.staff.company_name, company.companyName);
});

test('removing company staff archives the record and revokes its login', async t => {
  const calls: string[] = [];
  mock(t, prisma.staffMember, 'findUnique', async () => ({ id: memberId, subAdminUserId: employerId, userId }));
  mock(t, prisma, '$transaction', async (work: any) => work({
    staffMember: { update: async ({ data }: any) => { calls.push(`staff:${data.status}`); } },
    personalAccessToken: { deleteMany: async () => { calls.push('tokens:deleted'); } },
    user: { update: async ({ data }: any) => { calls.push(`user:${data.accountStatus}`); } },
  }));
  const req = { user: { id: employerId }, params: { staff: memberId } } as unknown as Request;
  const res = response();
  await controller.destroyStaff(req, res);
  assert.deepEqual(calls, ['staff:Inactive', 'tokens:deleted', 'user:inactive']);
  assert.match(res.body.message, /archived/i);
});
