import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../utils/http';
import { employerReport, EXPORT_LIMIT, type Column } from './employerReports';
import { readInChunks, reportDateRange, reportPagination, reportQuerySchema } from './query';
import { reportCsv, reportResponse, type ReportWarning } from './response';
import { assertReportRole, resolveReportScope, type ReportActor } from './scope';

type Db = Prisma.TransactionClient;
type Row = Record<string, unknown>;
type Reader = { findMany(args: Row): Promise<Row[]>; count(args: Row): Promise<number>; groupBy(args: Row): Promise<Row[]>; aggregate(args: Row): Promise<Row> };
export const ADMIN_REPORT_KINDS = ['platform-summary', 'employer-verification', 'company-verification', 'company-documents', 'associate-verification', 'associate-documents', 'job-hiring', 'applications', 'attendance', 'attendance-exceptions', 'attendance-audit'] as const;
export type AdminReportKind = typeof ADMIN_REPORT_KINDS[number];
const object = (v: unknown): Row => (v ?? {}) as Row;
const scalar = (v: unknown): string | number | null => v == null ? null : v instanceof Date ? v.toISOString() : typeof v === 'number' ? v : String(v);
function reader(db: Db, name: string): Reader {
  const table = (db as unknown as Record<string, Reader>)[name];
  if (!table) throw new HttpError(503, 'This report is unavailable because the running server database client is missing an update.');
  return table;
}
function isMissing(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && ['P2021', 'P2022'].includes(error.code); }
const col = (...pairs: string[][]): Column[] => pairs.map(([key, label]) => ({ key, label }));
const schema = reportQuerySchema.extend({
  guard_id: z.string().uuid().optional(), sub_admin_id: z.string().uuid().optional(), sales_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(), attendance_id: z.string().uuid().optional(), exception_id: z.string().uuid().optional(),
  status: z.string().min(1).max(50).optional(), verification_status: z.string().min(1).max(50).optional(),
  aadhaar_status: z.string().min(1).max(50).optional(), police_status: z.string().min(1).max(50).optional(),
  profile_status: z.string().min(1).max(50).optional(), agreement_status: z.string().min(1).max(50).optional(),
  associate_type: z.string().min(1).max(120).optional(), document_type: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(150).optional(), state: z.string().min(1).max(150).optional(),
  event_type: z.string().min(1).max(60).optional(), date_basis: z.string().optional(),
}).strict();
type Query = z.infer<typeof schema>;
const fields: Record<string, string> = { fullName: 'name', createdAt: 'created_at', accountStatus: 'account_status', companyName: 'company', city: 'city', state: 'state', profileType: 'associate_type', documentType: 'document_type', verificationStatus: 'verification_status', adminRemarks: 'remarks', rejectionReason: 'rejection_reason', status: 'status', reviewedAt: 'reviewed_at', eventAt: 'event_at', eventType: 'event_type', actorRole: 'actor_role', attendanceDate: 'attendance_date', attendanceRecordId: 'attendance_id', exceptionRequestId: 'exception_id', remarks: 'remarks' };
const columns: Partial<Record<AdminReportKind, Column[]>> = {
  'platform-summary': col(['metric', 'Metric'], ['value', 'Value'], ['basis', 'Basis'], ['date_field', 'Date basis']),
  'employer-verification': col(['id', 'Employer ID'], ['name', 'Employer'], ['created_at', 'Registered date'], ['account_status', 'Account'], ['profile_status', 'Profile'], ['verification_status', 'Overall verification'], ['aadhaar_status', 'Aadhaar'], ['city', 'City'], ['state', 'State'], ['sub_admin', 'Sub Admin'], ['sales', 'Sales Executive'], ['companies', 'Companies'], ['sites', 'Sites'], ['jobs', 'Jobs']),
  'company-verification': col(['id', 'Company ID'], ['employer', 'Employer'], ['company', 'Company'], ['created_at', 'Created date'], ['account_status', 'Account'], ['verification_status', 'Verification'], ['city', 'City'], ['state', 'State'], ['sites', 'Sites'], ['jobs', 'Jobs'], ['documents', 'Documents'], ['remarks', 'Remarks'], ['rejection_reason', 'Rejection reason']),
  'company-documents': col(['id', 'Document ID'], ['employer', 'Employer'], ['company', 'Company'], ['document_type', 'Document type'], ['created_at', 'Uploaded date'], ['verification_status', 'Review status'], ['remarks', 'Remarks'], ['rejection_reason', 'Rejection reason']),
  'associate-verification': col(['id', 'Associate ID'], ['name', 'Associate'], ['associate_type', 'Associate type'], ['created_at', 'Registered date'], ['account_status', 'Account'], ['verification_status', 'Overall verification'], ['aadhaar_status', 'Aadhaar'], ['police_status', 'Police'], ['city', 'City'], ['state', 'State'], ['sub_admin', 'Sub Admin'], ['documents', 'Uploaded documents'], ['agreement_version', 'Current agreement version'], ['agreement_status', 'Current agreement status']),
  'associate-documents': col(['id', 'Document ID'], ['associate', 'Associate'], ['document_type', 'Document type'], ['created_at', 'Uploaded date'], ['reviewed_at', 'Reviewed date'], ['status', 'Review status'], ['reviewer', 'Reviewer'], ['remarks', 'Remarks']),
  'attendance-audit': col(['id', 'Event ID'], ['event_type', 'Event type'], ['event_at', 'Event time'], ['attendance_date', 'Attendance date'], ['actor', 'Actor'], ['actor_role', 'Actor role'], ['associate', 'Associate'], ['employer', 'Employer'], ['job', 'Job'], ['site', 'Site'], ['attendance_id', 'Attendance ID'], ['exception_id', 'Exception ID'], ['remarks', 'Remarks']),
};
function date(q: Query, allowed: Record<string, readonly [string, 'timestamp' | 'calendar']>, fallback: string) {
  const spec = allowed[q.date_basis ?? fallback];
  if (!spec) throw new HttpError(422, 'Unsupported date basis for this report.');
  const range = reportDateRange(q, spec[1]);
  return { field: spec[0], where: Object.keys(range).length ? { [spec[0]]: range } : {} };
}
function validateFilters(raw: unknown, allowed: string[]) {
  const common = ['page', 'page_size', 'date_from', 'date_to', 'date_basis'];
  for (const key of Object.keys(raw as Row)) if (![...common, ...allowed].includes(key)) throw new HttpError(422, `Unsupported filter: ${key}.`);
}
function mapped(row: Row) {
  const output: Row = { id: row.id };
  for (const [source, target] of Object.entries(fields)) if (source in row) output[target] = scalar(row[source]);
  return output;
}
async function counts(db: Db, table: string, by: string, where: Row) {
  const groups = await reader(db, table).groupBy({ by: [by], where, _count: { _all: true } });
  return new Map(groups.map(g => [String(g[by]), Number(object(g._count)._all)]));
}
function finish(kind: AdminReportKind, rows: Row[], summary: Row, total: number, q: Query, scope: Record<string, string>, dateField: string, warnings: ReportWarning[], exporting: boolean) {
  const cols = columns[kind]!;
  if (exporting) {
    if (warnings.some(w => w.code === 'missing_schema')) throw new HttpError(503, 'Export is unavailable while required report enrichment is missing.');
    return { csv: reportCsv(rows, [...cols.map(c => ({ header: c.label, value: (r: Row) => {
      const v = scalar(r[c.key]);
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return c.key === 'attendance_date' ? v.slice(0, 10) : new Date(Date.parse(v) + 330 * 60000).toISOString().replace('Z', '+05:30');
      return v;
    } })), { header: 'Reporting timezone', value: () => 'Asia/Kolkata' }, { header: 'Date basis', value: () => dateField },
      { header: 'From date', value: () => q.date_from ?? null }, { header: 'Through date', value: () => q.date_to ?? null },
      { header: 'Report scope', value: () => JSON.stringify(scope) }, { header: 'Report warnings', value: () => warnings.map(w => w.message).join('; ') }], total, EXPORT_LIMIT) };
  }
  return { ...reportResponse(rows, summary, total, q, { scope, filters: q, date_basis: dateField, warnings }), columns: cols };
}

