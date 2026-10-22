import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { Prisma } from '@prisma/client';
import { EXTENDED_REPORTS, extendedReport, extendedReportOptions, type ReportingRole } from '../src/reporting/extendedReports';
import { createExtendedReportRouter } from '../src/routes/extendedReportRoutes';
import { errorHandler } from '../src/middleware/error';
import { fixture, owner, id } from './reportFixture';

const admin = { id: id(9000), role: 'super_admin', accountStatus: 'active' };
const associate = { id: id(4), role: 'guard', accountStatus: 'active' };
const range = { date_from: '2026-10-12', date_to: '2026-10-12' };
const actor = (role: ReportingRole) => role === 'super_admin' ? admin : role === 'employer' ? owner : role === 'guard' ? associate : { id: id(8000), role, accountStatus: 'active' };

test('registration counts distinguish period, pre-period and cumulative using IST and safe fields', async () => {
  const { db, tables } = fixture();
  tables.user.push({ id: id(80), role: 'employer', fullName: 'Older', accountStatus: 'blocked', createdAt: new Date('2026-10-11T18:29:59.999Z') },
    { id: id(81), role: 'employer', fullName: 'Next day', accountStatus: 'active', createdAt: new Date('2026-10-12T18:30:00Z') });
  const result = await extendedReport(db, admin, 'super_admin', 'employer-registrations', { ...range, page_size: '1' });
  assert.ok('items' in result);
  assert.equal(result.summary.period_registrations, 1);
  assert.equal(result.summary.registrations_before_period, 1);
  assert.equal(result.summary.cumulative_registrations_through_end, 2);
  assert.equal(result.items[0].name, 'Employer A');
  assert.deepEqual(result.summary.current_status_of_period_accounts, { active: 1 });
  assert.deepEqual(result.summary.daily_registrations, { '2026-10-12': 1 });
  assert.deepEqual(result.summary.monthly_registrations, { '2026-10': 1 });
  assert.ok(!JSON.stringify(result).includes('NEVER EXPOSE'));
  assert.ok(!JSON.stringify(result).includes('PRIVATE BANK'));
});

test('Sub Admin and Sales registration counts respect current assigned profiles', async () => {
  const { db, tables } = fixture();
  tables.employerProfile[0].subAdminId = id(8000);
  tables.guardProfile[0].subAdminId = id(8000);
  tables.employerProfile[0].salesExecutiveId = id(8001);
  const scoped = await extendedReport(db, actor('sub_admin'), 'sub_admin', 'employer-registrations', {});
  assert.ok('items' in scoped); assert.equal(scoped.pagination.total, 1);
  const guards = await extendedReport(db, actor('sub_admin'), 'sub_admin', 'associate-registrations', {});
  assert.ok('items' in guards); assert.equal(guards.pagination.total, 1);
  const other = await extendedReport(db, actor('sales_executive'), 'sales_executive', 'employer-registrations', {});
  assert.ok('items' in other); assert.equal(other.pagination.total, 0);
});

test('Employer credits total only completed credits from the authoritative owned wallet', async () => {
  const { db, tables } = fixture();
  tables.walletTransaction.push({ ...tables.walletTransaction[1], id: id(90), walletId: id(999), employerUserId: owner.id, amount: new Prisma.Decimal('999999.99') },
    { ...tables.walletTransaction[1], id: id(91), status: 'failed', amount: new Prisma.Decimal('99.99') },
    { ...tables.walletTransaction[1], id: id(92), amount: new Prisma.Decimal('0.10') });
  const result = await extendedReport(db, owner, 'employer', 'employer-credits', { ...range, page_size: '1' });
  assert.ok('items' in result);
  assert.equal(result.items.length, 1);
  assert.equal(result.pagination.total, 2);
  assert.equal(result.summary.total_completed_credits, '1000.30');
  assert.equal(result.summary.current_account_balance, '20012.65');
  assert.ok(!JSON.stringify(result).includes('PRIVATE METADATA'));
  await assert.rejects(extendedReport(db, owner, 'employer', 'employer-credits', { employer_id: id(99) }), /signed-in account/);
});

