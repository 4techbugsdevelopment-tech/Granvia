import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/prisma';
import { replacePasswordAndRevokeSessions } from '../src/controllers/authController';
import { verifyPassword } from '../src/utils/password';

function mockMethod(t: { after: (fn: () => void) => void }, object: any, key: string, fn: any) {
  const previous = object[key];
  object[key] = fn;
  t.after(() => { object[key] = previous; });
}

test('password replacement and revocation of every existing session are one transaction', async t => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const calls: Array<{ operation: string; args: any }> = [];
  mockMethod(t, prisma.user, 'update', async (args: any) => { calls.push({ operation: 'password', args }); return args.data; });
  mockMethod(t, prisma.personalAccessToken, 'deleteMany', async (args: any) => { calls.push({ operation: 'sessions', args }); return { count: 2 }; });
  mockMethod(t, prisma, '$transaction', async (operations: Promise<unknown>[]) => { calls.push({ operation: 'transaction', args: operations.length }); return Promise.all(operations); });

  await replacePasswordAndRevokeSessions(userId, 'Updated1!');

  assert.equal(calls.find(call => call.operation === 'transaction')?.args, 2);
  assert.equal(calls.find(call => call.operation === 'password')?.args.where.id, userId);
  assert.equal(await verifyPassword('Updated1!', calls.find(call => call.operation === 'password')?.args.data.password), true);
  assert.deepEqual(calls.find(call => call.operation === 'sessions')?.args.where, { tokenableId: userId });
});
