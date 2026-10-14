import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { financialReport, inspectWalletHistory, EMPLOYER_FINANCIAL_KINDS, ADMIN_FINANCIAL_KINDS } from '../src/reporting/financialReports';
import { createEmployerReportRouter } from '../src/routes/employerReportRoutes';
import { createAdminReportRouter } from '../src/routes/adminReportRoutes';
import { errorHandler } from '../src/middleware/error';
import { fixture, id, owner, company, type Row } from './reportFixture';
const admin = { id: id(9000), role: 'super_admin', accountStatus: 'active' };
const range = { date_from: '2026-10-12', date_to: '2026-10-12' };
const hasStatus = (status: number) => (error: Row) => error.status === status;

test('payment scope resolves attendance/application jobs and exposes unlinked payments in account view', async () => {
  const { db, tables } = fixture();
  tables.payment[0].jobId = null;
  tables.payment.push({ id: id(10000), employerUserId: owner.id, guardUserId: id(4), jobId: null, attendanceId: null, applicationId: null, amount: new Prisma.Decimal('0.01'), paymentStatus: 'pending', createdAt: new Date('2026-10-12T12:00:00Z'), paymentDate: null });
  tables.payment.push({ ...tables.payment[1], id: id(10001), amount: new Prisma.Decimal('0.02') });
  const account = await financialReport(db, owner, 'employer', 'payments', range);
  assert.ok('items' in account); assert.equal(account.pagination.total, 3);
  assert.equal(object(account.summary.recorded_payment_statuses).pending.amount, '0.03');
  const linked = account.items.find(p => p.id === id(2005))!;
  assert.equal(linked.linkage, 'attendance-linked'); assert.equal(linked.status, 'processing'); assert.equal(linked.debit_amount, '987.65'); assert.equal(linked.associate_credit_status, 'processing');
  const scoped = await financialReport(db, owner, 'employer', 'payments', { ...range, company_id: company });
  assert.ok('items' in scoped); assert.equal(scoped.pagination.total, 1); assert.equal(scoped.summary.unattributed_account_payments, 2);
  assert.ok(scoped.meta.warnings.some(w => w.code === 'unattributed_payments'));
});
const object = (v: unknown) => v as Row;

test('conflicting references are flagged without disclosing a foreign job/company', async () => {
  const { db, tables } = fixture();
  tables.jobPost.push({ ...tables.jobPost[0], id: id(10100), employerUserId: id(21), companyId: id(20), title: 'FOREIGN JOB' });
  tables.payment[0].jobId = id(10100);
  const result = await financialReport(db, owner, 'employer', 'payments', {});
  assert.ok('items' in result); assert.equal(result.items[0].linkage, 'conflicting'); assert.equal(result.items[0].company, null);
  assert.ok(!JSON.stringify(result).includes('FOREIGN JOB')); assert.ok(!JSON.stringify(result).includes('Company B'));
  const scoped = await financialReport(db, owner, 'employer', 'payments', { company_id: company });
  assert.ok('items' in scoped); assert.equal(scoped.pagination.total, 0);
});

test('decimal amounts and recorded payment date filters preserve exact semantics', async () => {
  const { db } = fixture();
  const below = await financialReport(db, owner, 'employer', 'payments', { min_amount: '1000.00' });
  assert.ok('items' in below); assert.equal(below.pagination.total, 0);
  const within = await financialReport(db, owner, 'employer', 'payments', { ...range, date_basis: 'recorded-payment', min_amount: '987.65', max_amount: '987.65' });
  assert.ok('items' in within); assert.equal(within.items[0].amount, '987.65'); assert.equal(within.meta.date_basis, 'payments.payment_date (not completion date)');
  await assert.rejects(financialReport(db, owner, 'employer', 'payments', { date_basis: 'completed' }), hasStatus(422));
  await assert.rejects(financialReport(db, owner, 'employer', 'payments', { min_amount: '1.01', max_amount: '1.00' }), (error: unknown) => error instanceof ZodError && error.issues[0].path[0] === 'max_amount');
});