test('Associate statement separates earnings, reservation, release and payout consumption', async () => {
  const { db, tables, calls } = fixture();
  const entry = { walletId: id(61), createdAt: new Date('2026-10-12T10:00:00Z'), status: 'completed', purpose: 'Recorded entry', referenceId: null };
  tables.associateWalletTransaction.splice(0, tables.associateWalletTransaction.length,
    ...[['credit', '100.10'], ['reserve', '40.00'], ['release', '10.00'], ['debit', '30.00']].map(([transactionType, amount], i) => ({ ...entry, id: id(120 + i), transactionType, amount: new Prisma.Decimal(amount), referenceType: transactionType })),
    { ...entry, id: id(129), transactionType: 'credit', amount: new Prisma.Decimal('99.00'), status: 'processing' });
  tables.associateWallet.push({ id: id(150), guardUserId: id(151), availableBalance: new Prisma.Decimal(1000), reservedBalance: new Prisma.Decimal(0) });
  tables.user.push({ id: id(151), role: 'guard', fullName: 'Other Associate' });
  tables.associateWalletTransaction.push({ ...entry, id: id(152), walletId: id(150), transactionType: 'credit', amount: new Prisma.Decimal(9999), referenceType: 'payment' });
  const result = await extendedReport(db, associate, 'guard', 'associate-statement', { ...range, page_size: '1' });
  assert.ok('items' in result);
  assert.equal(result.pagination.total, 5); assert.equal(result.items.length, 1);
  assert.equal(result.summary.total_completed_credits, '100.10');
  assert.equal(result.summary.total_completed_debits, '30.00');
  assert.equal(result.summary.total_reserve_entries, '40.00');
  assert.equal(result.summary.total_release_entries, '10.00');
  assert.equal(result.summary.opening_balance, null);
  assert.ok(calls.every(call => !/create|update|upsert|delete/.test(call)));
  await assert.rejects(extendedReport(db, associate, 'guard', 'associate-statement', { guard_id: id(151) }), /signed-in account/);
});

test('Associate snapshot preserves unknown missing wallets and rejects date filters', async () => {
  const { db, tables } = fixture();
  tables.user.push({ id: id(170), role: 'guard', fullName: 'No wallet', accountStatus: 'active', createdAt: new Date() });
  const result = await extendedReport(db, admin, 'super_admin', 'associate-wallets', {});
  assert.ok('items' in result);
  assert.equal(result.summary.wallets_not_created, 1);
  assert.equal(result.summary.stored_total, '987.65');
  assert.equal(result.items.find(row => row.id === id(170))?.available, null);
  await assert.rejects(extendedReport(db, admin, 'super_admin', 'associate-wallets', range), /current snapshot/);
});

test('Operations reports deny unassigned and inactive scopes and enforce job-level assignment', async () => {
  const { db, tables } = fixture();
  const noScope = await extendedReport(db, actor('operations'), 'operations', 'recruitment-pipeline', {});
  assert.ok('items' in noScope); assert.equal(noScope.pagination.total, 0);
  tables.operationsAssignment.push({ operationsUserId: id(8000), employerUserId: owner.id, status: 'active', jobId: id(100) },
    { operationsUserId: id(8000), employerUserId: owner.id, status: 'inactive', jobId: id(101) });
  tables.jobApplication.push({ ...tables.jobApplication[0], id: id(180), jobId: id(101) });
  const result = await extendedReport(db, actor('operations'), 'operations', 'recruitment-pipeline', {});
  assert.ok('items' in result); assert.equal(result.pagination.total, 5);
  assert.equal(result.summary.distinct_associates, 1);
  assert.equal(result.summary.distinct_current_hired_associates_in_filtered_applications, 1);
  const foreign = await extendedReport(db, actor('operations'), 'operations', 'recruitment-pipeline', { job_id: id(101) });
  assert.ok('items' in foreign); assert.equal(foreign.pagination.total, 0);
});

test('Employer and staff pipeline cannot widen account scope with query filters', async () => {
  const { db, tables } = fixture();
  tables.employerProfile[0].subAdminId = id(8000);
  tables.jobApplication.push({ ...tables.jobApplication[0], id: id(190), jobId: id(191), employerUserId: id(192) });
  tables.jobPost.push({ ...tables.jobPost[0], id: id(191), employerUserId: id(192), title: 'Foreign job' });
  const self = await extendedReport(db, owner, 'employer', 'recruitment-pipeline', {});
  assert.ok('items' in self); assert.equal(self.pagination.total, 5);
  const staff = await extendedReport(db, actor('sub_admin'), 'sub_admin', 'recruitment-pipeline', { employer_id: id(192) });
  assert.ok('items' in staff); assert.equal(staff.pagination.total, 0);
});

