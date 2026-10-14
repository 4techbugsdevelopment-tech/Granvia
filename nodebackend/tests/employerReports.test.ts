import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { Prisma } from '@prisma/client';
import { employerReport } from '../src/reporting/employerReports';
import { createEmployerReportRouter } from '../src/routes/employerReportRoutes';
import { errorHandler } from '../src/middleware/error';

import { fixture, id, owner, company, type Row } from './reportFixture';

const query = { company_id: company, date_from: '2026-10-12', date_to: '2026-10-12' };

test('job summaries cover 301 rows and retain older currently filled applications', async () => {
  const { db, calls } = fixture();
  const result = await employerReport(db, owner, 'job-hiring', query);
  assert.ok('items' in result);
  assert.equal(result.items.length, 50);
  assert.equal(result.pagination.total, 301);
  assert.equal(result.summary.required, 602);
  assert.equal(result.summary.filled, 3);
  assert.equal(result.summary.remaining, 600); // Per-job clamp: one overfilled job does not reduce other jobs' vacancies.
  assert.equal(result.summary.applications, 5);
  assert.ok(result.meta.warnings.some(w => w.code === 'capacity_exceeded'));
  assert.ok(calls.every(c => /\.(findUnique|findMany|groupBy|count|aggregate)$/.test(c)));
});

test('all document tabs use their own dates, exact decimals and pending metadata', async () => {
  const { db } = fixture();
  const interviews = await employerReport(db, owner, 'interviews', query);
  assert.ok('items' in interviews); assert.equal(interviews.summary.unscheduled, 1);
  const preferred = await employerReport(db, owner, 'interviews', { ...query, date_basis: 'preferred' });
  assert.ok('items' in preferred); assert.equal(preferred.pagination.total, 0);
  const offers = await employerReport(db, owner, 'offers', query);
  assert.ok('items' in offers); assert.equal(offers.items[0].offered_salary, '1234.5');
  assert.equal(offers.items[0].associate, 'Associate A');
  assert.ok(!JSON.stringify(offers).includes('NEVER EXPOSE'));
  const agreements = await employerReport(db, owner, 'agreements', query);
  assert.ok('items' in agreements); assert.equal(agreements.summary.pending_confirmations, 1);
});

test('attendance has complete hours and processing settlement, without checkout writes', async () => {
  const { db, calls } = fixture();
  const result = await employerReport(db, owner, 'attendance', query);
  assert.ok('items' in result);
  assert.equal(result.summary.recorded_hours, '8');
  assert.equal(result.summary.distinct_associates, 1);
  assert.equal(result.items[0].payment_status, 'processing');
  assert.equal(result.items[0].payment_amount, '987.65');
  assert.ok(calls.every(c => !/update|create|delete|upsert/i.test(c)));
  const requests = await employerReport(db, owner, 'attendance-exceptions', query);
  assert.ok('items' in requests); assert.equal(requests.pagination.total, 1);
});

test('application drill-down includes legacy null owner rows through the authorised job', async () => {
  const { db, tables } = fixture();
  tables.jobApplication[0].employerUserId = null;
  const result = await employerReport(db, owner, 'applications', { company_id: company, job_id: id(100) });
  assert.ok('items' in result);
  assert.equal(result.pagination.total, 5);
  assert.ok(result.items.some(row => row.status === 'hired'));
});

test('export exceeds the old 250-row cap and never includes a foreign company', async () => {
  const { db } = fixture();
  const result = await employerReport(db, owner, 'job-hiring', query, true);
  assert.ok('csv' in result);
  assert.equal(result.csv.split('\r\n').length, 303);
  assert.ok(result.csv.includes("'=Unsafe title"));
  assert.ok(!result.csv.includes('Company B'));
  assert.ok(result.csv.includes('2026-10-12T00:00:00.000+05:30'));
});

test('missing settlement columns are partial, while missing request schema is unavailable', async () => {
  const { db } = fixture();
  const missing = () => { throw new Prisma.PrismaClientKnownRequestError('Missing column', { code: 'P2022', clientVersion: 'test' }); };
  db.payment.findMany = missing;
  const result = await employerReport(db, owner, 'attendance', query);
  assert.ok('items' in result); assert.equal(result.meta.partial, true);
  assert.ok(result.meta.warnings.some(w => w.section === 'settlements'));
  await assert.rejects(employerReport(db, owner, 'attendance', query, true), (e: any) => e.status === 503);
  db.attendanceExceptionRequest.count = missing;
  await assert.rejects(employerReport(db, owner, 'attendance-exceptions', query), (e: any) => e.status === 503);
});

test('real HTTP routes enforce company ownership, roles, filters, totals and export headers', async () => {
  const { db, calls } = fixture();
  const app = express();
  app.use((req, _res, next) => { req.user = { ...owner, role: req.header('x-test-role') ?? owner.role } as any; next(); });
  app.use('/api/employer/reports', createEmployerReportRouter(db));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/employer/reports`;
  try {
    const get = (path: string, headers?: Record<string, string>) => fetch(`${base}${path}`, { headers });
    const options = await get(`/options?company_id=${company}`);
    assert.equal(options.status, 200);
    const optionsBody = await options.json() as Row;
    assert.equal(optionsBody.associates.length, 1);
    assert.ok(!JSON.stringify(optionsBody).includes('NEVER EXPOSE'));
    assert.equal((await get(`/options?company_id=${id(20)}`)).status, 404);
    assert.equal((await get(`/job-hiring?company_id=${company}`, { 'x-test-role': 'super_admin' })).status, 403);
    for (const kind of ['job-hiring', 'interviews', 'offers', 'agreements', 'attendance', 'attendance-exceptions']) {
      assert.equal((await get(`/${kind}?company_id=${id(20)}`)).status, 404);
      assert.equal((await get(`/${kind}/export?company_id=${id(20)}`)).status, 404);
    }
    assert.equal((await get(`/job-hiring?company_id=${company}&employer_id=${id(21)}`)).status, 422);
    assert.equal((await get(`/job-hiring?company_id=${company}&date_from=2026-02-30`)).status, 422);
    assert.equal((await get(`/job-hiring?company_id=${company}&date_from=2026-10-13&date_to=2026-10-12`)).status, 422);
    assert.equal((await get(`/job-hiring?company_id=${company}&page_size=101`)).status, 422);
    assert.equal((await get(`/job-hiring?company_id=${company}&guard_id=${id(4)}`)).status, 422);
    const response = await get(`/job-hiring?company_id=${company}&page=7&page_size=50`);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json() as Row; assert.equal(body.items.length, 1); assert.equal(body.pagination.total, 301);
    const csv = await get(`/job-hiring/export?company_id=${company}&page=7`);
    assert.equal(csv.status, 200); assert.ok(csv.headers.get('content-disposition')?.includes('attachment'));
    assert.equal((await csv.text()).split('\r\n').length, 303);
    assert.ok(calls.every(c => !/create|update|delete|upsert/i.test(c)));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
