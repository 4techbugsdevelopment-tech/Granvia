import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { destroy } from '../src/controllers/adminEmployerController';
import { prisma } from '../src/prisma';

function mockMethod(t: { after: (fn: () => void) => void }, object: any, key: string, fn: any) {
  const previous = object[key];
  object[key] = fn;
  t.after(() => { object[key] = previous; });
}

function response() {
  return {
    body: undefined as any,
    json(body: any) { this.body = body; return this; },
  };
}

test('deleting an employer revokes access while retaining associate job history', async t => {
  const employerId = '10000000-0000-4000-8000-000000000001';
  const companyId = '10000000-0000-4000-8000-000000000002';
  const subAdminId = '10000000-0000-4000-8000-000000000003';
  const calls: Array<{ model: string; method: string; args: any }> = [];
  const mutation = (model: string, method: string) => async (args: any) => {
    calls.push({ model, method, args });
    return method === 'update' ? { id: employerId, ...args.data } : { count: 1 };
  };

  mockMethod(t, prisma.user, 'findUnique', async () => ({ id: employerId, role: 'employer', accountStatus: 'active' }));
  mockMethod(t, prisma.employerCompany, 'findMany', async () => [{ id: companyId }]);
  mockMethod(t, prisma.subAdminProfile, 'findMany', async () => [{ userId: subAdminId }]);
  for (const [model, method] of [
    ['jobPost', 'updateMany'],
    ['companySite', 'updateMany'],
    ['employerCompany', 'updateMany'],
    ['operationsAssignment', 'updateMany'],
    ['employerWallet', 'updateMany'],
    ['adminEmployerAssignment', 'deleteMany'],
    ['adminCompanyAssignment', 'deleteMany'],
    ['emailOtp', 'deleteMany'],
    ['personalAccessToken', 'deleteMany'],
    ['staffMember', 'updateMany'],
    ['user', 'updateMany'],
    ['user', 'update'],
  ] as const) {
    mockMethod(t, (prisma as any)[model], method, mutation(model, method));
  }
  mockMethod(t, prisma, '$transaction', async (operations: Promise<unknown>[]) => Promise.all(operations));

  const req = { params: { employer: employerId } } as unknown as Request;
  const res = response();
  await destroy(req, res as unknown as Response);

  assert.equal(res.body.message, 'Employer access removed. Associate job history has been retained.');
  assert.deepEqual(calls.find(call => call.model === 'jobPost')?.args.data, { status: 'closed' });
  assert.deepEqual(calls.find(call => call.model === 'employerCompany')?.args.data, { accountStatus: 'inactive' });
  assert.deepEqual(calls.find(call => call.model === 'employerWallet')?.args.data, { status: 'blocked' });
  assert.deepEqual(calls.find(call => call.model === 'user' && call.method === 'update')?.args.data, { accountStatus: 'deleted' });

  const touchedModels = new Set(calls.map(call => call.model));
  for (const retained of ['jobApplication', 'interviewRequest', 'jobOffer', 'agreement', 'attendanceRecord', 'payment']) {
    assert.equal(touchedModels.has(retained), false, `${retained} history must not be deleted or rewritten`);
  }
});
