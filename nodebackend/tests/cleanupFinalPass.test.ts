import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../src/utils/http';
import { enforceJobCapacityForApplication } from '../src/services/jobCapacity';
import { buildAdminAttendanceWhere, buildWalletTransactionWhere } from '../src/utils/queryFilters';

function fakeCapacityTx(input: { status: string; required: number; filledOthers: number }) {
  const updates: Array<Record<string, unknown>> = [];
  return {
    updates,
    jobPost: {
      findUnique: async () => ({ id: 'job-1', status: input.status, guardsRequired: input.required }),
      update: async (args: Record<string, unknown>) => {
        updates.push(args);
        return args;
      },
    },
    jobApplication: {
      count: async () => input.filledOthers,
    },
  };
}

test('job capacity keeps required 5 / hired 4 open until fifth hire closes it', async () => {
  const fourOfFive = fakeCapacityTx({ status: 'active', required: 5, filledOthers: 3 });
  await enforceJobCapacityForApplication(fourOfFive as never, { id: 'app-4', jobId: 'job-1', status: 'selected' }, 'hired');
  assert.equal(fourOfFive.updates.length, 0);

  const fifth = fakeCapacityTx({ status: 'active', required: 5, filledOthers: 4 });
  await enforceJobCapacityForApplication(fifth as never, { id: 'app-5', jobId: 'job-1', status: 'selected' }, 'hired');
  assert.deepEqual(fifth.updates[0], { where: { id: 'job-1' }, data: { status: 'closed', rejectionReason: null } });
});

test('job capacity rejects sixth hire, duplicate hire, and new hire on closed job', async () => {
  await assert.rejects(
    () => enforceJobCapacityForApplication(fakeCapacityTx({ status: 'active', required: 5, filledOthers: 5 }) as never, { id: 'app-6', jobId: 'job-1', status: 'selected' }, 'hired'),
    (error) => error instanceof HttpError && error.status === 422 && /already has 5/.test(error.message),
  );

  await assert.rejects(
    () => enforceJobCapacityForApplication(fakeCapacityTx({ status: 'active', required: 5, filledOthers: 4 }) as never, { id: 'app-5', jobId: 'job-1', status: 'hired' }, 'hired'),
    (error) => error instanceof HttpError && error.status === 422 && /already marked hired/.test(error.message),
  );

  await assert.rejects(
    () => enforceJobCapacityForApplication(fakeCapacityTx({ status: 'closed', required: 5, filledOthers: 4 }) as never, { id: 'app-new', jobId: 'job-1', status: 'selected' }, 'hired'),
    (error) => error instanceof HttpError && error.status === 422 && /closed/.test(error.message),
  );
});

test('admin attendance filters combine employer, site, employee, date range, and status', () => {
  const where = buildAdminAttendanceWhere({
    employer_id: 'emp-1',
    company_id: 'company-1',
    site_id: 'site-1',
    guard_id: 'guard-1',
    job_id: 'job-1',
    status: 'approved',
    date_from: '2026-09-01',
    date_to: '2026-09-30',
  });

  assert.equal(where.employerUserId, 'emp-1');
  assert.equal(where.companyId, 'company-1');
  assert.equal(where.siteId, 'site-1');
  assert.equal(where.guardUserId, 'guard-1');
  assert.equal(where.jobId, 'job-1');
  assert.equal(where.status, 'approved');
  assert.deepEqual(where.attendanceDate, {
    gte: new Date('2026-09-01T00:00:00.000Z'),
    lt: new Date('2026-10-01T00:00:00.000Z'),
  });
});

test('wallet filters combine type, reference, date range, amount range, and user scope', () => {
  const adminWhere = buildWalletTransactionWhere({
    employer_id: 'emp-1',
    guard_id: 'guard-1',
    transaction_type: 'debit',
    source: 'job_payment',
    status: 'completed',
    reference_id: 'PAY-123',
    date_from: '2026-09-01',
    date_to: '2026-09-30',
    min_amount: '5000',
    max_amount: '25000',
  });

  assert.deepEqual(adminWhere, {
    employerUserId: 'emp-1',
    guardUserId: 'guard-1',
    transactionType: 'debit',
    source: 'job_payment',
    status: 'completed',
    referenceId: { contains: 'PAY-123' },
    createdAt: {
      gte: new Date('2026-09-01T00:00:00.000Z'),
      lt: new Date('2026-10-01T00:00:00.000Z'),
    },
    amount: { gte: 5000, lte: 25000 },
  });

  const employerWhere = buildWalletTransactionWhere({ employer_id: 'other-employer', transaction_type: 'credit' }, 'logged-in-employer');
  assert.equal(employerWhere.employerUserId, 'logged-in-employer');
  assert.equal(employerWhere.transactionType, 'credit');
});