async function platformSummary(db: Db, q: Query, exporting: boolean) {
  const timestamp = reportDateRange(q, 'timestamp'), calendar = reportDateRange(q, 'calendar');
  if (q.date_basis && q.date_basis !== 'activity') throw new HttpError(422, 'Platform summary uses each activity metric’s own date basis.');
  const rows: Row[] = [];
  const add = (metric: string, value: unknown, basis: string, field: string) => rows.push({ id: String(rows.length), metric, value: scalar(value), basis, date_field: field });
  for (const role of ['employer', 'guard']) {
    const label = role === 'guard' ? 'Associates' : 'Employers';
    const statuses = await counts(db, 'user', 'accountStatus', { role });
    for (const [status, count] of statuses) add(`${label}: ${status}`, count, 'Current account snapshot', 'No historical status date');
    add(`${label} registered`, await db.user.count({ where: { role, ...(Object.keys(timestamp).length ? { createdAt: timestamp } : {}) } }), 'Period activity', 'Registration date');
  }
  for (const [table, field, label] of [['jobPost', 'createdAt', 'Jobs posted'], ['jobApplication', 'appliedAt', 'Applications received'], ['attendanceRecord', 'attendanceDate', 'Attendance sessions']] as const) {
    const current = await counts(db, table, 'status', {});
    for (const [status, count] of current) add(`${label}: ${status}`, count, 'Current stored status', 'No historical status date');
    add(label, await reader(db, table).count({ where: { [field]: field === 'attendanceDate' ? calendar : timestamp } }), 'Period activity', field === 'attendanceDate' ? 'Attendance date' : field === 'appliedAt' ? 'Application date' : 'Job posting date');
  }
  const hours = await db.attendanceRecord.aggregate({ where: { attendanceDate: calendar }, _sum: { totalHours: true } });
  add('Recorded attendance hours', hours._sum.totalHours ?? '0', 'Period activity', 'Attendance date');
  const payments = await db.payment.groupBy({ by: ['paymentStatus'], where: { createdAt: timestamp }, _count: { _all: true }, _sum: { amount: true } });
  for (const p of payments) { add(`Payments created: ${p.paymentStatus}`, p._count._all, 'Period activity, current payment status', 'Payment creation date'); add(`Payment amount INR: ${p.paymentStatus}`, p._sum.amount ?? '0', 'Period activity, current payment status', 'Payment creation date'); }
  return finish('platform-summary', rows, {}, rows.length, { ...q, page: 1, page_size: Math.min(100, Math.max(1, rows.length)) }, {}, 'Per-metric activity dates', [], exporting);
}

