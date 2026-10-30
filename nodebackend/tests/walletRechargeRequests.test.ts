import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { prisma } from '../src/prisma';
import { adminCompleteRechargeRequest, requestRecharge } from '../src/controllers/walletController';
import { HttpError } from '../src/utils/http';

function mockMethod(t: { after: (fn: () => void) => void }, object: any, key: string, fn: any) {
  const previous = object[key];
  object[key] = fn;
  t.after(() => { object[key] = previous; });
}

function responseCapture() {
  let statusCode = 200;
  let body: any;
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(value: any) { body = value; return response; },
  } as unknown as Response;
  return { response, result: () => ({ statusCode, body }) };
}

test('employer recharge action creates a pending request without changing the wallet', async t => {
  let createData: any;
  mockMethod(t, prisma.walletRechargeRequest, 'create', async ({ data }: any) => {
    createData = data;
    return {
      id: 'request-1',
      ...data,
      completedByUserId: null,
      completedAt: null,
      walletTransactionId: null,
      createdAt: new Date('2026-10-29T10:00:00.000Z'),
      updatedAt: new Date('2026-10-29T10:00:00.000Z'),
    };
  });
  const { response, result } = responseCapture();
  await requestRecharge({
    user: { id: 'employer-1' },
    body: { amount: 12500, remarks: 'Monthly wallet amount' },
  } as Request, response);

  assert.deepEqual(createData, {
    employerUserId: 'employer-1',
    amount: 12500,
    remarks: 'Monthly wallet amount',
    status: 'pending',
  });
  assert.equal(result().statusCode, 201);
  assert.equal(result().body.status, 'pending');
});

test('Super Admin allocation deposits the requested amount and completes the request atomically', async t => {
  const walletUpdates: any[] = [];
  const requestUpdates: any[] = [];
  const transactionCreates: any[] = [];
  const notifications: any[] = [];
  const fakeTx = {
    walletRechargeRequest: {
      findUnique: async () => ({ id: 'request-1', employerUserId: 'employer-1', amount: 12500, remarks: 'Approved funding', status: 'pending' }),
      updateMany: async (args: any) => { requestUpdates.push(args); return { count: 1 }; },
      update: async (args: any) => ({ id: 'request-1', employerUserId: 'employer-1', amount: 12500, remarks: 'Approved funding', status: 'completed', ...args.data }),
    },
    employerWallet: {
      findUnique: async () => ({ id: 'wallet-1', employerUserId: 'employer-1', balance: 500, depositBalance: 500 }),
      update: async (args: any) => { walletUpdates.push(args); return { id: 'wallet-1', employerUserId: 'employer-1', balance: 13000, depositBalance: 13000, creditBalance: 0, totalRecharged: 12500, totalCredited: 0, totalDebited: 0 }; },
    },
    walletTransaction: {
      create: async ({ data }: any) => { transactionCreates.push(data); return { id: 'wallet-tx-1', ...data }; },
    },
    notification: {
      create: async ({ data }: any) => { notifications.push(data); return { id: 'notification-1', ...data }; },
    },
  };
  mockMethod(t, prisma, '$transaction', async (callback: any) => callback(fakeTx));
  const { response, result } = responseCapture();
  await adminCompleteRechargeRequest({
    user: { id: 'admin-1' },
    params: { request: 'request-1' },
  } as unknown as Request, response);

  assert.deepEqual(requestUpdates[0].where, { id: 'request-1', status: 'pending' });
  assert.equal(requestUpdates[0].data.status, 'completed');
  assert.equal(requestUpdates[0].data.completedByUserId, 'admin-1');
  assert.deepEqual(walletUpdates[0].data, {
    balance: { increment: 12500 },
    depositBalance: { increment: 12500 },
    totalRecharged: { increment: 12500 },
  });
  assert.equal(transactionCreates[0].source, 'admin_recharge_allocation');
  assert.equal(transactionCreates[0].referenceType, 'wallet_recharge_request');
  assert.equal(transactionCreates[0].referenceId, 'request-1');
  assert.equal(notifications[0].userId, 'employer-1');
  assert.equal(result().body.request.status, 'completed');
  assert.equal(result().body.wallet.balance, 13000);
});

test('a recharge request cannot allocate wallet funds twice', async t => {
  let walletWrites = 0;
  const fakeTx = {
    walletRechargeRequest: {
      findUnique: async () => ({ id: 'request-1', employerUserId: 'employer-1', amount: 12500, status: 'pending' }),
      updateMany: async () => ({ count: 0 }),
    },
    employerWallet: { update: async () => { walletWrites += 1; } },
  };
  mockMethod(t, prisma, '$transaction', async (callback: any) => callback(fakeTx));

  await assert.rejects(
    () => adminCompleteRechargeRequest({
      user: { id: 'admin-2' },
      params: { request: 'request-1' },
    } as unknown as Request, responseCapture().response),
    (error) => error instanceof HttpError && error.status === 409,
  );
  assert.equal(walletWrites, 0);
});
