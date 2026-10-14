import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../utils/http';
import { FILLED_APPLICATION_STATUSES } from '../services/jobCapacity';
import { readInChunks, reportDateRange, reportPagination, reportQuerySchema } from './query';
import { resolveReportScope, ReportActor } from './scope';
import { reportCsv, reportResponse, ReportWarning } from './response';

export const EXPORT_LIMIT = 5000;
export const REPORT_KINDS = ['job-hiring', 'applications', 'interviews', 'offers', 'agreements', 'attendance', 'attendance-exceptions'] as const;
export type EmployerReportKind = typeof REPORT_KINDS[number];
type Db = Prisma.TransactionClient;
type Raw = Record<string, unknown>;
export type Column = { key: string; label: string };
type Delegate = {
  findMany(args: Raw): Promise<Raw[]>;
  count(args: Raw): Promise<number>;
  groupBy(args: Raw): Promise<Raw[]>;
  aggregate(args: Raw): Promise<Raw>;
};
const baseSchema = reportQuerySchema.extend({
  company_id: z.string().uuid(),
  guard_id: z.string().uuid().optional(),
  status: z.string().min(1).max(50).optional(),
  associate_type: z.string().min(1).max(120).optional(),
  date_basis: z.string().optional(),
  entry_mode: z.string().min(1).max(50).optional(),
  checkout_method: z.string().min(1).max(50).optional(),
  request_type: z.enum(['check_in', 'check_out']).optional(),
}).strict();
const jobSelect = { id: true, title: true, employerUserId: true, companyId: true, siteId: true,
  company: { select: { companyName: true } }, site: { select: { siteName: true, companyId: true, employerUserId: true } } };
const columns = (pairs: string[][]): Column[] => pairs.map(([key, label]) => ({ key, label }));
const common = [['id', 'ID'], ['associate', 'Associate'], ['job', 'Job'], ['site', 'Site'], ['status', 'Status']];
export const reportColumns: Record<EmployerReportKind, Column[]> = {
  'job-hiring': columns([['id', 'Job ID'], ['job', 'Job'], ['company', 'Company'], ['site', 'Site'], ['associate_type', 'Associate type'], ['created_at', 'Posted date'], ['status', 'Job status'], ['required', 'Required'], ['applications', 'Applications'], ['hired', 'Hired'], ['joined', 'Joined'], ['leave_requested', 'Leave requested'], ['filled', 'Filled'], ['remaining', 'Remaining']]),
  applications: columns([...common, ['applied_at', 'Applied date'], ['reviewed_at', 'Reviewed date'], ['reviewer', 'Reviewer']]),
  interviews: columns([...common, ['request_type', 'Request type'], ['preferred_date', 'Preferred date'], ['preferred_time', 'Preferred time'], ['created_at', 'Created date'], ['message', 'Message']]),
  offers: columns([...common, ['offered_salary', 'Offered salary (INR)'], ['duty_hours', 'Duty hours'], ['shift_type', 'Shift'], ['start_date', 'Start date'], ['created_at', 'Created date']]),
  agreements: columns([...common, ['agreement_number', 'Agreement number'], ['title', 'Title'], ['employer_confirmation', 'Employer confirmation'], ['associate_confirmation', 'Associate confirmation'], ['platform_confirmation', 'Platform confirmation'], ['created_at', 'Created date'], ['signed_at', 'Signed date']]),
  attendance: columns([...common, ['attendance_date', 'Attendance date'], ['in_time', 'Check-in'], ['out_time', 'Check-out'], ['total_hours', 'Recorded hours'], ['entry_mode', 'Entry mode'], ['checkout_method', 'Checkout method'], ['remarks', 'Remarks'], ['payment_id', 'Settlement ID'], ['payment_status', 'Settlement status'], ['payment_amount', 'Settlement amount (INR)']]),
  'attendance-exceptions': columns([...common, ['request_type', 'Request type'], ['created_at', 'Requested date'], ['decided_at', 'Decision date'], ['message', 'Message'], ['remarks', 'Decision remarks']]),
};
const configs = {
  applications: { table: 'jobApplication', dates: { applied: ['appliedAt', 'timestamp'] }, defaultDate: 'applied', select: { appliedAt: true, reviewedAt: true, reviewedBy: true } },
  interviews: { table: 'interviewRequest', dates: { created: ['createdAt', 'timestamp'], preferred: ['preferredDate', 'calendar'] }, defaultDate: 'created', select: { requestType: true, preferredDate: true, preferredTime: true, createdAt: true, message: true } },
  offers: { table: 'jobOffer', dates: { created: ['createdAt', 'timestamp'], start: ['startDate', 'calendar'] }, defaultDate: 'created', select: { offeredSalary: true, dutyHours: true, shiftType: true, startDate: true, createdAt: true } },
  agreements: { table: 'agreement', dates: { created: ['createdAt', 'timestamp'], signed: ['signedAt', 'timestamp'] }, defaultDate: 'created', select: { agreementNumber: true, title: true, employerConfirmationStatus: true, guardConfirmationStatus: true, platformConfirmationStatus: true, createdAt: true, signedAt: true } },
  attendance: { table: 'attendanceRecord', dates: { attendance: ['attendanceDate', 'calendar'] }, defaultDate: 'attendance', select: { attendanceDate: true, inTime: true, outTime: true, totalHours: true, entryMode: true, checkoutMethod: true, employerRemarks: true, guardRemarks: true } },
  'attendance-exceptions': { table: 'attendanceExceptionRequest', dates: { requested: ['createdAt', 'timestamp'], decided: ['decidedAt', 'timestamp'] }, defaultDate: 'requested', select: { requestType: true, createdAt: true, decidedAt: true, message: true, employerRemarks: true } },
} as const;
const value = (v: unknown): string | number | null => v == null ? null : v instanceof Date ? v.toISOString() : typeof v === 'number' ? v : String(v);
const nested = (v: unknown) => (v ?? {}) as Raw;
function scopedSiteName(job: Raw, employerId: string) {
  const site = nested(job.site);
  return site.companyId === job.companyId && (site.employerUserId == null || site.employerUserId === employerId) ? site.siteName ?? null : null;
}
function table(db: Db, name: string): Delegate {
  const delegate = (db as unknown as Record<string, Delegate>)[name];
  if (!delegate) throw new HttpError(503, 'This report is unavailable because the server is missing the latest database client.');
  return delegate;
}
function missingSchema(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ['P2021', 'P2022'].includes(error.code);
}
function applyDate(query: { date_from?: string; date_to?: string }, basis: string, dates: Record<string, readonly [string, 'timestamp' | 'calendar']>) {
  const spec = dates[basis];
  if (!spec) throw new HttpError(422, 'Unsupported date basis for this report.');
  const range = reportDateRange(query, spec[1]);
  return { field: spec[0], where: Object.keys(range).length ? { [spec[0]]: range } : {} };
}