export async function adminReport(db: Db, actor: ReportActor | undefined, kind: AdminReportKind, rawQuery: unknown, exporting = false) {
  assertReportRole(actor, 'super_admin');
  if (['job-hiring', 'applications', 'attendance', 'attendance-exceptions'].includes(kind)) return employerReport(db, actor, kind as 'job-hiring' | 'applications' | 'attendance' | 'attendance-exceptions', rawQuery, exporting, 'super_admin');
  const q = schema.parse(rawQuery);
  if (kind === 'company-documents' && q.status && q.verification_status && q.status !== q.verification_status) throw new HttpError(422, 'Document review status filters must agree.');
  if (kind === 'platform-summary') { validateFilters(rawQuery, []); return platformSummary(db, q, exporting); }
  const scopeFilters = ['employer_id', 'company_id'];
  let tableName: string, where: Row, select: Row, dateSpec: ReturnType<typeof date>, statusField: string;
  const warnings: ReportWarning[] = [];
  let scope: Record<string, string> = {};
  const employerKinds = ['employer-verification', 'company-verification', 'company-documents'];
  const associateKinds = ['associate-verification', 'associate-documents'];
  let matchedCompanies: { id: string; employerUserId: string; companyName: string }[] = [];
  let currentAgreements: { associatePartnerId: string; currentKey: string | null; agreementVersion: string; status: string }[] = [];
  if (employerKinds.includes(kind)) {
    validateFilters(rawQuery, [...scopeFilters, 'status', 'verification_status', 'aadhaar_status', 'profile_status', 'city', 'state', 'sub_admin_id', 'sales_id', ...(kind === 'company-documents' ? ['document_type'] : [])]);
    scope = await resolveReportScope(db, actor, 'super_admin', q);
    const profileWhere = { ...(q.sub_admin_id ? { subAdminId: q.sub_admin_id } : {}), ...(q.sales_id ? { salesExecutiveId: q.sales_id } : {}),
      ...(q.aadhaar_status ? { aadhaarVerificationStatus: q.aadhaar_status } : {}), ...(q.profile_status ? { profileStatus: q.profile_status } : {}) };
    const userWhere = { role: 'employer', ...(scope.employerUserId ? { id: scope.employerUserId } : {}),
      ...(Object.keys(profileWhere).length ? { employerProfile: profileWhere } : {}) };
    const owners = await db.user.findMany({ where: userWhere, select: { id: true } });
    const companyWhere = { employerUserId: { in: owners.map(u => u.id) }, ...(scope.companyId ? { id: scope.companyId } : {}),
      ...(kind !== 'employer-verification' && q.city ? { city: q.city } : {}), ...(kind !== 'employer-verification' && q.state ? { state: q.state } : {}) };
    matchedCompanies = await db.employerCompany.findMany({ where: companyWhere, select: { id: true, employerUserId: true, companyName: true } });
    if (kind === 'employer-verification') {
      dateSpec = date(q, { registered: ['createdAt', 'timestamp'] }, 'registered'); tableName = 'user'; statusField = 'accountStatus';
      where = { ...userWhere, ...dateSpec.where, ...(scope.companyId ? { id: { in: matchedCompanies.map(c => c.employerUserId) } } : {}),
        ...(q.status ? { accountStatus: q.status } : {}),
        ...((q.city || q.state || q.verification_status) ? { employerProfile: { ...profileWhere, ...(q.city ? { city: q.city } : {}), ...(q.state ? { state: q.state } : {}), ...(q.verification_status ? { verificationStatus: q.verification_status } : {}) } } : {}) };
      select = { id: true, fullName: true, createdAt: true, accountStatus: true, employerProfile: { select: { city: true, state: true, profileStatus: true, verificationStatus: true, aadhaarVerificationStatus: true, subAdminId: true, salesExecutiveId: true } } };
    } else if (kind === 'company-verification') {
      dateSpec = date(q, { created: ['createdAt', 'timestamp'] }, 'created'); tableName = 'employerCompany'; statusField = 'verificationStatus';
      where = { ...companyWhere, ...dateSpec.where, ...(q.status ? { accountStatus: q.status } : {}), ...(q.verification_status ? { verificationStatus: q.verification_status } : {}) };
      select = { id: true, employerUserId: true, companyName: true, createdAt: true, accountStatus: true, verificationStatus: true, city: true, state: true, adminRemarks: true, rejectionReason: true };
    } else {
      dateSpec = date(q, { uploaded: ['createdAt', 'timestamp'] }, 'uploaded'); tableName = 'companyDocument'; statusField = 'verificationStatus';
      where = { companyId: { in: matchedCompanies.map(c => c.id) }, ...dateSpec.where, ...(q.status ? { verificationStatus: q.status } : {}), ...(q.verification_status ? { verificationStatus: q.verification_status } : {}), ...(q.document_type ? { documentType: q.document_type } : {}) };
      select = { id: true, companyId: true, employerUserId: true, documentType: true, createdAt: true, verificationStatus: true, adminRemarks: true, rejectionReason: true };
    }
  } else if (associateKinds.includes(kind)) {
    validateFilters(rawQuery, ['guard_id', 'associate_type', 'sub_admin_id', 'city', 'state', 'status', 'verification_status', 'aadhaar_status', 'police_status', 'agreement_status', ...(kind === 'associate-documents' ? ['document_type'] : [])]);
    const profileWhere = { ...(q.sub_admin_id ? { subAdminId: q.sub_admin_id } : {}), ...(q.city ? { city: q.city } : {}), ...(q.state ? { state: q.state } : {}),
      ...(q.verification_status ? { verificationStatus: q.verification_status } : {}), ...(q.aadhaar_status ? { aadhaarStatus: q.aadhaar_status } : {}), ...(q.police_status ? { policeVerificationStatus: q.police_status } : {}) };
    let agreementIds: string[] | undefined;
    if (q.agreement_status) {
      const agreements = await db.associatePartnerAgreement.findMany({ where: { currentKey: { not: null }, status: q.agreement_status }, select: { currentKey: true, associatePartnerId: true } });
      agreementIds = agreements.filter(a => a.currentKey === a.associatePartnerId).map(a => a.associatePartnerId);
    }
    const userWhere = { role: 'guard', ...(q.guard_id ? { id: q.guard_id } : {}), ...(q.associate_type ? { profileType: q.associate_type } : {}),
      ...(Object.keys(profileWhere).length ? { guardProfile: profileWhere } : {}), ...(agreementIds ? { AND: [{ id: { in: agreementIds } }] } : {}) };
    if (kind === 'associate-verification') {
      dateSpec = date(q, { registered: ['createdAt', 'timestamp'] }, 'registered'); tableName = 'user'; statusField = 'accountStatus';
      where = { ...userWhere, ...dateSpec.where, ...(q.status ? { accountStatus: q.status } : {}) };
      select = { id: true, fullName: true, profileType: true, createdAt: true, accountStatus: true, guardProfile: { select: { city: true, state: true, subAdminId: true, verificationStatus: true, aadhaarStatus: true, policeVerificationStatus: true } } };
    } else {
      const guards = await db.user.findMany({ where: userWhere, select: { id: true } });
      dateSpec = date(q, { uploaded: ['createdAt', 'timestamp'], reviewed: ['reviewedAt', 'timestamp'] }, 'uploaded'); tableName = 'guardDocument'; statusField = 'status';
      where = { guardUserId: { in: guards.map(g => g.id) }, ...dateSpec.where, ...(q.status ? { status: q.status } : {}), ...(q.document_type ? { documentType: q.document_type } : {}) };
      select = { id: true, guardUserId: true, documentType: true, createdAt: true, reviewedAt: true, reviewedBy: true, status: true, adminRemarks: true };
    }
  } else {
    validateFilters(rawQuery, [...scopeFilters, 'site_id', 'job_id', 'guard_id', 'event_type', 'actor_id', 'attendance_id', 'exception_id']);
    scope = await resolveReportScope(db, actor, 'super_admin', q);
    dateSpec = date(q, { event: ['eventAt', 'timestamp'], attendance: ['attendanceDate', 'calendar'] }, 'event'); tableName = 'attendanceAuditEvent'; statusField = 'eventType';
    let jobIds: string[] | undefined;
    if (scope.companyId || scope.siteId || scope.jobId) jobIds = (await db.jobPost.findMany({ where: { ...(scope.companyId ? { companyId: scope.companyId } : {}), ...(scope.siteId ? { siteId: scope.siteId } : {}), ...(scope.jobId ? { id: scope.jobId } : {}) }, select: { id: true } })).map(j => j.id);
    where = { ...dateSpec.where, ...(scope.employerUserId ? { employerUserId: scope.employerUserId } : {}), ...(jobIds ? { jobId: { in: jobIds } } : {}),
      ...(q.guard_id ? { guardUserId: q.guard_id } : {}), ...(q.actor_id ? { actorUserId: q.actor_id } : {}), ...(q.event_type ? { eventType: q.event_type } : {}),
      ...(q.attendance_id ? { attendanceRecordId: q.attendance_id } : {}), ...(q.exception_id ? { exceptionRequestId: q.exception_id } : {}) };
    select = { id: true, eventType: true, eventAt: true, attendanceDate: true, actorUserId: true, actorRole: true, guardUserId: true, employerUserId: true, jobId: true, siteId: true, attendanceRecordId: true, exceptionRequestId: true, remarks: true };
  }
  try {
    const table = reader(db, tableName);
    const total = await table.count({ where });
    if (exporting && total > EXPORT_LIMIT) throw new HttpError(422, `Exports support up to ${EXPORT_LIMIT} rows. Narrow the report filters.`);
    const summary: Row = { records: total, statuses: Object.fromEntries(await counts(db, tableName, statusField, where)) };
    if (kind === 'employer-verification' || kind === 'associate-verification') {
      const employer = kind === 'employer-verification', profileTable = employer ? 'employerProfile' : 'guardProfile';
      const relation = employer ? 'employerProfile' : 'guardProfile';
      summary.account_statuses = summary.statuses;
      summary.verification_statuses = Object.fromEntries(await counts(db, profileTable, 'verificationStatus', { user: where }));
      summary.aadhaar_statuses = Object.fromEntries(await counts(db, profileTable, employer ? 'aadhaarVerificationStatus' : 'aadhaarStatus', { user: where }));
      if (!employer) summary.police_statuses = Object.fromEntries(await counts(db, profileTable, 'policeVerificationStatus', { user: where }));
      summary.missing_profiles = await db.user.count({ where: { AND: [where, { [relation]: null }] } });
    }
    const page = await table.findMany({ where, select, orderBy: [{ [dateSpec.field]: 'desc' }, { id: 'desc' }], ...(exporting ? { take: EXPORT_LIMIT + 1 } : reportPagination(q)) });
    const userIds = [...new Set(page.flatMap(r => [r.employerUserId, r.guardUserId, r.actorUserId, r.reviewedBy, object(r.employerProfile).subAdminId, object(r.employerProfile).salesExecutiveId, object(r.guardProfile).subAdminId]).filter((id): id is string => typeof id === 'string'))];
    const names = new Map((await readInChunks(userIds, batch => db.user.findMany({ where: { id: { in: batch } }, select: { id: true, fullName: true } }))).map(u => [u.id, u.fullName]));
    let rows: Row[] = page.map(r => ({ ...mapped(r), employer: names.get(String(r.employerUserId)) ?? null, associate: names.get(String(r.guardUserId)) ?? null, actor: names.get(String(r.actorUserId)) ?? null, reviewer: names.get(String(r.reviewedBy)) ?? null }));
    if (kind === 'employer-verification' || kind === 'company-verification') {
      const ids = page.map(r => String(r.id)), ownerScope = kind === 'employer-verification';
      const key = ownerScope ? 'employerUserId' : 'companyId';
      const relatedWhere = { [key]: { in: ids }, ...(ownerScope && scope.companyId ? { companyId: scope.companyId } : {}) };
      const siteCounts = await counts(db, 'companySite', key, relatedWhere);
      const jobCounts = await counts(db, 'jobPost', key, relatedWhere);
      const related = await counts(db, ownerScope ? 'employerCompany' : 'companyDocument', key, { [key]: { in: ids }, ...(ownerScope && scope.companyId ? { id: scope.companyId } : {}) });
      rows = rows.map((r, i) => {
        const p = object(page[i].employerProfile);
        return { ...r, sites: siteCounts.get(String(r.id)) ?? 0, jobs: jobCounts.get(String(r.id)) ?? 0,
          ...(ownerScope ? { companies: related.get(String(r.id)) ?? 0, city: scalar(p.city), state: scalar(p.state), profile_status: scalar(p.profileStatus), verification_status: scalar(p.verificationStatus), aadhaar_status: scalar(p.aadhaarVerificationStatus), sub_admin: names.get(String(p.subAdminId)) ?? null, sales: names.get(String(p.salesExecutiveId)) ?? null } : { documents: related.get(String(r.id)) ?? 0 }) };
      });
      if (ownerScope && page.some(r => !r.employerProfile)) warnings.push({ code: 'missing_profile', section: 'profiles', message: 'Some Employers do not have a profile. Verification fields are unknown.' });
    }
    if (kind === 'company-documents') rows = rows.map((r, i) => ({ ...r, company: matchedCompanies.find(c => c.id === page[i].companyId)?.companyName ?? null }));
    if (kind === 'associate-verification') {
      const ids = page.map(r => String(r.id));
      const documentCounts = await counts(db, 'guardDocument', 'guardUserId', { guardUserId: { in: ids } });
      const cohortIds = (await db.user.findMany({ where, select: { id: true } })).map(u => u.id);
      summary.document_statuses = Object.fromEntries(await counts(db, 'guardDocument', 'status', { guardUserId: { in: cohortIds } }));
      try {
        currentAgreements = await readInChunks(cohortIds, batch => db.associatePartnerAgreement.findMany({ where: { associatePartnerId: { in: batch }, currentKey: { not: null } }, select: { associatePartnerId: true, currentKey: true, agreementVersion: true, status: true } }));
        const valid = currentAgreements.filter(a => a.currentKey === a.associatePartnerId);
        const byStatus: Record<string, number> = {};
        for (const a of valid) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
        summary.current_agreement_statuses = byStatus;
        summary.no_current_agreement = Math.max(0, cohortIds.length - new Set(valid.map(a => a.associatePartnerId)).size);
      }
      catch (error) { if (!isMissing(error)) throw error; warnings.push({ code: 'missing_schema', section: 'agreements', message: 'Current onboarding agreement data is unavailable because a server database update is missing.' }); }
      rows = rows.map((r, i) => { const p = object(page[i].guardProfile), agreement = currentAgreements.find(a => a.associatePartnerId === r.id && a.currentKey === r.id);
        return { ...r, city: scalar(p.city), state: scalar(p.state), sub_admin: names.get(String(p.subAdminId)) ?? null,
          verification_status: scalar(p.verificationStatus), aadhaar_status: scalar(p.aadhaarStatus), police_status: scalar(p.policeVerificationStatus), documents: documentCounts.get(String(r.id)) ?? 0,
          agreement_version: agreement?.agreementVersion ?? null, agreement_status: agreement?.status ?? null }; });
      if (page.some(r => !r.guardProfile)) warnings.push({ code: 'missing_profile', section: 'profiles', message: 'Some Associates do not have a profile. Verification fields are unknown.' });
    }
    if (kind === 'attendance-audit') {
      const jobIds = page.map(r => String(r.jobId)), siteIds = page.map(r => String(r.siteId));
      const jobs = await readInChunks(jobIds, batch => db.jobPost.findMany({ where: { id: { in: batch } }, select: { id: true, title: true } }));
      const sites = await readInChunks(siteIds, batch => db.companySite.findMany({ where: { id: { in: batch } }, select: { id: true, siteName: true } }));
      rows = rows.map((r, i) => ({ ...r, job: jobs.find(j => j.id === page[i].jobId)?.title ?? null, site: sites.find(s => s.id === page[i].siteId)?.siteName ?? null }));
    }
    return finish(kind, rows, summary, total, q, scope, dateSpec.field, warnings, exporting);
  } catch (error) { if (isMissing(error)) throw new HttpError(503, 'This report is unavailable because a required database table or column is missing.'); throw error; }
}