test('wallet history reconstruction validates continuity, counters, and precise IST opening/closing', async () => {
  const { db } = fixture();
  const result = await financialReport(db, owner, 'employer', 'wallet-statement', range);
  assert.ok('items' in result);
  assert.equal(result.pagination.total, 2); assert.equal(result.summary.opening_balance, '20000.10'); assert.equal(result.summary.closing_balance, '20012.65');
  assert.equal(result.summary.current_deposit_balance, '19012.45'); assert.equal(result.summary.current_admin_credit_balance, '1000.20');
  const subset = await financialReport(db, owner, 'employer', 'wallet-statement', { ...range, source: 'job_payment' });
  assert.ok('items' in subset); assert.equal(subset.pagination.total, 1); assert.equal(subset.summary.opening_balance, '20000.10'); assert.equal(subset.summary.account_period_credits, '1000.20');
});

test('incomplete history gives unknown balances, never an invented opening balance', async () => {
  const { db, tables } = fixture();
  tables.walletTransaction[0].balanceAfter = null;
  const result = await financialReport(db, owner, 'employer', 'wallet-statement', range);
  assert.ok('items' in result); assert.equal(result.summary.opening_balance, null); assert.equal(result.summary.current_balance, '20012.65'); assert.ok(result.meta.warnings.some(w => w.code === 'history_unavailable'));
  const badDate = inspectWalletHistory(tables.employerWallet[0], [{ ...tables.walletTransaction[0], createdAt: null }], {});
  assert.equal(badDate.history_status, 'unavailable');
  const unknownCounter = inspectWalletHistory({ ...tables.employerWallet[0], totalRecharged: null }, [], {});
  assert.equal(unknownCounter.history_status, 'unavailable');
});

test('wallet absence does not create a wallet or assume an account balance', async () => {
  const { db, tables, calls } = fixture(); tables.employerWallet.length = 0;
  const result = await financialReport(db, owner, 'employer', 'wallet-statement', {});
  assert.ok('items' in result); assert.equal(result.pagination.total, 0); assert.equal(result.summary.current_balance, null); assert.ok(result.meta.warnings.some(w => w.code === 'wallet_not_created'));
  assert.ok(calls.every(c => !/create|update|delete|upsert/i.test(c)));
});

test('admin wallet snapshot includes registered Employers without wallets', async () => {
  const { db, tables } = fixture();
  tables.user.push({ id: id(21), role: 'employer', fullName: 'Employer B', accountStatus: 'active' });
  const result = await financialReport(db, admin, 'super_admin', 'wallets', {});
  assert.ok('items' in result); assert.equal(result.pagination.total, 2); assert.equal(result.summary.wallets_not_created, 1);
  assert.equal(result.items.find(r => r.id === id(21))?.balance, null);
  assert.equal(result.summary.current_balance, '20012.65');
  await assert.rejects(financialReport(db, admin, 'super_admin', 'wallets', range), hasStatus(422));
});

test('settlement diagnostics inspect typed, owner-matched ledger references and complete filter totals', async () => {
  const { db, tables } = fixture();
  tables.associateWalletTransaction[0].amount = new Prisma.Decimal('1.00');
  const result = await financialReport(db, admin, 'super_admin', 'settlements', { link_condition: 'amount-mismatch' });
  assert.ok('items' in result); assert.equal(result.pagination.total, 1); assert.ok(String(result.items[0].diagnostics).includes('amount-mismatch'));
  tables.associateWalletTransaction.length = 0;
  const missing = await financialReport(db, admin, 'super_admin', 'settlements', { link_condition: 'missing-credit' });
  assert.ok('items' in missing); assert.equal(missing.pagination.total, 1);
  assert.ok(!JSON.stringify(result).includes('PRIVATE METADATA'));
});

test('unavailable ledger evidence is partial and cannot be exported or filtered as zero', async () => {
  const { db } = fixture();
  db.associateWalletTransaction.findMany = () => { throw new Prisma.PrismaClientKnownRequestError('missing table', { code: 'P2021', clientVersion: 'test' }); };
  const result = await financialReport(db, owner, 'employer', 'payments', {});
  assert.ok('items' in result); assert.equal(result.summary.investigation_flags, 'Unavailable'); assert.ok(result.meta.warnings.some(w => w.code === 'missing_schema'));
  await assert.rejects(financialReport(db, owner, 'employer', 'payments', {}, true), hasStatus(503));
  await assert.rejects(financialReport(db, admin, 'super_admin', 'settlements', { link_condition: 'missing-credit' }), hasStatus(503));
});