test('Withdrawal reports isolate Associate requests and exclude private gateway payloads', async () => {
  const { db, tables } = fixture();
  tables.withdrawalRequest.push(...[id(4), id(199)].map((guardUserId, i) => ({ id: id(200 + i), guardUserId, createdAt: new Date('2026-10-12T05:00:00Z'), status: 'requested', amount: new Prisma.Decimal('10.10'), feeAmount: new Prisma.Decimal('0.10'), netAmount: new Prisma.Decimal('10.00'), reviewedAt: null, rejectionReason: null, gatewayReference: null, gatewayStatus: null, gatewayResponse: 'PRIVATE GATEWAY PAYLOAD', idempotencyKey: 'PRIVATE KEY' })));
  const own = await extendedReport(db, associate, 'guard', 'withdrawals', range);
  assert.ok('items' in own); assert.equal(own.pagination.total, 1);
  const finance = await extendedReport(db, actor('finance'), 'finance', 'withdrawals', range);
  assert.ok('items' in finance); assert.equal(finance.pagination.total, 2);
  assert.ok(!JSON.stringify(finance).includes('PRIVATE'));
});

test('Legacy null application owners are included only through an authorised job; conflicting owners are excluded', async () => {
  const { db, tables } = fixture();
  tables.jobApplication[0].employerUserId = null;
  tables.jobApplication[1].employerUserId = id(999);
  tables.employerProfile[0].subAdminId = id(8000);
  tables.operationsAssignment.push({ operationsUserId: id(8000), employerUserId: owner.id, status: 'active' });
  for (const role of ['employer', 'sub_admin', 'operations'] as ReportingRole[]) {
    const result = await extendedReport(db, actor(role), role, 'recruitment-pipeline', {});
    assert.ok('items' in result);
    assert.equal(result.pagination.total, 4);
    assert.ok(result.items.some(row => row.id === tables.jobApplication[0].id));
    assert.ok(!result.items.some(row => row.id === tables.jobApplication[1].id));
  }
});

test('Filter options enforce role and portfolio scope, expose safe labels and support name search', async () => {
  const { db, tables } = fixture();
  tables.employerProfile[0].subAdminId = id(8000);
  const own = await extendedReportOptions(db, owner, 'employer', { kind: 'sites' });
  assert.equal(own.options.company_id.length, 1);
  const assigned = await extendedReportOptions(db, actor('sub_admin'), 'sub_admin', { kind: 'recruitment-pipeline' });
  assert.equal(assigned.options.employer_id.length, 1);
  const unrelated = await extendedReportOptions(db, actor('sales_executive'), 'sales_executive', { kind: 'recruitment-pipeline' });
  assert.equal(unrelated.options.employer_id.length, 0);
  const filtered = await extendedReportOptions(db, admin, 'super_admin', { kind: 'associate-statement', search: 'No match' });
  assert.equal(filtered.options.guard_id.length, 0);
  await assert.rejects(extendedReportOptions(db, owner, 'super_admin', { kind: 'employer-credits' }), /Forbidden/);
  assert.ok(!JSON.stringify(assigned).includes('PRIVATE'));
});

test('Invoice register uses calendar dates, excludes other Employers and keeps face value distinct', async () => {
  const { db, tables } = fixture();
  tables.invoice.push(...[owner.id, id(250)].map((employerUserId, i) => ({ id: id(260 + i), employerUserId, invoiceNumber: `INV-${i}`, invoiceDate: new Date('2026-10-12T00:00:00Z'), dueDate: new Date('2026-10-13T00:00:00Z'), paymentStatus: 'pending', amount: new Prisma.Decimal('100.10'), taxAmount: new Prisma.Decimal('18.02'), totalAmount: new Prisma.Decimal('118.12'), paidAt: null })));
  const result = await extendedReport(db, owner, 'employer', 'invoices', range);
  assert.ok('items' in result); assert.equal(result.pagination.total, 1);
  assert.equal(result.items[0].invoice_date, '2026-10-12');
  assert.equal(result.items[0].total, '118.12');
  assert.match(result.meta.warnings[0].message, /partial payment/);
});