export async function employerReportOptions(db: Db, actor: ReportActor | undefined, rawQuery: unknown) {
  const q = z.object({ company_id: z.string().uuid() }).strict().parse(rawQuery);
  await resolveReportScope(db, actor, 'employer', q);
  const where = { employerUserId: actor!.id, companyId: q.company_id };
  const jobs = await db.jobPost.findMany({ where, select: { id: true, title: true, siteId: true }, orderBy: [{ title: 'asc' }, { id: 'asc' }] });
  const sites = await db.companySite.findMany({ where: { companyId: q.company_id, OR: [{ employerUserId: actor!.id }, { employerUserId: null }] }, select: { id: true, siteName: true }, orderBy: [{ siteName: 'asc' }, { id: 'asc' }] });
  const guardIds = new Set<string>();
  const warnings: string[] = [];
  for (const name of ['jobApplication', 'interviewRequest', 'jobOffer', 'agreement', 'attendanceRecord', 'attendanceExceptionRequest']) {
    try {
      const rows = await table(db, name).groupBy({ by: ['guardUserId'], where: { ...(name === 'jobApplication' ? {} : { employerUserId: actor!.id }), job: where } });
      for (const row of rows) if (typeof row.guardUserId === 'string') guardIds.add(row.guardUserId);
    } catch (error) {
      if (!missingSchema(error) && !(error instanceof HttpError && error.status === 503)) throw error;
      warnings.push('Some Associate filter options are unavailable because a server update is missing.');
    }
  }
  const associates = await readInChunks([...guardIds], batch => db.user.findMany({ where: { id: { in: batch }, role: 'guard' }, select: { id: true, fullName: true }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }] }));
  const types = await db.associateType.findMany({ select: { code: true, name: true }, orderBy: { name: 'asc' } });
  return { jobs: jobs.map(j => ({ id: j.id, label: j.title, siteId: j.siteId })), sites: sites.map(s => ({ id: s.id, label: s.siteName })),
    associates: associates.map(a => ({ id: a.id, label: a.fullName })), types: types.map(t => ({ id: t.code, label: t.name })), warnings: [...new Set(warnings)] };
}

