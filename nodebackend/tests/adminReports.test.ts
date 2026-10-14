import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { Prisma } from '@prisma/client';
import { adminReport, ADMIN_REPORT_KINDS } from '../src/reporting/adminReports';
import { createAdminReportRouter } from '../src/routes/adminReportRoutes';
import { errorHandler } from '../src/middleware/error';
import { fixture, id, company, type Row } from './reportFixture';
const admin = { id: id(9000), role: 'super_admin', accountStatus: 'active' };
const range = { date_from: '2026-10-12', date_to: '2026-10-12' };

test('platform summary separates current snapshots from IST activity and payment lifecycle amounts', async () => {
  const { db, tables } = fixture();
  tables.payment[0].createdAt = new Date('2026-10-11T18:30:00Z');
  tables.user.push({ id: id(50), role: 'guard', fullName: 'Earlier Associate', createdAt: new Date('2026-10-11T18:29:59Z'), accountStatus: 'blocked' });
  const result = await adminReport(db, admin, 'platform-summary', range);
  assert.ok('items' in result);
  assert.equal(result.items.find(r => r.metric === 'Associates registered')?.value, 1);
  assert.equal(result.items.find(r => r.metric === 'Associates: blocked')?.value, 1);
  assert.equal(result.items.find(r => r.metric === 'Payment amount INR: processing')?.value, '987.65');
  assert.equal(result.items.find(r => r.metric === 'Applications received')?.value, 0);
  assert.equal(result.items.find(r => r.metric === 'Attendance sessions')?.value, 1);
});

test('verification registers retain missing profiles and keep denominators distinct', async () => {
  const { db, tables } = fixture();
  tables.user.push({ id: id(51), role: 'guard', fullName: 'No profile', accountStatus: 'pending', createdAt: new Date('2026-10-11T18:30:00Z') });
  const employers = await adminReport(db, admin, 'employer-verification', range);
  assert.ok('items' in employers); assert.equal(employers.items[0].companies, 1); assert.equal(employers.items[0].jobs, 301);
  const associates = await adminReport(db, admin, 'associate-verification', range);
  assert.ok('items' in associates);
  assert.equal(associates.pagination.total, 2);
  assert.equal(associates.summary.missing_profiles, 1);
  assert.deepEqual(associates.summary.aadhaar_statuses, { verified: 1 });
  const row = associates.items.find(r => r.id === id(4))!;
  assert.equal(row.verification_status, 'pending'); assert.equal(row.agreement_version, 'v1'); assert.equal(row.agreement_status, 'SIGNED');
  assert.equal(associates.summary.no_current_agreement, 1);
  assert.ok(associates.meta.warnings.some(w => w.code === 'missing_profile'));
  assert.ok(!JSON.stringify(associates).includes('PRIVATE BANK'));
  const filtered = await adminReport(db, admin, 'associate-verification', { agreement_status: 'SIGNED' });
  assert.ok('items' in filtered); assert.equal(filtered.pagination.total, 1);
});

test('document registers support upload/review dates without exposing file paths', async () => {
  const { db } = fixture();
  for (const kind of ['company-documents', 'associate-documents'] as const) {
    const result = await adminReport(db, admin, kind, range);
    assert.ok('items' in result); assert.equal(result.pagination.total, 1); assert.ok(!JSON.stringify(result).includes('PRIVATE FILE'));
  }
  const reviewed = await adminReport(db, admin, 'associate-documents', { ...range, date_basis: 'reviewed' });
  assert.ok('items' in reviewed); assert.equal(reviewed.pagination.total, 0);
});

test('platform hiring uses the Employer capacity definition and totals all 301 jobs', async () => {
  const { db } = fixture();
  const result = await adminReport(db, admin, 'job-hiring', range);
  assert.ok('items' in result); assert.equal(result.items.length, 50); assert.equal(result.pagination.total, 301);
  assert.equal(result.summary.filled, 3); assert.equal(result.summary.remaining, 600);
  assert.ok(result.columns.some(c => c.key === 'employer'));
  assert.equal(result.items[0].employer, 'Employer A');
  const exported = await adminReport(db, admin, 'job-hiring', range, true);
  assert.ok('csv' in exported); assert.equal(exported.csv.split('\r\n').length, 303);
});