test('Company/site registers enforce company ownership even with legacy missing site owner', async () => {
  const { db, tables } = fixture();
  tables.companySite.push({ id: id(300), companyId: id(20), siteName: 'Foreign', createdAt: new Date(), status: 'active' });
  tables.companySite[0].employerUserId = null;
  tables.companySite[0].createdAt = new Date('2026-10-12T05:00:00Z');
  const result = await extendedReport(db, owner, 'employer', 'sites', {});
  assert.ok('items' in result); assert.equal(result.pagination.total, 1);
  await assert.rejects(extendedReport(db, owner, 'employer', 'sites', { company_id: id(20) }), /report scope/);
});

test('CSV exports complete filtered datasets, metadata and formula-safe text; oversized exports fail', async () => {
  const { db, tables } = fixture(); tables.user[0].fullName = '=HYPERLINK("bad")';
  const csv = await extendedReport(db, admin, 'super_admin', 'employer-registrations', { page_size: '1', page: '2' }, true);
  assert.ok('csv' in csv); assert.match(csv.csv, /'=HYPERLINK/); assert.match(csv.csv, /Report metadata/);
  assert.ok(!csv.csv.includes('NEVER EXPOSE'));
  for (let i = 0; i < 5001; i++) tables.user.push({ ...tables.user[0], id: id(10000 + i) });
  await assert.rejects(extendedReport(db, admin, 'super_admin', 'employer-registrations', {}, true), /too large/);
});

test('Scoped reports reject mismatched parent filters before report reads', async () => {
  const { db, tables } = fixture();
  tables.invoice.push({ id: id(450), employerUserId: owner.id, companyId: id(20), invoiceDate: new Date(), paymentStatus: 'pending' });
  await assert.rejects(extendedReport(db, owner, 'employer', 'invoices', { company_id: id(20) }), /report scope/);
  await assert.rejects(extendedReport(db, admin, 'super_admin', 'recruitment-pipeline', { employer_id: owner.id, company_id: id(20) }), /report scope/);
});

test('Unauthenticated, inactive and unsupported actors cannot read reports or selectors', async () => {
  const { db, calls } = fixture();
  await assert.rejects(extendedReport(db, undefined, 'super_admin', 'employer-registrations', {}), /Unauthenticated/);
  await assert.rejects(extendedReport(db, { ...owner, accountStatus: 'inactive' }, 'employer', 'employer-credits', {}), /Forbidden/);
  await assert.rejects(extendedReportOptions(db, undefined, 'super_admin', { kind: 'employer-credits' }), /Unauthenticated/);
  assert.equal(calls.length, 0);
});

test('All role report routes and exports enforce exact roles, blocked status and strict validation', async () => {
  const { db } = fixture(), app = express();
  app.use((req, _res, next) => { req.user = { ...actor((req.headers['x-test-role'] ?? 'super_admin') as ReportingRole), accountStatus: String(req.headers['x-test-status'] ?? 'active') }; next(); });
  for (const role of Object.keys(EXTENDED_REPORTS) as ReportingRole[]) app.use(`/${role}`, createExtendedReportRouter(db, role));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const get = (path: string, role: ReportingRole, status = 'active') => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, { headers: { 'x-test-role': role, 'x-test-status': status } });
  try {
    for (const role of Object.keys(EXTENDED_REPORTS) as ReportingRole[]) {
      assert.equal((await get(`/${role}`, role)).status, 200);
      for (const definition of EXTENDED_REPORTS[role]) {
        for (const suffix of ['', '/export']) {
          const path = `/${role}/${definition.kind}${suffix}`;
          assert.equal((await get(path, role)).status, 200, path);
          assert.equal((await get(path, role, 'blocked')).status, 403, path);
          assert.equal((await get(path, role === 'super_admin' ? 'employer' : 'super_admin')).status, 403, path);
        }
      }
    }
    assert.equal((await get('/super_admin/employer-registrations?date_from=2026-02-30', 'super_admin')).status, 422);
    assert.equal((await get('/super_admin/employer-registrations?date_from=2026-10-13&date_to=2026-10-12', 'super_admin')).status, 422);
    assert.equal((await get('/super_admin/employer-registrations?unexpected=1', 'super_admin')).status, 422);
    assert.equal((await get('/finance/employer-credits', 'finance')).status, 404);
    assert.equal((await get('/employer/employer-registrations', 'employer')).status, 404);
    assert.equal((await get('/super_admin/employer-registrations', 'super_admin')).headers.get('cache-control'), 'no-store');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