/** Called inside a read transaction. Every delegate used here is read-only. */
export async function employerReport(db: Db, actor: ReportActor | undefined, kind: EmployerReportKind, rawQuery: unknown, exporting = false, role: 'employer' | 'super_admin' = 'employer') {
  const q = (role === 'employer' ? baseSchema : baseSchema.extend({ company_id: z.string().uuid().optional() })).parse(rawQuery);
  const scope = await resolveReportScope(db, actor, role, q);
  const allowed = new Set(['company_id', 'site_id', 'job_id', 'date_from', 'date_to', 'page', 'page_size', 'status', 'date_basis']);
  if (role === 'super_admin') allowed.add('employer_id');
  if (kind === 'job-hiring') allowed.add('associate_type');
  else allowed.add('guard_id');
  if (kind === 'attendance') { allowed.add('entry_mode'); allowed.add('checkout_method'); }
  if (kind === 'attendance-exceptions') allowed.add('request_type');
  for (const key of Object.keys(rawQuery as Raw)) if (!allowed.has(key)) throw new HttpError(422, `Unsupported filter: ${key}.`);
  const jobWhere = { ...(scope.employerUserId ? { employerUserId: scope.employerUserId } : {}), ...(scope.companyId ? { companyId: scope.companyId } : {}),
    ...(scope.siteId ? { siteId: scope.siteId } : {}), ...(scope.jobId ? { id: scope.jobId } : {}) };
  const warnings: ReportWarning[] = [];
  let rows: Raw[], summary: Raw, total: number, dateField: string;
  const paging = (count: number) => {
    if (exporting && count > EXPORT_LIMIT) throw new HttpError(422, `Exports support up to ${EXPORT_LIMIT} rows. Narrow the report filters.`);
    return exporting ? { take: EXPORT_LIMIT + 1 } : reportPagination(q);
  };
  if (kind === 'job-hiring') {
    const date = applyDate(q, q.date_basis ?? 'posted', { posted: ['createdAt', 'timestamp'] });
    dateField = date.field;
    const where = { ...jobWhere, ...date.where, ...(q.status ? { status: q.status } : {}), ...(q.associate_type ? { guardType: q.associate_type } : {}) };
    // Compact full dataset is required to sum per-job remaining positions (never clamp only the grand total).
    const jobs = await db.jobPost.findMany({ where, select: { id: true, guardsRequired: true, status: true } });
    total = jobs.length;
    const pagination = paging(total);
    const groups = await db.jobApplication.groupBy({ by: ['jobId', 'status'], where: { job: where }, _count: { _all: true } });
    const byJob = new Map<string, Record<string, number>>();
    const statusCounts: Record<string, number> = {};
    for (const g of groups) {
      const entry = byJob.get(g.jobId) ?? {};
      entry[g.status] = g._count._all; byJob.set(g.jobId, entry);
      statusCounts[g.status] = (statusCounts[g.status] ?? 0) + g._count._all;
    }
    const counts = (id: string, required: number) => {
      const statuses = byJob.get(id) ?? {};
      const filled = FILLED_APPLICATION_STATUSES.reduce((sum, s) => sum + (statuses[s] ?? 0), 0);
      return { required, applications: Object.values(statuses).reduce((a, b) => a + b, 0), hired: statuses.hired ?? 0,
        joined: statuses.joined ?? 0, leave_requested: statuses.leave_requested ?? 0, filled, remaining: Math.max(0, required - filled) };
    };
    summary = { jobs: total, required: 0, filled: 0, remaining: 0, applications: 0, application_statuses: statusCounts, job_statuses: {} };
    for (const job of jobs) {
      const c = counts(job.id, Math.max(1, job.guardsRequired));
      for (const key of ['required', 'filled', 'remaining', 'applications'] as const) summary[key] = Number(summary[key]) + c[key];
      const statuses = summary.job_statuses as Record<string, number>; statuses[job.status] = (statuses[job.status] ?? 0) + 1;
      if (c.filled > c.required) warnings.push({ code: 'capacity_exceeded', section: 'jobs', message: `Job ${job.id} has more filled positions than required.` });
    }
    const page = await db.jobPost.findMany({ where, select: { ...jobSelect, guardsRequired: true, guardType: true, createdAt: true, status: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...pagination });
    const employers = role === 'super_admin' ? await readInChunks(page.map(j => j.employerUserId), batch => db.user.findMany({ where: { id: { in: batch } }, select: { id: true, fullName: true } })) : [];
    const employerNames = new Map(employers.map(u => [u.id, u.fullName]));
    rows = page.map(job => ({ id: job.id, ...(role === 'super_admin' ? { employer: employerNames.get(job.employerUserId) ?? null } : {}), job: job.title, company: job.company?.companyName ?? null, site: scopedSiteName(job, job.employerUserId),
      associate_type: job.guardType, created_at: job.createdAt.toISOString(), status: job.status, ...counts(job.id, Math.max(1, job.guardsRequired)) }));
  } else {
    const config = configs[kind];
    const date = applyDate(q, q.date_basis ?? config.defaultDate, config.dates);
    dateField = date.field;
    // Applications belong to their job; legacy denormalised employer IDs can be null.
    // This matches the capacity service and job summary while the job relation enforces ownership.
    const where = { ...(kind !== 'applications' && scope.employerUserId ? { employerUserId: scope.employerUserId } : {}),
      ...((role === 'employer' || scope.companyId || scope.siteId || scope.jobId || kind === 'applications') ? { job: jobWhere } : {}), ...date.where,
      ...(q.status ? { status: q.status } : {}), ...(q.guard_id ? { guardUserId: q.guard_id } : {}),
      ...(kind === 'attendance' && q.entry_mode ? { entryMode: q.entry_mode } : {}),
      ...(kind === 'attendance' && q.checkout_method ? { checkoutMethod: q.checkout_method } : {}),
      ...(kind === 'attendance-exceptions' && q.request_type ? { requestType: q.request_type } : {}) };
    const delegate = table(db, config.table);
    try {
      total = await delegate.count({ where });
      const pagination = paging(total);
      const statuses = await delegate.groupBy({ by: ['status'], where, _count: { _all: true } });
      summary = { records: total, statuses: Object.fromEntries(statuses.map(g => [String(g.status), Number(nested(g._count)._all)])) };
      if (kind === 'interviews') summary.unscheduled = await delegate.count({ where: { AND: [where, { preferredDate: null }] } });
      if (kind === 'agreements') summary.pending_confirmations = await delegate.count({ where: { AND: [where, { OR: [{ employerConfirmationStatus: 'pending' }, { guardConfirmationStatus: 'pending' }, { platformConfirmationStatus: 'pending' }] }] } });
      if (kind === 'attendance') {
        const agg = await delegate.aggregate({ where, _sum: { totalHours: true } });
        summary.recorded_hours = value(nested(agg._sum).totalHours) ?? '0';
        summary.open_sessions = await delegate.count({ where: { AND: [where, { outTime: null }] } });
        summary.unknown_hours = await delegate.count({ where: { AND: [where, { totalHours: null }] } });
        summary.completed_sessions = await delegate.count({ where: { AND: [where, { inTime: { not: null }, outTime: { not: null } }] } });
        summary.distinct_associates = (await delegate.groupBy({ by: ['guardUserId'], where })).length;
      }
      const page = await delegate.findMany({ where, select: { id: true, employerUserId: true, guardUserId: true, status: true, job: { select: jobSelect }, ...config.select }, orderBy: [{ [date.field]: 'desc' }, { id: 'desc' }], ...pagination });
      const ids = [...new Set(page.map(r => r.guardUserId).filter((id): id is string => typeof id === 'string'))];
      const reviewerIds = [...new Set(page.map(r => r.reviewedBy).filter((id): id is string => typeof id === 'string'))];
      const ownerIds = role === 'super_admin' ? page.map(r => nested(r.job).employerUserId ?? r.employerUserId).filter((id): id is string => typeof id === 'string') : [];
      const users = await readInChunks([...ids, ...reviewerIds, ...ownerIds], batch => db.user.findMany({ where: { id: { in: batch } }, select: { id: true, fullName: true } }));
      const names = new Map(users.map(u => [u.id, u.fullName]));
      rows = page.map(r => {
        const job = nested(r.job);
        const row: Raw = { id: r.id, ...(role === 'super_admin' ? { employer: names.get(String(job.employerUserId ?? r.employerUserId)) ?? null } : {}), associate: names.get(String(r.guardUserId)) ?? null, job: job.title ?? null, site: scopedSiteName(job, String(job.employerUserId ?? r.employerUserId)), status: r.status };
        const mapping: Record<string, string> = { appliedAt: 'applied_at', reviewedAt: 'reviewed_at', createdAt: 'created_at', preferredDate: 'preferred_date', preferredTime: 'preferred_time', requestType: 'request_type', message: 'message', offeredSalary: 'offered_salary', dutyHours: 'duty_hours', shiftType: 'shift_type', startDate: 'start_date', agreementNumber: 'agreement_number', title: 'title', employerConfirmationStatus: 'employer_confirmation', guardConfirmationStatus: 'associate_confirmation', platformConfirmationStatus: 'platform_confirmation', signedAt: 'signed_at', attendanceDate: 'attendance_date', inTime: 'in_time', outTime: 'out_time', totalHours: 'total_hours', entryMode: 'entry_mode', checkoutMethod: 'checkout_method', employerRemarks: 'remarks', decidedAt: 'decided_at' };
        for (const field of Object.keys(config.select)) if (mapping[field]) row[mapping[field]] = value(r[field]);
        if (kind === 'applications') row.reviewer = names.get(String(r.reviewedBy)) ?? null;
        return row;
      });
      if (kind === 'attendance' && page.length) {
        try {
          const payments = await readInChunks(page.map(r => String(r.id)), batch => db.payment.findMany({ where: { ...(scope.employerUserId ? { employerUserId: scope.employerUserId } : {}), attendanceId: { in: batch } }, select: { id: true, attendanceId: true, amount: true, paymentStatus: true } }));
          for (const row of rows) {
            const linked = payments.filter(p => p.attendanceId === row.id);
            row.payment_id = linked.map(p => p.id).join('; ') || null;
            row.payment_status = linked.map(p => p.paymentStatus).join('; ') || null;
            row.payment_amount = linked.map(p => p.amount.toString()).join('; ') || null;
            if (linked.length > 1) warnings.push({ code: 'multiple_settlements', section: 'settlements', message: `Attendance ${row.id} has multiple payment references.` });
          }
        } catch (error) {
          if (!missingSchema(error)) throw error;
          warnings.push({ code: 'missing_schema', section: 'settlements', message: 'Settlement data is unavailable. Apply the existing payment migration and regenerate the server client.' });
        }
      }
    } catch (error) {
      if (missingSchema(error)) throw new HttpError(503, 'This report is unavailable because the server database is missing a required reporting table or column.');
      throw error;
    }
  }
  if (rows.some(r => r.site == null || ('associate' in r && r.associate == null))) warnings.push({ code: 'missing_relationship', section: 'rows', message: 'Some names or sites are unavailable. Their records are retained.' });
  const metadata = { scope, filters: q, date_basis: dateField, warnings };
  const visibleColumns = role === 'super_admin' ? [{ key: 'employer', label: 'Employer' }, ...reportColumns[kind]] : reportColumns[kind];
  if (exporting) {
    if (warnings.some(w => w.code === 'missing_schema')) throw new HttpError(503, 'Export is unavailable while settlement data is missing.');
    const exportColumns = visibleColumns.map(c => ({ header: c.label, value: (r: Raw) => {
      const cell = value(r[c.key]);
      if (typeof cell === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(cell)) {
        if (['attendance_date', 'preferred_date', 'start_date'].includes(c.key)) return cell.slice(0, 10);
        return new Date(Date.parse(cell) + 330 * 60_000).toISOString().replace('Z', '+05:30');
      }
      return cell;
    } }));
    exportColumns.push(
      { header: 'Company ID', value: () => q.company_id ?? null },
      { header: 'Date basis', value: () => dateField },
      { header: 'Reporting timezone', value: () => 'Asia/Kolkata' },
      { header: 'From date', value: () => q.date_from ?? null },
      { header: 'Through date', value: () => q.date_to ?? null },
      { header: 'Report warnings', value: () => warnings.map(w => w.message).join('; ') },
    );
    return { csv: reportCsv(rows, exportColumns, total, EXPORT_LIMIT) };
  }
  return { ...reportResponse(rows, summary, total, q, metadata), columns: visibleColumns };
}
