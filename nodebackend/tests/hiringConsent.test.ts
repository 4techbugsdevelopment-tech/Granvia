import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { updateStatus } from '../src/controllers/applicationController';
import { guardUpdate, update as employerOfferUpdate } from '../src/controllers/jobOfferController';
import { prisma } from '../src/prisma';

const application = { id: 'app-1', jobId: 'job-1', guardUserId: 'guard-1', employerUserId: 'employer-1', companyId: 'company-1', siteId: 'site-1', status: 'selected', job: { title: 'Associate', salaryAmount: 20000 } };
const offer = { id: 'offer-1', applicationId: 'app-1', jobId: 'job-1', guardUserId: 'guard-1', employerUserId: 'employer-1', status: 'sent', job: { title: 'Associate' } };
function response() { return { body: null as any, json(value: any) { this.body = value; return this; } }; }
const keys = ['jobApplication', 'jobOffer', 'guardProfile', 'notification', '$transaction'];
afterEach(() => { for (const key of keys) delete (prisma as any)[key]; });

test('employer Hired creates a proposal and never writes a hired assignment', async () => {
  const writes: any[] = [];
  const tx = {
    jobApplication: { update: async ({ data }: any) => { writes.push(data); return { ...application, ...data }; } },
    applicationStatusLog: { create: async () => ({}) },
    jobOffer: { findFirst: async () => null, create: async ({ data }: any) => { writes.push(data); return { ...offer, ...data }; } },
  };
  Object.assign(prisma, { jobApplication: { findUnique: async () => application }, guardProfile: { findUnique: async () => ({ fullName: 'Test' }) }, notification: { createMany: async () => ({ count: 1 }) }, $transaction: async (fn: any) => fn(tx) });
  const res = response();
  await updateStatus({ params: { application: application.id }, body: { status: 'hired' }, user: { id: 'employer-1', role: 'employer' } } as never, res as never);
  assert.equal(res.body.status, 'offer_sent');
  assert.equal(writes[1].status, 'sent');
  assert.equal(writes.some(data => data.status === 'hired'), false);
});

test('employer cannot bypass Associate acceptance by marking an application joined', async () => {
  Object.assign(prisma, { jobApplication: { findUnique: async () => ({ ...application, status: 'offer_sent' }) } });
  await assert.rejects(() => updateStatus({ params: { application: 'app-1' }, body: { status: 'joined' }, user: { id: 'employer-1', role: 'employer' } } as never, response() as never), /must accept/);
});

test('employer cannot accept their own sent offer on behalf of the Associate', async () => {
  Object.assign(prisma, { jobOffer: { findUnique: async () => offer } });
  await assert.rejects(() => employerOfferUpdate({ params: { jobOffer: 'offer-1' }, body: { status: 'accepted' }, user: { id: 'employer-1' } } as never, response() as never), /Only the associate/);
});

test('Associate No declines proposal and records not_hired with employer notification', async () => {
  const current = { ...application, status: 'offer_sent' };
  const writes: any[] = [];
  const tx = {
    jobOffer: { findUnique: async () => offer, update: async ({ data }: any) => { writes.push(data); return { ...offer, ...data }; } },
    jobApplication: { findUnique: async () => current, update: async ({ data }: any) => { writes.push(data); return { ...current, ...data }; } },
    applicationStatusLog: { create: async ({ data }: any) => { writes.push(data); return data; } },
    notification: { create: async ({ data }: any) => { writes.push(data); return data; } },
  };
  Object.assign(prisma, { jobOffer: { findUnique: async () => offer }, jobApplication: { findUnique: async () => current }, $transaction: async (fn: any) => fn(tx) });
  const res = response();
  await guardUpdate({ params: { jobOffer: 'offer-1' }, body: { status: 'declined' }, user: { id: 'guard-1' } } as never, res as never);
  assert.equal(res.body.status, 'declined');
  assert.equal(writes[1].status, 'not_hired');
  assert.equal(writes[2].newStatus, 'not_hired');
  assert.equal(writes[3].userId, 'employer-1');
});

test('stale proposal decision cannot overwrite a completed application', async () => {
  Object.assign(prisma, { jobOffer: { findUnique: async () => offer }, jobApplication: { findUnique: async () => ({ ...application, status: 'offer_sent' }) }, $transaction: async (fn: any) => fn({ jobOffer: { findUnique: async () => ({ ...offer, status: 'declined' }) }, jobApplication: { findUnique: async () => ({ ...application, status: 'not_hired' }) } }) });
  await assert.rejects(() => guardUpdate({ params: { jobOffer: 'offer-1' }, body: { status: 'accepted' }, user: { id: 'guard-1' } } as never, response() as never), /changed/);
});
