import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { decideLeaveRequest, releaseAssociate, requestLeave } from '../src/controllers/applicationController';
import { prisma } from '../src/prisma';
import { HttpError } from '../src/utils/http';

type TxCall = { model: string; method: string; args: Record<string, unknown> };

const baseApplication = {
  id: 'app-1',
  jobId: 'job-1',
  guardUserId: 'guard-1',
  employerUserId: 'employer-1',
  status: 'hired',
  notes: null,
  job: {
    id: 'job-1',
    title: 'Security Associate',
    status: 'active',
    guardsRequired: 1,
    employerUserId: 'employer-1',
    salaryAmount: 25000,
    dutyHours: '8 hours',
    shiftType: 'Day',
    startDate: null,
    company: null,
  },
};

function makeResponse() {
  return {
    body: null as unknown,
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function installPrismaMock(application: Record<string, unknown>) {
  const txCalls: TxCall[] = [];
  const notifications: Array<Record<string, unknown>> = [];
  const tx = {
    jobApplication: {
      update: async (args: Record<string, unknown>) => {
        txCalls.push({ model: 'jobApplication', method: 'update', args });
        return { ...application, ...(args.data as Record<string, unknown>) };
      },
    },
    applicationStatusLog: {
      create: async (args: Record<string, unknown>) => {
        txCalls.push({ model: 'applicationStatusLog', method: 'create', args });
        return args;
      },
    },
    jobOffer: {
      updateMany: async (args: Record<string, unknown>) => {
        txCalls.push({ model: 'jobOffer', method: 'updateMany', args });
        return { count: 1 };
      },
    },
  };

  Object.assign(prisma, {
    jobApplication: {
      findUnique: async () => application,
    },
    guardProfile: {
      findUnique: async () => ({ fullName: 'Test Associate' }),
    },
    notification: {
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        notifications.push(...args.data);
        return { count: args.data.length };
      },
    },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  });

  return { txCalls, notifications };
}

afterEach(() => {
  delete (prisma as unknown as Record<string, unknown>).jobApplication;
  delete (prisma as unknown as Record<string, unknown>).guardProfile;
  delete (prisma as unknown as Record<string, unknown>).notification;
  delete (prisma as unknown as Record<string, unknown>).$transaction;
});

test('associate leave request changes a hired application to leave_requested and notifies employer', async () => {
  const { txCalls, notifications } = installPrismaMock(baseApplication);
  const res = makeResponse();

  await requestLeave(
    { params: { application: 'app-1' }, body: { reason: 'Personal emergency' }, user: { id: 'guard-1' } } as never,
    res as never,
  );

  assert.equal(txCalls[0].model, 'jobApplication');
  assert.deepEqual(txCalls[0].args, {
    where: { id: 'app-1' },
    data: { status: 'leave_requested', notes: 'Personal emergency', reviewedAt: txCalls[0].args.data?.['reviewedAt'], reviewedBy: 'guard-1' },
  });
  assert.equal(txCalls[1].args.data?.['oldStatus'], 'hired');
  assert.equal(txCalls[1].args.data?.['newStatus'], 'leave_requested');
  assert.equal(notifications[0].userId, 'employer-1');
  assert.equal(notifications[0].type, 'job_leave_request');
  assert.equal((res.body as Record<string, unknown>).status, 'leave_requested');
});

test('employer accepting leave completes the application and active offers', async () => {
  const { txCalls, notifications } = installPrismaMock({ ...baseApplication, status: 'leave_requested' });
  const res = makeResponse();

  await decideLeaveRequest(
    { params: { application: 'app-1' }, body: { decision: 'accepted', reason: 'Approved handover' }, user: { id: 'employer-1', role: 'employer' } } as never,
    res as never,
  );

  assert.equal(txCalls[0].args.data?.['status'], 'completed');
  assert.equal(txCalls[1].args.data?.['newStatus'], 'completed');
  assert.equal(txCalls[2].model, 'jobOffer');
  assert.deepEqual(txCalls[2].args.data, { status: 'completed' });
  assert.equal(notifications[0].userId, 'guard-1');
  assert.equal(notifications[0].type, 'job_leave_accepted');
  assert.equal((res.body as Record<string, unknown>).reinitiate_available, true);
  assert.equal((res.body as Record<string, unknown>).job_id, 'job-1');
});

test('employer rejecting leave returns the application to hired without completing offers', async () => {
  const { txCalls, notifications } = installPrismaMock({ ...baseApplication, status: 'leave_requested' });
  const res = makeResponse();

  await decideLeaveRequest(
    { params: { application: 'app-1' }, body: { decision: 'rejected', reason: 'Coverage required' }, user: { id: 'employer-1', role: 'employer' } } as never,
    res as never,
  );

  assert.equal(txCalls[0].args.data?.['status'], 'hired');
  assert.equal(txCalls[1].args.data?.['newStatus'], 'hired');
  assert.equal(txCalls.some((call) => call.model === 'jobOffer'), false);
  assert.equal(notifications[0].type, 'job_leave_rejected');
  assert.equal((res.body as Record<string, unknown>).reinitiate_available, false);
});

test('employer release only works for hired applications and marks related offers released', async () => {
  const { txCalls, notifications } = installPrismaMock(baseApplication);
  const res = makeResponse();

  await releaseAssociate(
    { params: { application: 'app-1' }, body: { reason: 'Contract ended' }, user: { id: 'employer-1', role: 'employer' } } as never,
    res as never,
  );

  assert.equal(txCalls[0].args.data?.['status'], 'released');
  assert.equal(txCalls[1].args.data?.['oldStatus'], 'hired');
  assert.equal(txCalls[1].args.data?.['newStatus'], 'released');
  assert.deepEqual(txCalls[2].args.data, { status: 'released' });
  assert.equal(notifications[0].userId, 'guard-1');
  assert.equal(notifications[0].type, 'job_released');
  assert.equal((res.body as Record<string, unknown>).reinitiate_available, true);
});

test('release rejects non-hired applications and wrong employer scope', async () => {
  installPrismaMock({ ...baseApplication, status: 'leave_requested' });
  await assert.rejects(
    () => releaseAssociate(
      { params: { application: 'app-1' }, body: { reason: 'Contract ended' }, user: { id: 'employer-1', role: 'employer' } } as never,
      makeResponse() as never,
    ),
    (error) => error instanceof HttpError && error.status === 422 && /Only a hired associate/.test(error.message),
  );

  installPrismaMock(baseApplication);
  await assert.rejects(
    () => releaseAssociate(
      { params: { application: 'app-1' }, body: { reason: 'Contract ended' }, user: { id: 'other-employer', role: 'employer' } } as never,
      makeResponse() as never,
    ),
    (error) => error instanceof HttpError && error.status === 403,
  );
});
