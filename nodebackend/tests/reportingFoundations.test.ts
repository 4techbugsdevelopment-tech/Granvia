import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readInChunks, reportAmountRange, reportDateRange, reportOrderBy, reportPagination, reportQuerySchema, validateDateOrder } from '../src/reporting/query';
import { assertReportRole, resolveReportScope } from '../src/reporting/scope';
import { reportCsv, reportResponse } from '../src/reporting/response';
import { HttpError } from '../src/utils/http';

const employer = { id: 'owner-a', role: 'employer', accountStatus: 'active' };
const admin = { id: 'admin', role: 'super_admin', accountStatus: 'active' };
const isStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;

function reader(options: { owner?: string; siteOwner?: string | null; missing?: boolean } = {}) {
  const calls: string[] = [];
  const owner = options.owner ?? 'owner-a';
  const db = {
    user: { findFirst: async () => { calls.push('user.read'); return options.missing ? null : { id: owner }; } },
    employerCompany: { findUnique: async () => { calls.push('company.read'); return options.missing ? null : { employerUserId: owner }; } },
    companySite: { findUnique: async () => { calls.push('site.read'); return options.missing ? null : { companyId: 'company-a', employerUserId: options.siteOwner ?? null }; } },
    jobPost: { findUnique: async () => { calls.push('job.read'); return options.missing ? null : { employerUserId: owner, companyId: 'company-a', siteId: 'site-a' }; } },
  } as unknown as Parameters<typeof resolveReportScope>[0];
  return { db, calls };
}

test('timestamp days use IST boundaries, including year rollover', () => {
  const range = reportDateRange({ date_from: '2026-12-31', date_to: '2026-12-31' }, 'timestamp');
  assert.equal(range.gte?.toISOString(), '2026-12-30T18:30:00.000Z');
  assert.equal(range.lt?.toISOString(), '2026-12-31T18:30:00.000Z');
  assert.equal(reportDateRange({ date_to: '2026-01-01' }, 'timestamp').lt?.toISOString(), '2026-01-01T18:30:00.000Z');
});