export async function adminReportOptions(db: Db, actor: ReportActor | undefined, rawQuery: unknown) {
  assertReportRole(actor, 'super_admin');
  const q = z.object({ employer_id: z.string().uuid().optional(), company_id: z.string().uuid().optional() }).strict().parse(rawQuery);
  const scope = await resolveReportScope(db, actor, 'super_admin', q);
  const employers = await db.user.findMany({ where: { role: 'employer' }, select: { id: true, fullName: true }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }] });
  const companies = await db.employerCompany.findMany({ where: { ...(scope.employerUserId ? { employerUserId: scope.employerUserId } : {}) }, select: { id: true, companyName: true, employerUserId: true }, orderBy: [{ companyName: 'asc' }, { id: 'asc' }] });
  const jobWhere = { ...(scope.employerUserId ? { employerUserId: scope.employerUserId } : {}), ...(scope.companyId ? { companyId: scope.companyId } : {}) };
  const sites = await db.companySite.findMany({ where: { companyId: { in: scope.companyId ? [scope.companyId] : companies.map(c => c.id) } }, select: { id: true, siteName: true }, orderBy: [{ siteName: 'asc' }, { id: 'asc' }] });
  const jobs = await db.jobPost.findMany({ where: jobWhere, select: { id: true, title: true, siteId: true }, orderBy: [{ title: 'asc' }, { id: 'asc' }] });
  const associates = await db.user.findMany({ where: { role: 'guard' }, select: { id: true, fullName: true }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }] });
  const staff = await db.user.findMany({ where: { role: { in: ['sub_admin', 'sales_executive', 'operations', 'super_admin', 'employer'] } }, select: { id: true, fullName: true, role: true }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }] });
  const types = await db.associateType.findMany({ select: { code: true, name: true }, orderBy: { name: 'asc' } });
  return { employers: employers.map(u => ({ id: u.id, label: u.fullName })), companies: companies.map(c => ({ id: c.id, label: c.companyName, employerId: c.employerUserId })),
    sites: sites.map(s => ({ id: s.id, label: s.siteName })), jobs: jobs.map(j => ({ id: j.id, label: j.title, siteId: j.siteId })),
    associates: associates.map(u => ({ id: u.id, label: u.fullName })), staff: staff.map(u => ({ id: u.id, label: u.fullName, role: u.role })), types: types.map(t => ({ id: t.code, label: t.name })) };
}