test('financial CSV exports all matching payments beyond 250 and rejects over-limit exports', async () => {
  const { db, tables } = fixture();
  const sample = tables.payment[0]; tables.payment = Array.from({ length: 301 }, (_, i) => ({ ...sample, id: id(11000 + i), amount: new Prisma.Decimal('0.01'), paymentStatus: 'pending' }));
  const result = await financialReport(db, owner, 'employer', 'payments', { page: '7' });
  assert.ok('items' in result); assert.equal(result.items.length, 1); assert.equal(object(result.summary.recorded_payment_statuses).pending.amount, '3.01');
  const csv = await financialReport(db, owner, 'employer', 'payments', { page: '7' }, true);
  assert.ok('csv' in csv); assert.equal(csv.csv.split('\r\n').length, 303);
  tables.payment = Array.from({ length: 5001 }, (_, i) => ({ ...sample, id: id(12000 + i) }));
  await assert.rejects(financialReport(db, owner, 'employer', 'payments', {}, true), hasStatus(422));
});

test('HTTP financial routes enforce role, account ownership and wallet scope for rows and exports', async () => {
  const { db, tables, calls } = fixture();
  tables.user.push({ id: id(21), role: 'employer', fullName: 'Employer B', accountStatus: 'active' });
  const app = express(); app.use((req, _res, next) => { const role = req.header('x-test-role') ?? 'employer'; req.user = { ...(role === 'super_admin' ? admin : owner), role } as any; next(); });
  app.use('/api/employer/reports', createEmployerReportRouter(db)); app.use('/api/admin/reports', createAdminReportRouter(db)); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    const get = (path: string, role = 'employer') => fetch(base + path, { headers: { 'x-test-role': role } });
    for (const kind of EMPLOYER_FINANCIAL_KINDS) {
      assert.equal((await get(`/employer/reports/${kind}`, 'super_admin')).status, 403);
      assert.equal((await get(`/employer/reports/${kind}?employer_id=${id(21)}`)).status, 422);
      assert.equal((await get(`/employer/reports/${kind}/export?employer_id=${id(21)}`)).status, 422);
    }
    for (const kind of ADMIN_FINANCIAL_KINDS) assert.equal((await get(`/admin/reports/${kind}`)).status, 403);
    assert.equal((await get(`/employer/reports/payments?company_id=${id(20)}`)).status, 404);
    assert.equal((await get(`/employer/reports/wallet-statement?company_id=${company}`)).status, 422);
    assert.equal((await get('/employer/reports/wallet-statement?date_basis=posted')).status, 422);
    assert.equal((await get('/employer/reports/payments?min_amount=1.01&max_amount=1.00')).status, 422);
    const movements = await get('/admin/reports/wallet-movements', 'super_admin'); assert.equal(movements.status, 200); assert.equal(movements.headers.get('cache-control'), 'no-store');
    const body = await movements.json() as Row; assert.ok(body.meta.warnings.some((w: Row) => w.code === 'mock_recharge'));
    const csv = await get('/employer/reports/wallet-statement/export'); assert.equal(csv.status, 200); assert.ok(csv.headers.get('content-disposition')?.includes('attachment'));
    assert.ok(!(await csv.text()).includes('PRIVATE METADATA'));
    assert.equal((await get('/employer/reports/financial-options')).status, 200);
    assert.ok(calls.every(c => !/create|update|delete|upsert/i.test(c)));
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});

test('orphan wallet movements remain visible to Super Admin without being assigned to an Employer', async () => {
  const { db, tables } = fixture();
  tables.walletTransaction.push({ ...tables.walletTransaction[0], id: id(16000), walletId: id(16001), employerUserId: owner.id });
  const adminView = await financialReport(db, admin, 'super_admin', 'wallet-movements', {});
  assert.ok('items' in adminView); assert.equal(adminView.pagination.total, 4);
  assert.equal(adminView.items.find(r => r.id === id(16000))?.employer, null);
  assert.ok(adminView.meta.warnings.some(w => w.code === 'orphan_wallet_reference'));
  const ownerView = await financialReport(db, owner, 'employer', 'wallet-statement', {});
  assert.ok('items' in ownerView); assert.equal(ownerView.pagination.total, 3);
});