test('calendar-date ranges stay unshifted and accept leap days', () => {
  const range = reportDateRange({ date_from: '2024-02-29', date_to: '2024-02-29' }, 'calendar');
  assert.equal(range.gte?.toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(range.lt?.toISOString(), '2024-03-01T00:00:00.000Z');
  assert.deepEqual(reportDateRange({}, 'calendar'), {});
});

test('invalid calendars, arrays, reversed dates and unsupported query keys fail', () => {
  for (const query of [{ date_from: '2026-02-29' }, { date_to: '2026-04-31' }, { date_from: ['2026-01-01'] }, { status: 'unknown' }, { company_id: 'bad' }]) {
    assert.equal(reportQuerySchema.safeParse(query).success, false);
  }
  assert.throws(() => validateDateOrder({ date_from: '2026-02-02', date_to: '2026-02-01' }));
});

test('pagination defaults and bounds reject unsafe numeric input', () => {
  const defaults = reportQuerySchema.parse({});
  assert.deepEqual(reportPagination(defaults), { skip: 0, take: 50 });
  assert.deepEqual(reportPagination(reportQuerySchema.parse({ page: '6', page_size: '50' })), { skip: 250, take: 50 });
  for (const page of ['0', '-1', '1.5', '1e2', '1000001']) assert.equal(reportQuerySchema.safeParse({ page }).success, false);
  assert.equal(reportQuerySchema.safeParse({ page_size: '101' }).success, false);
});

test('sort allowlist and ID tie-breaker', () => {
  assert.deepEqual(reportOrderBy('createdAt', 'desc', ['createdAt']), [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert.throws(() => reportOrderBy('password', 'asc', ['createdAt']));
});

test('amount filters preserve decimals and reject invalid ranges', () => {
  assert.deepEqual(reportAmountRange({ min_amount: '0.10', max_amount: '9999999999.99' }), { gte: '0.10', lte: '9999999999.99' });
  assert.deepEqual(reportAmountRange({ min_amount: '0' }), { gte: '0' });
  for (const value of ['NaN', 'Infinity', '-1', '1e3', '0.001', '10000000000']) assert.throws(() => reportAmountRange({ min_amount: value }));
  assert.throws(() => reportAmountRange({ min_amount: '1.01', max_amount: '1.00' }));
});

test('authentication, exact role and inactive accounts are denied', () => {
  assert.throws(() => assertReportRole(null, 'employer'), isStatus(401));
  assert.throws(() => assertReportRole(admin, 'employer'), isStatus(403));
  assert.throws(() => assertReportRole(employer, 'super_admin'), isStatus(403));
  for (const accountStatus of ['inactive', 'blocked']) assert.throws(() => assertReportRole({ ...employer, accountStatus }, 'employer'), isStatus(403));
});

test('Employer identity cannot be replaced by a query filter', async () => {
  const { db, calls } = reader();
  await assert.rejects(resolveReportScope(db, employer, 'employer', { employer_id: 'owner-b' }), isStatus(422));
  assert.deepEqual(calls, []);
  assert.deepEqual(await resolveReportScope(db, employer, 'employer', {}), { employerUserId: employer.id });
});

test('foreign company, job and null-owner legacy site are denied', async () => {
  for (const filters of [{ company_id: 'company-a' }, { job_id: 'job-a' }, { site_id: 'site-a' }]) {
    await assert.rejects(resolveReportScope(reader({ owner: 'owner-b' }).db, employer, 'employer', filters), isStatus(404));
  }
});

test('job and site filters resolve parent ownership using reads only', async () => {
  const { db, calls } = reader();
  assert.deepEqual(await resolveReportScope(db, employer, 'employer', { job_id: 'job-a' }), {
    employerUserId: 'owner-a', companyId: 'company-a', siteId: 'site-a', jobId: 'job-a',
  });
  assert.deepEqual(calls, ['job.read', 'site.read', 'company.read']);
});

test('conflicting parents and missing references are denied', async () => {
  for (const filters of [{ job_id: 'job-a', company_id: 'company-b' }, { job_id: 'job-a', site_id: 'site-b' }, { site_id: 'site-a', company_id: 'company-b' }]) {
    await assert.rejects(resolveReportScope(reader().db, employer, 'employer', filters), isStatus(404));
  }
  await assert.rejects(resolveReportScope(reader({ missing: true }).db, employer, 'employer', { job_id: 'job-a' }), isStatus(404));
  await assert.rejects(resolveReportScope(reader({ siteOwner: 'owner-b' }).db, admin, 'super_admin', { site_id: 'site-a' }), isStatus(404));
});

test('admin platform scope and explicit employer narrowing', async () => {
  assert.deepEqual(await resolveReportScope(reader().db, admin, 'super_admin', {}), {});
  assert.deepEqual(await resolveReportScope(reader().db, admin, 'super_admin', { employer_id: 'owner-a' }), { employerUserId: 'owner-a' });
  await assert.rejects(resolveReportScope(reader({ missing: true }).db, admin, 'super_admin', { employer_id: 'owner-a' }), isStatus(404));
});

test('wallet balance scope cannot silently become company or job scoped', async () => {
  for (const filters of [{ company_id: 'company-a' }, { site_id: 'site-a' }, { job_id: 'job-a' }]) {
    await assert.rejects(resolveReportScope(reader().db, employer, 'employer', filters, 'wallet'), isStatus(422));
  }
});

test('full totals and unavailable sections remain separate from the page', () => {
  const result = reportResponse([{ id: 'one' }], { amount: '1234.56' }, 301, { page: 7, page_size: 50 }, {
    scope: { employerUserId: 'owner-a' }, filters: {}, date_basis: 'created_at',
    warnings: [{ code: 'missing_schema', section: 'exceptions', message: 'Unavailable' }],
  });
  assert.equal(result.pagination.total_pages, 7);
  assert.equal(result.pagination.total, 301);
  assert.equal(result.meta.partial, true);
  assert.equal(result.summary.amount, '1234.56');
  assert.equal(result.meta.timezone, 'Asia/Kolkata');
});

test('CSV preserves Unicode, quotes and line breaks and neutralises formulas', () => {
  const csv = reportCsv([{ name: 'Associate, "A"\nभारत', reference: ' \t=HYPERLINK("x")', amount: '1234.50' }], [
    { header: 'Name', value: row => row.name }, { header: 'Reference', value: row => row.reference }, { header: 'Amount', value: row => row.amount },
  ], 1, 100);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Associate, ""A""\nभारत"'));
  assert.ok(csv.includes('"\' \t=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"1234.50"'));
});

test('exports refuse truncated data and explicit size-limit overruns', () => {
  assert.throws(() => reportCsv([], [], 251, 1000), isStatus(409));
  assert.throws(() => reportCsv([], [], 251, 250), isStatus(422));
  const rows = Array.from({ length: 301 }, (_, id) => ({ id }));
  const csv = reportCsv(rows, [{ header: 'ID', value: row => row.id }], 301, 1000);
  assert.equal(csv.split('\r\n').length, 303);
});

test('related reads deduplicate IDs and never exceed a bounded SQL batch', async () => {
  const ids = Array.from({ length: 5001 }, (_, i) => String(i)), batches: number[] = [];
  const rows = await readInChunks([...ids, ...ids], async batch => { batches.push(batch.length); return batch; });
  assert.equal(rows.length, 5001); assert.equal(batches.length, 11); assert.ok(batches.every(n => n <= 500));
});