test('broad admin attendance retains unlinked rows, while company filters narrow via jobs', async () => {
  const { db, tables, calls } = fixture();
  tables.attendanceRecord.push({ id: id(55), jobId: null, employerUserId: null, guardUserId: id(4), attendanceDate: new Date('2026-10-12T00:00:00Z'), outTime: null, totalHours: null, status: 'pending_verification' });
  const broad = await adminReport(db, admin, 'attendance', range);
  assert.ok('items' in broad); assert.equal(broad.pagination.total, 2); assert.equal(broad.summary.unknown_hours, 1);
  assert.equal(broad.items.find(r => r.id === id(2003))?.payment_status, 'processing');
  const narrow = await adminReport(db, admin, 'attendance', { ...range, company_id: company });
  assert.ok('items' in narrow); assert.equal(narrow.pagination.total, 1);
  assert.ok(calls.every(c => !/update|create|delete|upsert/i.test(c)));
});

test('audit reports use event time or worked date and exclude exact GPS/technical fields', async () => {
  const { db } = fixture();
  const result = await adminReport(db, admin, 'attendance-audit', { ...range, employer_id: id(1), event_type: 'approve_attendance' });
  assert.ok('items' in result); assert.equal(result.pagination.total, 1); assert.equal(result.items[0].actor, 'Employer A');
  assert.equal(result.items[0].job, '=Unsafe title');
  assert.ok(!JSON.stringify(result).includes('PRIVATE GPS')); assert.ok(!JSON.stringify(result).includes('PRIVATE IP'));
  const exported = await adminReport(db, admin, 'attendance-audit', { ...range, date_basis: 'attendance' }, true);
  assert.ok('csv' in exported); assert.ok(!exported.csv.includes('PRIVATE GPS'));
});

test('missing current-agreement enrichment is partial; missing audit table is unavailable', async () => {
  const { db } = fixture();
  const missing = () => { throw new Prisma.PrismaClientKnownRequestError('missing table', { code: 'P2021', clientVersion: 'test' }); };
  db.associatePartnerAgreement.findMany = missing;
  const result = await adminReport(db, admin, 'associate-verification', {});
  assert.ok('items' in result); assert.ok(result.meta.warnings.some(w => w.section === 'agreements'));
  await assert.rejects(adminReport(db, admin, 'associate-verification', {}, true), (e: Row) => e.status === 503);
  db.attendanceAuditEvent.count = missing;
  await assert.rejects(adminReport(db, admin, 'attendance-audit', {}), (e: Row) => e.status === 503);
});

test('admin HTTP report routes reject every other role and validate conflicting or unsupported scopes', async () => {
  const { db } = fixture(); const app = express();
  app.use((req, _res, next) => { req.user = { ...admin, role: req.header('x-test-role') ?? 'super_admin', accountStatus: req.header('x-test-status') ?? 'active' } as any; next(); });
  app.use('/api/admin/reports', createAdminReportRouter(db)); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/reports`;
  try {
    const get = (path: string, headers?: Record<string, string>) => fetch(base + path, { headers });
    for (const kind of ADMIN_REPORT_KINDS) for (const role of ['employer', 'guard', 'sub_admin', 'finance', 'operations', 'sales_executive']) {
      assert.equal((await get(`/${kind}`, { 'x-test-role': role })).status, 403);
      assert.equal((await get(`/${kind}/export`, { 'x-test-role': role })).status, 403);
    }
    assert.equal((await get('/attendance-audit', { 'x-test-status': 'blocked' })).status, 403);
    assert.equal((await get(`/job-hiring?employer_id=${id(1)}&company_id=${id(20)}`)).status, 404);
    assert.equal((await get(`/associate-verification?employer_id=${id(1)}`)).status, 422);
    assert.equal((await get('/employer-verification?date_from=2026-02-30')).status, 422);
    assert.equal((await get('/platform-summary?city=Mumbai')).status, 422);
    const result = await get('/attendance-audit'); assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
    const exported = await get('/employer-verification/export'); assert.equal(exported.status, 200); assert.ok(exported.headers.get('content-disposition')?.includes('attachment'));
    assert.ok(!(await exported.text()).includes('NEVER EXPOSE'));
    assert.equal((await get('/options')).status, 200);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
