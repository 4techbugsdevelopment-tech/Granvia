import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../utils/http';
import { readInChunks, reportDateRange, reportPagination, reportQuerySchema } from './query';
import { reportCsv, reportResponse, type ReportWarning } from './response';
import { resolveReportScope, type ReportActor } from './scope';
import { FILLED_APPLICATION_STATUSES } from '../services/jobCapacity';

type Db = Prisma.TransactionClient;
export type ReportingRole = 'super_admin' | 'employer' | 'guard' | 'sub_admin' | 'sales_executive' | 'operations' | 'finance';
type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;
type Column = { key: string; label: string };
const col = (...pairs: [string, string][]): Column[] => pairs.map(([key, label]) => ({ key, label }));
const EXPORT_LIMIT = 5000;
const money = (value: Prisma.Decimal | null | undefined) => new Prisma.Decimal(value ?? 0).toFixed(2);
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;
const WORK_HISTORY_STATUSES = ['hired', 'joined', 'leave_requested', 'completed', 'released'] as const;

/** Every entry is a real report. Deferred catalogue items are not advertised as implemented. */
export const EXTENDED_REPORTS: Record<ReportingRole, { kind: string; label: string }[]> = {
  super_admin: [
    { kind: 'employer-registrations', label: 'Employer registrations & growth' },
    { kind: 'employer-master', label: 'Employer master & workforce summary' },
    { kind: 'associate-registrations', label: 'Associate registrations & growth' },
    { kind: 'associates', label: 'Associate master tracker' },
    { kind: 'associate-work-history', label: 'Associate work, attendance & earnings history' },
    { kind: 'associate-attendance-history', label: 'Associate daily attendance & settlement history' },
    { kind: 'employer-credits', label: 'Employer credits statement' },
    { kind: 'associate-wallets', label: 'Associate wallet balances' },
    { kind: 'associate-statement', label: 'Associate wallet movements' },
    { kind: 'withdrawals', label: 'Withdrawals & payout monitoring' },
    { kind: 'recruitment-pipeline', label: 'Recruitment pipeline & ageing' },
    { kind: 'invoices', label: 'Invoice register & ageing' },
  ],
  employer: [
    { kind: 'associates', label: 'Associate master tracker' },
    { kind: 'associate-work-history', label: 'Associate work, attendance & earnings history' },
    { kind: 'associate-attendance-history', label: 'Associate daily attendance & settlement history' },
    { kind: 'employees', label: 'Employee & sub-admin tracker' },
    { kind: 'companies', label: 'Company master register' },
    { kind: 'sites', label: 'Site master register' },
    { kind: 'jobs', label: 'Job master tracker' },
    { kind: 'recruitment-pipeline', label: 'Applicants, workforce & pipeline' },
    { kind: 'invoices', label: 'Invoice register & ageing' },
    { kind: 'employer-credits', label: 'Total credits statement' },
  ],
  guard: [
    { kind: 'associate-wallets', label: 'My wallet balances' },
    { kind: 'associate-statement', label: 'My earnings & wallet statement' },
    { kind: 'withdrawals', label: 'My withdrawals & payouts' },
    { kind: 'recruitment-pipeline', label: 'My applications & work history' },
  ],
  sub_admin: [
    { kind: 'employer-registrations', label: 'Assigned Employer registrations' },
    { kind: 'associate-registrations', label: 'Assigned Associate registrations' },
    { kind: 'recruitment-pipeline', label: 'Assigned client recruitment pipeline' },
  ],
  sales_executive: [
    { kind: 'employer-registrations', label: 'Client registrations & growth' },
    { kind: 'recruitment-pipeline', label: 'Client hiring pipeline' },
  ],
  operations: [{ kind: 'recruitment-pipeline', label: 'Assigned recruitment pipeline & ageing' }],
  // Existing Finance withdrawal decisions are platform-wide. No new general wallet access.
  finance: [{ kind: 'withdrawals', label: 'Withdrawal register & ageing' }],
};

export function extendedReportDefinitions(role: ReportingRole) {
  return EXTENDED_REPORTS[role].map(report => ({ ...report, dates: report.kind !== 'associate-wallets',
    filters: allowed[report.kind].filter(key => !(role === 'employer' && key === 'employer_id') && !(role === 'guard' && key === 'guard_id')),
  }));
}

/** Bounded selectors for financial and company registers; no private profile fields. */
export async function extendedReportOptions(db: Db, actor: ReportActor | undefined, role: ReportingRole, raw: unknown) {
  const user = authorize(actor, role);
  const q = z.object({ kind: z.string(), search: z.string().trim().max(100).optional() }).strict().parse(raw);
  const definition = extendedReportDefinitions(role).find(r => r.kind === q.kind);
  if (!definition) throw new HttpError(404, 'Report not available for your role.');
  const options: Record<string, { id: string; label: string }[]> = {};
  const truncated: string[] = [];
  function add(field: string, rows: { id: string; label: string }[]) {
    options[field] = rows.slice(0, 500);
    if (rows.length > 500) truncated.push(field);
  }
  if (definition.filters.includes('employer_id') && ['super_admin', 'sub_admin', 'sales_executive'].includes(role)) {
    const profile = employerScope(user);
    const rows = await db.user.findMany({ where: { role: 'employer', ...(profile ? { employerProfile: profile } : {}), ...(q.search ? { fullName: { contains: q.search } } : {}) }, select: { id: true, fullName: true }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], take: 501 });
    add('employer_id', rows.map(r => ({ id: r.id, label: r.fullName })));
  }
  if (definition.filters.includes('guard_id') && ['super_admin', 'employer'].includes(role)) {
    let guardIds: string[] | undefined;
    if (role === 'employer') {
      const groups = await db.jobApplication.groupBy({ by: ['guardUserId'], where: { job: { employerUserId: user.id } }, _count: { _all: true }, orderBy: { guardUserId: 'asc' }, take: 501 });
      guardIds = groups.map(group => group.guardUserId);
      if (groups.length > 500) truncated.push('guard_id');
    }
    const rows = await db.user.findMany({ where: { role: 'guard', ...(guardIds ? { id: { in: guardIds } } : {}), ...(q.search ? { fullName: { contains: q.search } } : {}) }, select: { id: true, fullName: true }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], take: 501 });
    add('guard_id', rows.map(r => ({ id: r.id, label: r.fullName })));
  }
  if (definition.filters.includes('company_id') && ['super_admin', 'employer'].includes(role)) {
    const rows = await db.employerCompany.findMany({ where: { ...(role === 'employer' ? { employerUserId: user.id } : {}), ...(q.search ? { companyName: { contains: q.search } } : {}) }, select: { id: true, companyName: true }, orderBy: [{ companyName: 'asc' }, { id: 'asc' }], take: 501 });
    add('company_id', rows.map(r => ({ id: r.id, label: r.companyName })));
  }
  if (definition.filters.includes('site_id') && ['super_admin', 'employer'].includes(role)) {
    const rows = await db.companySite.findMany({ where: { ...(role === 'employer' ? { employerUserId: user.id } : {}), ...(q.search ? { siteName: { contains: q.search } } : {}) }, select: { id: true, siteName: true }, orderBy: [{ siteName: 'asc' }, { id: 'asc' }], take: 501 });
    add('site_id', rows.map(r => ({ id: r.id, label: r.siteName })));
  }
  if (definition.filters.includes('job_id') && ['super_admin', 'employer'].includes(role)) {
    const rows = await db.jobPost.findMany({ where: { ...(role === 'employer' ? { employerUserId: user.id } : {}), ...(q.search ? { title: { contains: q.search } } : {}) }, select: { id: true, title: true }, orderBy: [{ title: 'asc' }, { id: 'asc' }], take: 501 });
    add('job_id', rows.map(r => ({ id: r.id, label: r.title })));
  }
  return { options, truncated };
}

const schema = reportQuerySchema.extend({
  guard_id: z.string().uuid().optional(),
  status: z.string().trim().min(1).max(50).optional(),
  source: z.string().trim().min(1).max(50).optional(),
}).strict();
type Query = z.infer<typeof schema>;
const commonFilters = ['page', 'page_size', 'date_from', 'date_to'];
const allowed: Record<string, string[]> = {
  'employer-registrations': ['status'], 'associate-registrations': ['status'],
  'employer-master': ['status'],
  'employer-credits': ['employer_id', 'source'], 'associate-wallets': ['guard_id', 'status'],
  'associate-statement': ['guard_id', 'status'], withdrawals: ['guard_id', 'status'],
  'recruitment-pipeline': ['employer_id', 'company_id', 'site_id', 'job_id', 'guard_id', 'status'],
  'associate-work-history': ['employer_id', 'company_id', 'site_id', 'job_id', 'guard_id', 'status'],
  'associate-attendance-history': ['employer_id', 'company_id', 'site_id', 'job_id', 'guard_id', 'status'],
  associates: ['company_id', 'status'], employees: ['status'], jobs: ['company_id', 'status'],
  companies: ['status'], sites: ['company_id', 'status'], invoices: ['employer_id', 'company_id', 'status'],
};

function authorize(actor: ReportActor | undefined, role: ReportingRole) {
  if (!actor) throw new HttpError(401, 'Unauthenticated.');
  if (actor.role !== role || ['blocked', 'inactive'].includes(actor.accountStatus)) throw new HttpError(403, 'Forbidden.');
  return actor;
}

/** Reuse actual assignment relationships, never caller-provided staff/owner IDs. */
function employerScope(actor: ReportActor): Prisma.EmployerProfileWhereInput | null {
  if (actor.role === 'sub_admin') return { subAdminId: actor.id };
  if (actor.role === 'sales_executive') return { salesExecutiveId: actor.id };
  return null;
}

async function pipelineScope(db: Db, actor: ReportActor, q: Query): Promise<Prisma.JobApplicationWhereInput> {
  let scope: Prisma.JobApplicationWhereInput = {};
  if (actor.role === 'employer') scope = { OR: [{ employerUserId: actor.id }, { employerUserId: null }], job: { employerUserId: actor.id } };
  if (actor.role === 'guard') scope = { guardUserId: actor.id };
  if (actor.role === 'sub_admin' || actor.role === 'sales_executive') {
    const profile = employerScope(actor);
    const profiles = await db.employerProfile.findMany({ where: profile!, select: { userId: true }, take: 501 });
    if (profiles.length > 500) throw new HttpError(422, 'Assigned portfolio is too large for this report.');
    const ids = profiles.map(p => p.userId);
    scope = { OR: ids.map(employerUserId => ({ OR: [{ employerUserId }, { employerUserId: null }], job: { employerUserId } })) };
    if (!ids.length) scope = { id: { in: [] } };
  }
  if (actor.role === 'operations') {
    const assignments = await db.operationsAssignment.findMany({
      where: { operationsUserId: actor.id, status: 'active' },
      select: { employerUserId: true, companyId: true, siteId: true, jobId: true },
      take: 301,
    });
    if (assignments.length > 300) throw new HttpError(422, 'Too many active reporting assignments. Consolidate the assigned scopes.');
    scope = assignments.length ? { OR: assignments.map(a => ({
      OR: [{ employerUserId: a.employerUserId }, { employerUserId: null }],
      job: { employerUserId: a.employerUserId, ...(a.companyId ? { companyId: a.companyId } : {}),
        ...(a.siteId ? { siteId: a.siteId } : {}), ...(a.jobId ? { id: a.jobId } : {}) },
    })) } : { id: { in: [] } };
  }
  // AND preserves the actor scope even when filters contain a different owner.
  return { AND: [scope, {
    ...(q.guard_id ? { guardUserId: q.guard_id } : {}),
    ...(q.employer_id || q.company_id || q.site_id || q.job_id ? { job: {
      ...(q.employer_id ? { employerUserId: q.employer_id } : {}), ...(q.company_id ? { companyId: q.company_id } : {}),
      ...(q.site_id ? { siteId: q.site_id } : {}), ...(q.job_id ? { id: q.job_id } : {}),
    } } : {}),
  }] };
}

type Result = { items: Row[]; summary: Record<string, unknown>; total: number; columns: Column[]; basis: string; warnings?: ReportWarning[] };

function permissions(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string').join('; ') || null : null;
  } catch { return null; }
}

async function employerMaster(db: Db, q: Query, skip: number, take: number): Promise<Result> {
  const where: Prisma.UserWhereInput = { role: 'employer', createdAt: reportDateRange(q, 'timestamp'), ...(q.status ? { accountStatus: q.status } : {}) };
  const [total, accountGroups, employers] = await Promise.all([
    db.user.count({ where }), db.user.groupBy({ by: ['accountStatus'], where, _count: { _all: true } }),
    db.user.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
      id: true, fullName: true, email: true, mobile: true, accountStatus: true, createdAt: true,
      employerProfile: { select: { city: true, state: true, verificationStatus: true, profileStatus: true } },
    } }),
  ]);
  const ids = employers.map(employer => employer.id);
  const [companies, jobs, applications, hiredAssociates, attendance, payments] = await Promise.all([
    ids.length ? db.employerCompany.groupBy({ by: ['employerUserId'], where: { employerUserId: { in: ids } }, _count: { _all: true } }) : [],
    ids.length ? db.jobPost.groupBy({ by: ['employerUserId'], where: { employerUserId: { in: ids } }, _count: { _all: true } }) : [],
    ids.length ? db.jobApplication.groupBy({ by: ['employerUserId', 'status'], where: { employerUserId: { in: ids } }, _count: { _all: true } }) : [],
    ids.length ? db.jobApplication.groupBy({ by: ['employerUserId', 'guardUserId'], where: { employerUserId: { in: ids }, status: { in: [...WORK_HISTORY_STATUSES] } }, _count: { _all: true } }) : [],
    ids.length ? db.attendanceRecord.groupBy({ by: ['employerUserId'], where: { employerUserId: { in: ids } }, _count: { _all: true }, _sum: { totalHours: true } }) : [],
    ids.length ? db.payment.groupBy({ by: ['employerUserId', 'paymentStatus'], where: { employerUserId: { in: ids } }, _count: { _all: true }, _sum: { amount: true } }) : [],
  ]);
  const countMap = <T extends { employerUserId: string | null; _count: { _all: number } }>(groups: T[]) => new Map(groups.filter(group => group.employerUserId).map(group => [group.employerUserId!, group._count._all]));
  const companyCounts = countMap(companies), jobCounts = countMap(jobs), attendanceCounts = new Map(attendance.filter(group => group.employerUserId).map(group => [group.employerUserId!, group]));
  const applicationMetrics = new Map<string, Record<string, number>>();
  for (const group of applications) {
    if (!group.employerUserId) continue;
    const current = applicationMetrics.get(group.employerUserId) ?? {};
    current[group.status] = group._count._all; applicationMetrics.set(group.employerUserId, current);
  }
  const hiredCounts = new Map<string, number>();
  for (const group of hiredAssociates) if (group.employerUserId) hiredCounts.set(group.employerUserId, (hiredCounts.get(group.employerUserId) ?? 0) + 1);
  const paymentMetrics = new Map<string, Record<string, { count: number; amount: string }>>();
  for (const group of payments) {
    if (!group.employerUserId) continue;
    const current = paymentMetrics.get(group.employerUserId) ?? {};
    current[group.paymentStatus] = { count: group._count._all, amount: money(group._sum.amount) }; paymentMetrics.set(group.employerUserId, current);
  }
  return {
    total, basis: 'users.created_at (IST); workforce, attendance and payment metrics are lifetime current records',
    warnings: [
      { code: 'EMPLOYER_LIFETIME_METRICS', section: 'employers', message: 'Registration dates filter Employer accounts. Company, job, workforce, attendance and earnings columns are lifetime recorded metrics and are not restricted by the registration-date filter.' },
      { code: 'LEGACY_OWNER_LINKS', section: 'scope', message: 'Counts use stored Employer owner IDs. Legacy records without an Employer owner ID cannot be attributed to an Employer row.' },
      { code: 'EMPLOYER_RECORDED_EARNINGS', section: 'earnings', message: 'Recorded completed earnings are completed Associate payment records under the Employer. They are not independent proof of bank payout.' },
    ],
    columns: col(['employer', 'Employer'], ['mobile', 'Mobile'], ['email', 'Email'], ['registered_at', 'Registered at'], ['account_status', 'Account status'], ['verification', 'Verification'], ['profile_status', 'Profile status'], ['city', 'City'], ['state', 'State'], ['companies', 'Companies'], ['jobs', 'Jobs'], ['applications', 'Applications'], ['hired_associates', 'Associates with hired/work history'], ['work_history_records', 'Hired / work history records'], ['attendance_records', 'Attendance records'], ['recorded_hours', 'Recorded hours'], ['completed_earnings', 'Recorded completed earnings (INR)'], ['processing_earnings', 'Recorded processing earnings (INR)'], ['id', 'Employer ID']),
    items: employers.map(employer => {
      const app = applicationMetrics.get(employer.id) ?? {}, att = attendanceCounts.get(employer.id), pay = paymentMetrics.get(employer.id) ?? {};
      return { id: employer.id, employer: employer.fullName, mobile: employer.mobile, email: employer.email, registered_at: iso(employer.createdAt), account_status: employer.accountStatus,
        verification: employer.employerProfile?.verificationStatus ?? null, profile_status: employer.employerProfile?.profileStatus ?? null,
        city: employer.employerProfile?.city ?? null, state: employer.employerProfile?.state ?? null, companies: companyCounts.get(employer.id) ?? 0, jobs: jobCounts.get(employer.id) ?? 0,
        applications: Object.values(app).reduce((sum, count) => sum + count, 0), hired_associates: hiredCounts.get(employer.id) ?? 0,
        work_history_records: WORK_HISTORY_STATUSES.reduce((sum, status) => sum + (app[status] ?? 0), 0), attendance_records: att?._count._all ?? 0,
        recorded_hours: money(att?._sum.totalHours), completed_earnings: pay.completed?.amount ?? '0.00', processing_earnings: pay.processing?.amount ?? '0.00' };
    }),
    summary: { registered_employers: total, current_account_statuses: Object.fromEntries(accountGroups.map(group => [group.accountStatus, group._count._all])) },
  };
}

async function platformAssociateMaster(db: Db, q: Query, skip: number, take: number): Promise<Result> {
  const where: Prisma.UserWhereInput = { role: 'guard', createdAt: reportDateRange(q, 'timestamp'), ...(q.status ? { accountStatus: q.status } : {}) };
  const [total, accountGroups, users] = await Promise.all([
    db.user.count({ where }),
    db.user.groupBy({ by: ['accountStatus'], where, _count: { _all: true } }),
    db.user.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
      id: true, fullName: true, email: true, mobile: true, accountStatus: true, createdAt: true,
      guardProfile: { select: { city: true, state: true, verificationStatus: true, experience: true, qualification: true } },
    } }),
  ]);
  const ids = users.map(user => user.id);
  const [applications, attendance, payments] = await Promise.all([
    ids.length ? db.jobApplication.groupBy({ by: ['guardUserId', 'status'], where: { guardUserId: { in: ids } }, _count: { _all: true } }) : [],
    ids.length ? db.attendanceRecord.groupBy({ by: ['guardUserId'], where: { guardUserId: { in: ids } }, _count: { _all: true }, _sum: { totalHours: true } }) : [],
    ids.length ? db.payment.groupBy({ by: ['guardUserId', 'paymentStatus'], where: { guardUserId: { in: ids } }, _count: { _all: true }, _sum: { amount: true } }) : [],
  ]);
  const applicationMetrics = new Map<string, Record<string, number>>();
  for (const group of applications) {
    const current = applicationMetrics.get(group.guardUserId) ?? {};
    current[group.status] = group._count._all; applicationMetrics.set(group.guardUserId, current);
  }
  const attendanceMetrics = new Map(attendance.map(group => [group.guardUserId, group]));
  const paymentMetrics = new Map<string, Record<string, { count: number; amount: string }>>();
  for (const group of payments) {
    if (!group.guardUserId) continue;
    const current = paymentMetrics.get(group.guardUserId) ?? {};
    current[group.paymentStatus] = { count: group._count._all, amount: money(group._sum.amount) }; paymentMetrics.set(group.guardUserId, current);
  }
  return {
    total,
    basis: 'users.created_at (IST); application, attendance and recorded earnings metrics are lifetime current records',
    warnings: [
      { code: 'ASSOCIATE_LIFETIME_METRICS', section: 'associates', message: 'Registration dates filter Associate accounts. Work, attendance and earnings columns are lifetime recorded metrics for each displayed Associate and are not restricted by the registration-date filter.' },
      { code: 'RECORDED_EARNINGS_ONLY', section: 'earnings', message: 'Completed earnings are stored completed payment records. They are not independent proof of bank payout; processing amounts are shown separately.' },
    ],
    columns: col(['name', 'Associate'], ['mobile', 'Mobile'], ['email', 'Email'], ['registered_at', 'Registered at'], ['account_status', 'Account status'], ['verification', 'Verification'], ['city', 'City'], ['state', 'State'], ['experience', 'Experience'], ['qualification', 'Qualification'], ['applications', 'Applications'], ['work_history_records', 'Hired / work history records'], ['attendance_records', 'Attendance records'], ['recorded_hours', 'Recorded hours'], ['completed_earnings', 'Recorded completed earnings (INR)'], ['processing_earnings', 'Recorded processing earnings (INR)'], ['id', 'Associate ID']),
    items: users.map(user => {
      const app = applicationMetrics.get(user.id) ?? {};
      const att = attendanceMetrics.get(user.id);
      const pay = paymentMetrics.get(user.id) ?? {};
      return { id: user.id, name: user.fullName, mobile: user.mobile, email: user.email, registered_at: iso(user.createdAt), account_status: user.accountStatus,
        verification: user.guardProfile?.verificationStatus ?? null, city: user.guardProfile?.city ?? null, state: user.guardProfile?.state ?? null,
        experience: user.guardProfile?.experience ?? null, qualification: user.guardProfile?.qualification ?? null,
        applications: Object.values(app).reduce((sum, count) => sum + count, 0),
        work_history_records: WORK_HISTORY_STATUSES.reduce((sum, status) => sum + (app[status] ?? 0), 0),
        attendance_records: att?._count._all ?? 0, recorded_hours: money(att?._sum.totalHours),
        completed_earnings: pay.completed?.amount ?? '0.00', processing_earnings: pay.processing?.amount ?? '0.00' };
    }),
    summary: { registered_associates: total, current_account_statuses: Object.fromEntries(accountGroups.map(group => [group.accountStatus, group._count._all])) },
  };
}

async function associateMaster(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  if (actor.role === 'super_admin') return platformAssociateMaster(db, q, skip, take);
  const applicationWhere: Prisma.JobApplicationWhereInput = {
    ...await pipelineScope(db, actor, { ...q, guard_id: undefined, status: undefined }),
    appliedAt: reportDateRange(q, 'timestamp'),
  };
  const groups = await db.jobApplication.groupBy({
    by: ['guardUserId'], where: applicationWhere, _count: { _all: true }, _min: { appliedAt: true }, _max: { appliedAt: true },
    orderBy: { guardUserId: 'asc' }, take: EXPORT_LIMIT + 1,
  });
  if (groups.length > EXPORT_LIMIT) throw new HttpError(422, `Associate master supports up to ${EXPORT_LIMIT} associated people. Narrow the company or dates.`);
  const users = await readInChunks(groups.map(group => group.guardUserId), batch => db.user.findMany({
    where: { id: { in: batch }, role: 'guard', ...(q.status ? { accountStatus: q.status } : {}) },
    select: { id: true, fullName: true, email: true, mobile: true, accountStatus: true,
      guardProfile: { select: { city: true, state: true, verificationStatus: true, experience: true, qualification: true } } },
  }));
  const byId = new Map(users.map(user => [user.id, user]));
  const matching = groups.filter(group => byId.has(group.guardUserId));
  const statusGroups = await readInChunks(matching.map(group => group.guardUserId), batch => db.jobApplication.groupBy({
    by: ['guardUserId', 'status'], where: { AND: [applicationWhere, { guardUserId: { in: batch } }] }, _count: { _all: true },
  }));
  const statuses = new Map<string, Record<string, number>>();
  for (const group of statusGroups) {
    const current = statuses.get(group.guardUserId) ?? {};
    current[group.status] = group._count._all; statuses.set(group.guardUserId, current);
  }
  const page = matching.slice(skip, skip + take);
  const rows = page.map(group => {
    const user = byId.get(group.guardUserId)!; const profile = user.guardProfile; const applicationStatuses = statuses.get(user.id) ?? {};
    return { id: user.id, name: user.fullName, email: user.email, mobile: user.mobile, account_status: user.accountStatus,
      verification: profile?.verificationStatus ?? null, city: profile?.city ?? null, state: profile?.state ?? null,
      experience: profile?.experience ?? null, qualification: profile?.qualification ?? null, applications: group._count._all,
      workforce_positions: FILLED_APPLICATION_STATUSES.reduce((sum, status) => sum + (applicationStatuses[status] ?? 0), 0),
      application_statuses: Object.entries(applicationStatuses).map(([status, count]) => `${status}: ${count}`).join('; ') || null,
      first_applied_at: iso(group._min.appliedAt), last_applied_at: iso(group._max.appliedAt) };
  });
  const accountStatuses: Record<string, number> = {}, pipelineStatuses: Record<string, number> = {};
  for (const user of users) accountStatuses[user.accountStatus] = (accountStatuses[user.accountStatus] ?? 0) + 1;
  for (const group of statusGroups) pipelineStatuses[group.status] = (pipelineStatuses[group.status] ?? 0) + group._count._all;
  const workforce = matching.filter(group => FILLED_APPLICATION_STATUSES.some(status => (statuses.get(group.guardUserId)?.[status] ?? 0) > 0)).length;
  return { total: matching.length, basis: 'Employer-owned job applications applied_at (IST); profile and account fields are current',
    warnings: [{ code: 'CURRENT_ASSOCIATE_PROFILE', section: 'associates', message: 'The list is deduplicated from applications to your jobs. Profile, verification and account values are current; workforce positions are current application statuses, not historical employment events.' }],
    columns: col(['name', 'Associate'], ['mobile', 'Mobile'], ['email', 'Email'], ['account_status', 'Account status'], ['verification', 'Verification'], ['city', 'City'], ['state', 'State'], ['experience', 'Experience'], ['qualification', 'Qualification'], ['applications', 'Applications'], ['workforce_positions', 'Current workforce positions'], ['application_statuses', 'Application statuses'], ['first_applied_at', 'First applied at'], ['last_applied_at', 'Last applied at'], ['id', 'Associate ID']),
    items: rows, summary: { associated_associates: matching.length, current_workforce_associates: workforce, current_account_statuses: accountStatuses, application_statuses: pipelineStatuses } };
}

async function associateWorkHistory(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const where: Prisma.JobApplicationWhereInput = {
    ...await pipelineScope(db, actor, q),
    appliedAt: reportDateRange(q, 'timestamp'),
    status: q.status ? q.status : { in: [...WORK_HISTORY_STATUSES] },
  };
  const [total, statusGroups, distinct] = await Promise.all([
    db.jobApplication.count({ where }),
    db.jobApplication.groupBy({ by: ['status'], where, _count: { _all: true } }),
    db.jobApplication.groupBy({ by: ['guardUserId'], where, _count: { _all: true }, take: 10001, orderBy: { guardUserId: 'asc' } }),
  ]);
  const applications = await db.jobApplication.findMany({
    where, skip, take, orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, guardUserId: true, employerUserId: true, status: true, appliedAt: true, reviewedAt: true,
      job: { select: { id: true, employerUserId: true, title: true, salaryAmount: true, paymentType: true, shiftType: true, dutyHours: true, startDate: true, endDate: true,
        company: { select: { companyName: true } }, site: { select: { siteName: true, address: true, city: true, state: true, pincode: true } } } } },
  });
  const pairs = applications.map(application => ({ guardUserId: application.guardUserId, jobId: application.job.id }));
  const [associates, employers, attendanceGroups, paymentGroups, agreements] = await Promise.all([
    readInChunks(applications.map(application => application.guardUserId), batch => db.user.findMany({ where: { id: { in: batch }, role: 'guard' }, select: { id: true, fullName: true, email: true, mobile: true } })),
    readInChunks(applications.map(application => application.job.employerUserId), batch => db.user.findMany({ where: { id: { in: batch }, role: 'employer' }, select: { id: true, fullName: true } })),
    pairs.length ? db.attendanceRecord.groupBy({ by: ['guardUserId', 'jobId', 'status'], where: { OR: pairs }, _count: { _all: true }, _sum: { totalHours: true }, _min: { attendanceDate: true }, _max: { attendanceDate: true } }) : [],
    pairs.length ? db.payment.groupBy({ by: ['guardUserId', 'jobId', 'paymentStatus'], where: { OR: pairs }, _count: { _all: true }, _sum: { amount: true } }) : [],
    pairs.length ? db.agreement.findMany({ where: { OR: pairs }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, guardUserId: true, jobId: true, agreementNumber: true, status: true, effectiveFrom: true, effectiveUntil: true, signedAt: true } }) : [],
  ]);
  const associateNames = new Map(associates.map(user => [user.id, user]));
  const employerNames = new Map(employers.map(user => [user.id, user.fullName]));
  const key = (guardUserId: string | null, jobId: string | null) => `${guardUserId ?? ''}:${jobId ?? ''}`;
  const attendance = new Map<string, { count: number; hours: Prisma.Decimal; statuses: Record<string, number>; first: Date | null; last: Date | null }>();
  for (const group of attendanceGroups) {
    const id = key(group.guardUserId, group.jobId), current = attendance.get(id) ?? { count: 0, hours: new Prisma.Decimal(0), statuses: {}, first: null, last: null };
    current.count += group._count._all; current.hours = current.hours.add(group._sum.totalHours ?? 0); current.statuses[group.status] = group._count._all;
    if (group._min.attendanceDate && (!current.first || group._min.attendanceDate < current.first)) current.first = group._min.attendanceDate;
    if (group._max.attendanceDate && (!current.last || group._max.attendanceDate > current.last)) current.last = group._max.attendanceDate;
    attendance.set(id, current);
  }
  const payments = new Map<string, Record<string, { count: number; amount: string }>>();
  for (const group of paymentGroups) {
    const id = key(group.guardUserId, group.jobId), current = payments.get(id) ?? {};
    current[group.paymentStatus] = { count: group._count._all, amount: money(group._sum.amount) }; payments.set(id, current);
  }
  const agreementByWork = new Map<string, typeof agreements[number]>();
  for (const agreement of agreements) {
    const id = key(agreement.guardUserId, agreement.jobId);
    if (!agreementByWork.has(id)) agreementByWork.set(id, agreement);
  }
  return {
    total,
    basis: 'job_applications.applied_at (IST); attendance and payment metrics are lifetime for each Associate/job pairing',
    warnings: [
      { code: 'WORK_HISTORY_STATUS', section: 'employment', message: 'By default this report includes hired, joined, leave-requested, completed and released application records. Status is the current stored employment/application state, not a reconstructed status timeline.' },
      { code: 'WORK_HISTORY_DATES', section: 'dates', message: 'From/Through filters use the application date. Job dates come from the job record; first/last attendance are recorded work evidence and may be unavailable.' },
      { code: 'WORK_HISTORY_EARNINGS', section: 'earnings', message: 'Completed and processing earnings are stored payment records for the Associate/job pair. Completed does not independently prove bank payout; salary is the job posting amount and is not added to earnings.' },
    ],
    columns: col(['associate', 'Associate'], ['mobile', 'Mobile'], ['email', 'Email'], ['employer', 'Employer'], ['company', 'Company'], ['job', 'Job'], ['site', 'Site'], ['work_location', 'Work location'], ['employment_status', 'Employment status'], ['applied_at', 'Applied at'], ['job_start', 'Job start'], ['job_end', 'Job end'], ['shift', 'Shift'], ['duty_hours', 'Duty hours'], ['posted_salary', 'Posted salary (INR)'], ['payment_type', 'Salary basis'], ['attendance_records', 'Attendance records'], ['approved_attendance', 'Approved / verified attendance'], ['attendance_statuses', 'Attendance statuses'], ['recorded_hours', 'Recorded hours'], ['first_attendance', 'First attendance'], ['last_attendance', 'Last attendance'], ['completed_earnings', 'Recorded completed earnings (INR)'], ['processing_earnings', 'Recorded processing earnings (INR)'], ['payment_statuses', 'Payment statuses'], ['agreement_status', 'Agreement status'], ['agreement_number', 'Agreement number'], ['agreement_from', 'Agreement effective from'], ['agreement_until', 'Agreement effective until'], ['agreement_signed_at', 'Agreement signed at'], ['id', 'Application ID']),
    items: applications.map(application => {
      const pair = key(application.guardUserId, application.job.id), user = associateNames.get(application.guardUserId), att = attendance.get(pair), pay = payments.get(pair) ?? {}, agreement = agreementByWork.get(pair), site = application.job.site;
      const location = site ? [site.address, site.city, site.state, site.pincode].filter(Boolean).join(', ') || site.siteName : null;
      return { id: application.id, associate: user?.fullName ?? 'Unknown Associate', mobile: user?.mobile ?? null, email: user?.email ?? null,
        employer: employerNames.get(application.job.employerUserId) ?? 'Deleted / unavailable employer', company: application.job.company?.companyName ?? null,
        job: application.job.title, site: site?.siteName ?? null, work_location: location, employment_status: application.status, applied_at: iso(application.appliedAt),
        job_start: iso(application.job.startDate), job_end: iso(application.job.endDate), shift: application.job.shiftType, duty_hours: application.job.dutyHours,
        posted_salary: application.job.salaryAmount == null ? null : money(application.job.salaryAmount), payment_type: application.job.paymentType,
        attendance_records: att?.count ?? 0, approved_attendance: (att?.statuses.approved ?? 0) + (att?.statuses.verified ?? 0),
        attendance_statuses: att ? Object.entries(att.statuses).map(([status, count]) => `${status}: ${count}`).join('; ') : null,
        recorded_hours: att ? att.hours.toFixed(2) : '0.00', first_attendance: att?.first?.toISOString().slice(0, 10) ?? null, last_attendance: att?.last?.toISOString().slice(0, 10) ?? null,
        completed_earnings: pay.completed?.amount ?? '0.00', processing_earnings: pay.processing?.amount ?? '0.00',
        payment_statuses: Object.entries(pay).map(([status, value]) => `${status}: ${value.count} / INR ${value.amount}`).join('; ') || null,
        agreement_status: agreement?.status ?? null, agreement_number: agreement?.agreementNumber ?? null, agreement_from: agreement?.effectiveFrom?.toISOString().slice(0, 10) ?? null,
        agreement_until: agreement?.effectiveUntil?.toISOString().slice(0, 10) ?? null, agreement_signed_at: iso(agreement?.signedAt) };
    }),
    summary: { employment_records: total, distinct_associates: distinct.length > 10000 ? null : distinct.length,
      current_employment_statuses: Object.fromEntries(statusGroups.map(group => [group.status, group._count._all])) },
  };
}

async function associateAttendanceHistory(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const jobWhere: Prisma.JobPostWhereInput = {
    ...(actor.role === 'employer' ? { employerUserId: actor.id } : q.employer_id ? { employerUserId: q.employer_id } : {}),
    ...(q.company_id ? { companyId: q.company_id } : {}), ...(q.site_id ? { siteId: q.site_id } : {}), ...(q.job_id ? { id: q.job_id } : {}),
  };
  const where: Prisma.AttendanceRecordWhereInput = {
    ...(q.guard_id ? { guardUserId: q.guard_id } : {}), ...(q.status ? { status: q.status } : {}),
    attendanceDate: reportDateRange(q, 'calendar'), job: jobWhere,
  };
  const [total, groups, rows] = await Promise.all([
    db.attendanceRecord.count({ where }),
    db.attendanceRecord.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { totalHours: true } }),
    db.attendanceRecord.findMany({ where, skip, take, orderBy: [{ attendanceDate: 'desc' }, { inTime: 'desc' }, { id: 'desc' }], select: {
      id: true, guardUserId: true, attendanceDate: true, inTime: true, outTime: true, scheduledOutTime: true, totalHours: true,
      entryMode: true, checkoutMethod: true, status: true, employerRemarks: true, guardRemarks: true,
      job: { select: { id: true, employerUserId: true, title: true, company: { select: { companyName: true } }, site: { select: { siteName: true, address: true, city: true, state: true, pincode: true } } } },
    } }),
  ]);
  const attendanceIds = rows.map(row => row.id);
  const [associates, employers, payments] = await Promise.all([
    readInChunks(rows.map(row => row.guardUserId), batch => db.user.findMany({ where: { id: { in: batch }, role: 'guard' }, select: { id: true, fullName: true, mobile: true } })),
    readInChunks(rows.map(row => row.job?.employerUserId).filter((id): id is string => Boolean(id)), batch => db.user.findMany({ where: { id: { in: batch }, role: 'employer' }, select: { id: true, fullName: true } })),
    attendanceIds.length ? db.payment.findMany({ where: { attendanceId: { in: attendanceIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, attendanceId: true, amount: true, paymentMethod: true, paymentStatus: true, paymentDate: true } }) : [],
  ]);
  const associateNames = new Map(associates.map(user => [user.id, user]));
  const employerNames = new Map(employers.map(user => [user.id, user.fullName]));
  const paymentByAttendance = new Map<string, typeof payments[number]>();
  for (const payment of payments) if (payment.attendanceId && !paymentByAttendance.has(payment.attendanceId)) paymentByAttendance.set(payment.attendanceId, payment);
  const totalHours = groups.reduce((sum, group) => sum.add(group._sum.totalHours ?? 0), new Prisma.Decimal(0));
  return {
    total,
    basis: 'attendance_records.attendance_date (calendar date); stored check-in/out and latest linked payment record',
    warnings: [
      { code: 'ATTENDANCE_RECORDED_EVIDENCE', section: 'attendance', message: 'Times, hours, locations and statuses are stored attendance evidence. Missing checkout or hours remain unavailable and are not inferred by this report.' },
      { code: 'ATTENDANCE_SETTLEMENT_EVIDENCE', section: 'settlement', message: 'The linked settlement is the latest recorded payment for the attendance entry. Its status is recorded workflow evidence, not independent proof of bank payout.' },
    ],
    columns: col(['attendance_date', 'Attendance date'], ['associate', 'Associate'], ['mobile', 'Mobile'], ['employer', 'Employer'], ['company', 'Company'], ['job', 'Job'], ['site', 'Site'], ['work_location', 'Work location'], ['check_in', 'Check-in'], ['check_out', 'Check-out'], ['scheduled_out', 'Scheduled checkout'], ['hours', 'Recorded hours'], ['status', 'Attendance status'], ['entry_mode', 'Entry mode'], ['checkout_method', 'Checkout method'], ['associate_remarks', 'Associate remarks'], ['employer_remarks', 'Employer remarks'], ['settlement_amount', 'Linked settlement amount (INR)'], ['settlement_status', 'Linked settlement status'], ['settlement_method', 'Settlement method'], ['settlement_date', 'Settlement date'], ['id', 'Attendance ID']),
    items: rows.map(row => {
      const user = associateNames.get(row.guardUserId), payment = paymentByAttendance.get(row.id), site = row.job?.site;
      return { id: row.id, attendance_date: row.attendanceDate.toISOString().slice(0, 10), associate: user?.fullName ?? 'Unknown Associate', mobile: user?.mobile ?? null,
        employer: row.job ? employerNames.get(row.job.employerUserId) ?? 'Deleted / unavailable employer' : null, company: row.job?.company?.companyName ?? null,
        job: row.job?.title ?? null, site: site?.siteName ?? null, work_location: site ? [site.address, site.city, site.state, site.pincode].filter(Boolean).join(', ') || site.siteName : null,
        check_in: iso(row.inTime), check_out: iso(row.outTime), scheduled_out: iso(row.scheduledOutTime), hours: row.totalHours == null ? null : money(row.totalHours),
        status: row.status, entry_mode: row.entryMode, checkout_method: row.checkoutMethod, associate_remarks: row.guardRemarks, employer_remarks: row.employerRemarks,
        settlement_amount: payment ? money(payment.amount) : null, settlement_status: payment?.paymentStatus ?? null, settlement_method: payment?.paymentMethod ?? null, settlement_date: iso(payment?.paymentDate) };
    }),
    summary: { attendance_entries: total, recorded_hours: totalHours.toFixed(2), attendance_statuses: Object.fromEntries(groups.map(group => [group.status, { count: group._count._all, hours: money(group._sum.totalHours) }])) },
  };
}

async function employeeMaster(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const range = reportDateRange(q, 'timestamp');
  const staffStatus = q.status ? q.status.charAt(0).toUpperCase() + q.status.slice(1).toLowerCase() : undefined;
  const staffWhere: Prisma.StaffMemberWhereInput = { subAdminUserId: actor.id, createdAt: range, ...(staffStatus ? { status: staffStatus } : {}) };
  const subAdminWhere: Prisma.UserWhereInput = { role: 'sub_admin', subAdminProfile: { employerUserId: actor.id }, createdAt: range, ...(q.status ? { accountStatus: q.status } : {}) };
  const [staffTotal, subAdminTotal, staffGroups, subAdminGroups] = await Promise.all([
    db.staffMember.count({ where: staffWhere }), db.user.count({ where: subAdminWhere }),
    db.staffMember.groupBy({ by: ['status'], where: staffWhere, _count: { _all: true } }),
    db.user.groupBy({ by: ['accountStatus'], where: subAdminWhere, _count: { _all: true } }),
  ]);
  const readLimit = Math.min(EXPORT_LIMIT + 1, skip + take);
  const [staff, subAdmins] = await Promise.all([
    db.staffMember.findMany({ where: staffWhere, take: readLimit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
      id: true, name: true, email: true, mobile: true, status: true, role: true, permissions: true, createdAt: true,
      roleMaster: { select: { name: true, permissions: true } },
    } }),
    db.user.findMany({ where: subAdminWhere, take: readLimit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
      id: true, fullName: true, email: true, mobile: true, accountStatus: true, createdAt: true,
      subAdminProfile: { select: { branchName: true, contactEmail: true, phone: true } },
    } }),
  ]);
  const rows: Array<{ sortDate: Date; row: Row }> = [
    ...staff.map(member => ({ sortDate: member.createdAt, row: { id: member.id, type: 'Employee', name: member.name, role: member.roleMaster?.name ?? member.role,
      branch: null, email: member.email, mobile: member.mobile, status: member.status.toLowerCase(),
      permissions: permissions(member.roleMaster?.permissions ?? member.permissions), created_at: iso(member.createdAt) } })),
    ...subAdmins.map(user => ({ sortDate: user.createdAt, row: { id: user.id, type: 'Sub Admin', name: user.fullName, role: 'Sub Admin', branch: user.subAdminProfile?.branchName ?? null,
      email: user.subAdminProfile?.contactEmail ?? user.email, mobile: user.subAdminProfile?.phone ?? user.mobile,
      status: user.accountStatus, permissions: null, created_at: iso(user.createdAt) } })),
  ];
  rows.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime() || String(b.row.id).localeCompare(String(a.row.id)));
  const items = rows.slice(skip, skip + take).map(item => item.row);
  return { total: staffTotal + subAdminTotal, basis: 'staff_members/users created_at (IST); role, permissions and statuses are current',
    warnings: [{ code: 'TWO_TEAM_ACCOUNT_TYPES', section: 'employees', message: 'This tracker combines regular staff records and Sub Admin login accounts. Permissions are shown for role-based staff where stored; Sub Admin access is represented by its account type and branch.' }],
    columns: col(['type', 'Employee type'], ['name', 'Name'], ['role', 'Role'], ['branch', 'Branch / team'], ['mobile', 'Mobile'], ['email', 'Email'], ['status', 'Status'], ['permissions', 'Permissions'], ['created_at', 'Created at'], ['id', 'Employee ID']), items,
    summary: { total_employees: staffTotal + subAdminTotal, regular_staff: staffTotal, sub_admins: subAdminTotal,
      regular_staff_statuses: Object.fromEntries(staffGroups.map(group => [group.status.toLowerCase(), group._count._all])),
      sub_admin_statuses: Object.fromEntries(subAdminGroups.map(group => [group.accountStatus, group._count._all])) } };
}

async function jobMaster(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const where: Prisma.JobPostWhereInput = { employerUserId: actor.id, ...(q.company_id ? { companyId: q.company_id } : {}),
    ...(q.status ? { status: q.status } : {}), createdAt: reportDateRange(q, 'timestamp') };
  const [total, jobStatuses, applicationStatuses] = await Promise.all([
    db.jobPost.count({ where }), db.jobPost.groupBy({ by: ['status'], where, _count: { _all: true } }),
    db.jobApplication.groupBy({ by: ['status'], where: { job: where }, _count: { _all: true } }),
  ]);
  const page = await db.jobPost.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
    id: true, title: true, category: true, guardType: true, guardsRequired: true, status: true, startDate: true, endDate: true,
    shiftType: true, paymentType: true, salaryAmount: true, createdAt: true, company: { select: { companyName: true } }, site: { select: { siteName: true } },
  } });
  const perJob = page.length ? await db.jobApplication.groupBy({ by: ['jobId', 'status'], where: { jobId: { in: page.map(job => job.id) }, job: where }, _count: { _all: true } }) : [];
  const counts = new Map<string, Record<string, number>>();
  for (const group of perJob) { const current = counts.get(group.jobId) ?? {}; current[group.status] = group._count._all; counts.set(group.jobId, current); }
  return { total, basis: 'job_posts.created_at (IST); job and application statuses are current',
    warnings: [{ code: 'CURRENT_JOB_STATUS', section: 'jobs', message: 'Application and vacancy counts use current application statuses. They are not a historical staffing snapshot.' }],
    columns: col(['title', 'Job'], ['company', 'Company'], ['site', 'Site'], ['category', 'Category'], ['associate_type', 'Associate type'], ['status', 'Status'], ['required', 'Required'], ['applications', 'Applications'], ['filled', 'Filled'], ['remaining', 'Remaining'], ['salary', 'Salary (INR)'], ['payment_type', 'Payment type'], ['shift', 'Shift'], ['start_date', 'Start date'], ['end_date', 'End date'], ['created_at', 'Created at'], ['id', 'Job ID']),
    items: page.map(job => { const byStatus = counts.get(job.id) ?? {}; const filled = FILLED_APPLICATION_STATUSES.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);
      return { id: job.id, title: job.title, company: job.company?.companyName ?? null, site: job.site?.siteName ?? null, category: job.category,
        associate_type: job.guardType, status: job.status, required: Math.max(1, job.guardsRequired), applications: Object.values(byStatus).reduce((sum, count) => sum + count, 0), filled,
        remaining: Math.max(0, Math.max(1, job.guardsRequired) - filled), salary: job.salaryAmount?.toString() ?? null, payment_type: job.paymentType,
        shift: job.shiftType, start_date: iso(job.startDate), end_date: iso(job.endDate), created_at: iso(job.createdAt) }; }),
    summary: { jobs: total, current_job_statuses: Object.fromEntries(jobStatuses.map(group => [group.status, group._count._all])),
      current_application_statuses: Object.fromEntries(applicationStatuses.map(group => [group.status, group._count._all])) } };
}

async function registrations(db: Db, actor: ReportActor, kind: string, q: Query, skip: number, take: number): Promise<Result> {
  const role = kind === 'employer-registrations' ? 'employer' : 'guard';
  const profileScope = employerScope(actor);
  const scope: Prisma.UserWhereInput = { role,
    ...(profileScope && role === 'employer' ? { employerProfile: profileScope } : {}),
    ...(actor.role === 'sub_admin' && role === 'guard' ? { guardProfile: { subAdminId: actor.id } } : {}),
  };
  const where: Prisma.UserWhereInput = { ...scope, ...(q.status ? { accountStatus: q.status } : {}), createdAt: reportDateRange(q, 'timestamp') };
  const total = await db.user.count({ where });
  const cumulative = await db.user.count({ where: { ...scope, ...(q.status ? { accountStatus: q.status } : {}), createdAt: reportDateRange({ date_to: q.date_to }, 'timestamp') } });
  const before = q.date_from ? await db.user.count({ where: { ...scope, ...(q.status ? { accountStatus: q.status } : {}), createdAt: { lt: reportDateRange(q, 'timestamp').gte } } }) : 0;
  const groups = await db.user.groupBy({ by: ['accountStatus'], where, _count: { _all: true } });
  const users = await db.user.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
    id: true, fullName: true, createdAt: true, accountStatus: true,
    employerProfile: { select: { city: true, state: true, verificationStatus: true, profileStatus: true } },
    guardProfile: { select: { city: true, state: true, verificationStatus: true } },
  } });
  const warnings: ReportWarning[] = [{ code: 'CURRENT_STATUS', section: 'registrations', message: 'Account and verification statuses are current values, not historical snapshots. Cumulative counts include retained accounts only.' }];
  if (profileScope) warnings.push({ code: 'CURRENT_ASSIGNMENTS', section: 'scope', message: 'Registration dates are filtered within your currently assigned portfolio; historical assignment is not reconstructed.' });
  let daily: Record<string, number> | null = null, monthly: Record<string, number> | null = null;
  if (total <= 10000) {
    const dates = await db.user.findMany({ where, select: { createdAt: true }, take: 10000, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    daily = {}; monthly = {};
    for (const row of dates) {
      const day = new Date(row.createdAt.getTime() + 330 * 60000).toISOString().slice(0, 10), month = day.slice(0, 7);
      daily[day] = (daily[day] ?? 0) + 1; monthly[month] = (monthly[month] ?? 0) + 1;
    }
  } else warnings.push({ code: 'TREND_LIMIT', section: 'trends', message: 'Daily and monthly trends are unavailable above 10,000 matching accounts. Narrow the dates. Registration totals remain complete.' });
  return { total, basis: 'users.created_at (IST); statuses and assignments are current', warnings,
    columns: col(['name', 'Name'], ['registered_at', 'Registered at'], ['status', 'Current account status'], ['verification', 'Current verification'], ['city', 'City'], ['state', 'State'], ['id', 'Account ID']),
    items: users.map(u => { const p = role === 'employer' ? u.employerProfile : u.guardProfile; return { id: u.id, name: u.fullName, registered_at: iso(u.createdAt), status: u.accountStatus, verification: p?.verificationStatus ?? null, city: p?.city ?? null, state: p?.state ?? null }; }),
    summary: { period_registrations: total, registrations_before_period: before, cumulative_registrations_through_end: cumulative,
      current_status_of_period_accounts: Object.fromEntries(groups.map(g => [g.accountStatus, g._count._all])), daily_registrations: daily, monthly_registrations: monthly },
  };
}

async function employerCredits(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const ownerId = actor.role === 'employer' ? actor.id : q.employer_id;
  const walletWhere: Prisma.EmployerWalletWhereInput = { user: { role: 'employer' }, ...(ownerId ? { employerUserId: ownerId } : {}) };
  const wallets = await db.employerWallet.findMany({ where: walletWhere, select: { id: true, employerUserId: true, balance: true }, take: 1001 });
  if (wallets.length > 1000) throw new HttpError(422, 'Select an Employer to narrow the credits statement.');
  const walletIds = wallets.map(w => w.id), byId = new Map(wallets.map(w => [w.id, w]));
  // At most 500 IDs in each predicate. Never trust the denormalised movement owner.
  const walletOr = Array.from({ length: Math.ceil(walletIds.length / 500) }, (_, i) => ({ walletId: { in: walletIds.slice(i * 500, i * 500 + 500) } }));
  const where: Prisma.WalletTransactionWhereInput = { ...(walletOr.length ? { OR: walletOr } : { walletId: { in: [] } }), transactionType: 'credit', status: 'completed', createdAt: reportDateRange(q, 'timestamp'), ...(q.source ? { source: q.source } : {}) };
  const total = await db.walletTransaction.count({ where });
  const groups = await db.walletTransaction.groupBy({ by: ['source'], where, _sum: { amount: true }, _count: { _all: true } });
  const rows = await db.walletTransaction.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, walletId: true, amount: true, source: true, referenceType: true, referenceId: true, createdAt: true, balanceAfter: true } });
  const owners = await readInChunks([...new Set(rows.map(r => byId.get(r.walletId)!.employerUserId))], batch => db.user.findMany({ where: { id: { in: batch } }, select: { id: true, fullName: true } }));
  const names = new Map(owners.map(u => [u.id, u.fullName]));
  return { total, basis: 'wallet_transactions.created_at (IST); completed credit entries only',
    warnings: [{ code: 'CREDITS_NOT_COLLECTIONS', section: 'credits', message: 'Credits include recorded admin credits and mock recharges where present. They are not proof of external bank collection. Current balance is account-wide, not the selected period closing balance.' }],
    columns: col(['created_at', 'Credit date'], ['employer', 'Employer'], ['amount', 'Credit amount (INR)'], ['source', 'Source'], ['reference_type', 'Reference type'], ['reference_id', 'Reference ID'], ['balance_after', 'Recorded balance after (INR)'], ['id', 'Movement ID']),
    items: rows.map(r => ({ id: r.id, created_at: iso(r.createdAt), employer: names.get(byId.get(r.walletId)!.employerUserId) ?? 'Unknown', amount: money(r.amount), source: r.source, reference_type: r.referenceType, reference_id: r.referenceId, balance_after: r.balanceAfter == null ? null : money(r.balanceAfter) })),
    summary: { completed_credit_entries: total, total_completed_credits: money(groups.reduce((sum, g) => sum.add(g._sum.amount ?? 0), new Prisma.Decimal(0))),
      credit_sources: Object.fromEntries(groups.map(g => [g.source ?? 'unknown', { count: g._count._all, amount: money(g._sum.amount) }])),
      current_account_balance: ownerId ? (wallets[0] ? money(wallets[0].balance) : null) : undefined },
  };
}

async function associateWallets(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const ownerId = actor.role === 'guard' ? actor.id : q.guard_id;
  const where: Prisma.UserWhereInput = { role: 'guard', ...(ownerId ? { id: ownerId } : {}), ...(q.status ? { accountStatus: q.status } : {}) };
  const total = await db.user.count({ where });
  const walletWhere: Prisma.AssociateWalletWhereInput = { user: where };
  const aggregate = await db.associateWallet.aggregate({ where: walletWhere, _sum: { availableBalance: true, reservedBalance: true } });
  const stored = await db.associateWallet.count({ where: walletWhere });
  const rows = await db.user.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, fullName: true, accountStatus: true, associateWallet: { select: { id: true, availableBalance: true, reservedBalance: true, status: true } } } });
  const available = new Prisma.Decimal(aggregate._sum.availableBalance ?? 0), reserved = new Prisma.Decimal(aggregate._sum.reservedBalance ?? 0);
  return { total, basis: 'Current stored wallet snapshot; no date filter',
    warnings: [{ code: 'STORED_WALLETS_ONLY', section: 'balances', message: 'Only existing recorded wallets are read; legacy payments are not imported and wallets are not created. Missing balances are unknown, not zero. Historical opening/closing is unavailable for the Associate ledger.' }],
    columns: col(['name', 'Associate'], ['account_status', 'Account status'], ['wallet_status', 'Wallet status'], ['available', 'Available (INR)'], ['reserved', 'Reserved (INR)'], ['total_balance', 'Available + reserved (INR)'], ['id', 'Associate ID']),
    items: rows.map(u => ({ id: u.id, name: u.fullName, account_status: u.accountStatus, wallet_status: u.associateWallet?.status ?? 'not-created', available: u.associateWallet ? money(u.associateWallet.availableBalance) : null, reserved: u.associateWallet ? money(u.associateWallet.reservedBalance) : null, total_balance: u.associateWallet ? u.associateWallet.availableBalance.add(u.associateWallet.reservedBalance).toFixed(2) : null })),
    summary: { associates: total, stored_wallets: stored, wallets_not_created: total - stored, stored_available: available.toFixed(2), stored_reserved: reserved.toFixed(2), stored_total: available.add(reserved).toFixed(2) },
  };
}

async function associateStatement(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const ownerId = actor.role === 'guard' ? actor.id : q.guard_id;
  const where: Prisma.AssociateWalletTransactionWhereInput = { wallet: { ...(ownerId ? { guardUserId: ownerId } : {}), user: { role: 'guard' } }, createdAt: reportDateRange(q, 'timestamp'), ...(q.status ? { status: q.status } : {}) };
  const total = await db.associateWalletTransaction.count({ where });
  const groups = await db.associateWalletTransaction.groupBy({ by: ['transactionType', 'status', 'referenceType'], where, _sum: { amount: true }, _count: { _all: true } });
  const rows = await db.associateWalletTransaction.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, transactionType: true, amount: true, status: true, purpose: true, referenceType: true, referenceId: true, createdAt: true, wallet: { select: { guardUserId: true, user: { select: { fullName: true } } } } } });
  const sumType = (type: string) => money(groups.filter(g => g.transactionType === type && g.status === 'completed').reduce((sum, g) => sum.add(g._sum.amount ?? 0), new Prisma.Decimal(0)));
  return { total, basis: 'associate_wallet_transactions.created_at (IST)',
    warnings: [{ code: 'RESERVES_SEPARATE', section: 'statement', message: 'Reserve and release entries are shown separately from credits and final debits. Recorded earnings credits do not prove bank payout. Historical opening/closing balances are unavailable because the ledger has no recorded balance-after chain. Legacy payments are not synchronised by reports.' }],
    columns: col(['created_at', 'Entry date'], ['associate', 'Associate'], ['type', 'Movement type'], ['amount', 'Amount (INR)'], ['status', 'Status'], ['reference_type', 'Reference type'], ['reference_id', 'Reference ID'], ['purpose', 'Purpose'], ['id', 'Movement ID']),
    items: rows.map(r => ({ id: r.id, created_at: iso(r.createdAt), associate: r.wallet.user.fullName, type: r.transactionType, amount: money(r.amount), status: r.status, reference_type: r.referenceType, reference_id: r.referenceId, purpose: r.purpose })),
    summary: { movements: total, total_completed_credits: sumType('credit'), total_completed_debits: sumType('debit'), total_reserve_entries: sumType('reserve'), total_release_entries: sumType('release'), opening_balance: null, closing_balance: null,
      breakdown: Object.fromEntries(groups.map(g => [`${g.transactionType} / ${g.status} / ${g.referenceType ?? 'unknown'}`, { count: g._count._all, amount: money(g._sum.amount) }])) },
  };
}

async function withdrawals(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const ownerId = actor.role === 'guard' ? actor.id : q.guard_id;
  const where: Prisma.WithdrawalRequestWhereInput = { ...(ownerId ? { guardUserId: ownerId } : {}), ...(q.status ? { status: q.status } : {}), createdAt: reportDateRange(q, 'timestamp') };
  const total = await db.withdrawalRequest.count({ where });
  const groups = await db.withdrawalRequest.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { amount: true, feeAmount: true, netAmount: true } });
  const rows = await db.withdrawalRequest.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, guardUserId: true, createdAt: true, status: true, amount: true, feeAmount: true, netAmount: true, reviewedAt: true, rejectionReason: true, gatewayReference: true, gatewayStatus: true } });
  const users = await readInChunks(rows.map(r => r.guardUserId), batch => db.user.findMany({ where: { id: { in: batch } }, select: { id: true, fullName: true } }));
  const names = new Map(users.map(u => [u.id, u.fullName]));
  return { total, basis: 'withdrawal_requests.created_at (IST); status and pending age as of generation',
    warnings: [{ code: 'RECORDED_PAYOUT_STATUS', section: 'withdrawals', message: 'Gateway references and stored completed statuses are recorded evidence, not independent bank reconciliation. Pending age applies only to requested, approved and processing records.' }],
    columns: col(['created_at', 'Requested at'], ['associate', 'Associate'], ['amount', 'Requested (INR)'], ['fee', 'Fee (INR)'], ['net', 'Net (INR)'], ['status', 'Status'], ['pending_days', 'Pending age (days)'], ['reviewed_at', 'Reviewed at'], ['gateway_reference', 'Gateway reference'], ['gateway_status', 'Gateway status'], ['rejection_reason', 'Rejection reason'], ['id', 'Request ID']),
    items: rows.map(r => ({ id: r.id, created_at: iso(r.createdAt), associate: names.get(r.guardUserId) ?? 'Unknown', amount: money(r.amount), fee: money(r.feeAmount), net: money(r.netAmount), status: r.status, pending_days: ['requested', 'approved', 'processing'].includes(r.status) ? Math.max(0, Math.floor((Date.now() - r.createdAt.getTime()) / 86400000)) : null, reviewed_at: iso(r.reviewedAt), gateway_reference: r.gatewayReference, gateway_status: r.gatewayStatus, rejection_reason: r.rejectionReason })),
    summary: { requests: total, lifecycle: Object.fromEntries(groups.map(g => [g.status, { count: g._count._all, requested: money(g._sum.amount), fee: money(g._sum.feeAmount), net: money(g._sum.netAmount) }])) },
  };
}

async function pipeline(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const where: Prisma.JobApplicationWhereInput = { ...await pipelineScope(db, actor, q), appliedAt: reportDateRange(q, 'timestamp'), ...(q.status ? { status: q.status } : {}) };
  const total = await db.jobApplication.count({ where });
  const groups = await db.jobApplication.groupBy({ by: ['status'], where, _count: { _all: true } });
  const distinct = await db.jobApplication.groupBy({ by: ['guardUserId'], where, _count: { _all: true }, take: 10001, orderBy: { guardUserId: 'asc' } });
  const hired = await db.jobApplication.groupBy({ by: ['guardUserId'], where: { AND: [where, { status: { in: ['hired', 'joined', 'leave_requested'] } }] }, _count: { _all: true }, take: 10001, orderBy: { guardUserId: 'asc' } });
  const rows = await db.jobApplication.findMany({ where, skip, take, orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }], select: { id: true, guardUserId: true, status: true, appliedAt: true, reviewedAt: true, job: { select: { id: true, title: true } } } });
  const users = await readInChunks(rows.map(r => r.guardUserId), batch => db.user.findMany({ where: { id: { in: batch } }, select: { id: true, fullName: true } }));
  const names = new Map(users.map(u => [u.id, u.fullName]));
  const warnings: ReportWarning[] = [{ code: 'CURRENT_PIPELINE', section: 'pipeline', message: 'Counts are current application statuses for the selected application dates; this is not historical stage conversion, time-to-fill or proof of actual joining. Age is elapsed days since application, not time in the current stage.' }];
  if (distinct.length > 10000) warnings.push({ code: 'DISTINCT_LIMIT', section: 'summary', message: 'Distinct Associate count is unavailable above 10,000 groups. Application totals and status totals remain complete.' });
  return { total, warnings, basis: 'job_applications.applied_at (IST); current application status',
    columns: col(['associate', 'Associate'], ['job', 'Job'], ['applied_at', 'Applied at'], ['status', 'Current status'], ['elapsed_days', 'Days since application'], ['reviewed_at', 'Reviewed at'], ['id', 'Application ID']),
    items: rows.map(r => ({ id: r.id, associate: names.get(r.guardUserId) ?? 'Unknown', job: r.job.title, applied_at: iso(r.appliedAt), status: r.status, elapsed_days: Math.max(0, Math.floor((Date.now() - r.appliedAt.getTime()) / 86400000)), reviewed_at: iso(r.reviewedAt) })),
    summary: { applications: total, distinct_associates: distinct.length > 10000 ? null : distinct.length, distinct_current_hired_associates_in_filtered_applications: hired.length > 10000 ? null : hired.length, current_application_statuses: Object.fromEntries(groups.map(g => [g.status, g._count._all])) },
  };
}

async function companyRegister(db: Db, actor: ReportActor, kind: string, q: Query, skip: number, take: number): Promise<Result> {
  if (kind === 'companies') {
    const where: Prisma.EmployerCompanyWhereInput = { employerUserId: actor.id, createdAt: reportDateRange(q, 'timestamp'), ...(q.status ? { accountStatus: q.status } : {}) };
    const total = await db.employerCompany.count({ where });
    const rows = await db.employerCompany.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, companyName: true, businessType: true, companyEmail: true, companyPhone: true, gstNumber: true, panNumber: true, website: true, registeredAddress: true, city: true, state: true, pincode: true, createdAt: true, accountStatus: true, verificationStatus: true } });
    return { total, basis: 'employer_companies.created_at (IST)', columns: col(['name', 'Company'], ['business_type', 'Business type'], ['email', 'Company email'], ['phone', 'Company phone'], ['gst', 'GST number'], ['pan', 'PAN number'], ['website', 'Website'], ['address', 'Registered address'], ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'], ['status', 'Account status'], ['verification', 'Verification'], ['created_at', 'Created at'], ['id', 'Company ID']), items: rows.map(r => ({ id: r.id, name: r.companyName, business_type: r.businessType, email: r.companyEmail, phone: r.companyPhone, gst: r.gstNumber, pan: r.panNumber, website: r.website, address: r.registeredAddress, city: r.city, state: r.state, pincode: r.pincode, status: r.accountStatus, verification: r.verificationStatus, created_at: iso(r.createdAt) })), summary: { companies: total } };
  }
  const companies = await db.employerCompany.findMany({ where: { employerUserId: actor.id, ...(q.company_id ? { id: q.company_id } : {}) }, select: { id: true, companyName: true }, take: 501 });
  if (companies.length > 500) throw new HttpError(422, 'Select a company to narrow the site register.');
  const names = new Map(companies.map(c => [c.id, c.companyName]));
  const where: Prisma.CompanySiteWhereInput = { companyId: { in: companies.map(c => c.id) }, createdAt: reportDateRange(q, 'timestamp'), ...(q.status ? { status: q.status } : {}) };
  const total = await db.companySite.count({ where });
  const rows = await db.companySite.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, companyId: true, siteName: true, code: true, siteType: true, address: true, city: true, state: true, pincode: true, contactPerson: true, contactMobile: true, shiftDetails: true, createdAt: true, status: true } });
  return { total, basis: 'company_sites.created_at (IST)', columns: col(['name', 'Site'], ['code', 'Site code'], ['company', 'Company'], ['type', 'Site type'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'], ['contact_person', 'Contact person'], ['contact_mobile', 'Contact mobile'], ['shift_details', 'Shift details'], ['status', 'Status'], ['created_at', 'Created at'], ['id', 'Site ID']), items: rows.map(r => ({ id: r.id, name: r.siteName, code: r.code, company: names.get(r.companyId) ?? null, type: r.siteType, address: r.address, city: r.city, state: r.state, pincode: r.pincode, contact_person: r.contactPerson, contact_mobile: r.contactMobile, shift_details: r.shiftDetails, status: r.status, created_at: iso(r.createdAt) })), summary: { sites: total } };
}

async function invoices(db: Db, actor: ReportActor, q: Query, skip: number, take: number): Promise<Result> {
  const ownerId = actor.role === 'employer' ? actor.id : q.employer_id;
  const where: Prisma.InvoiceWhereInput = { ...(ownerId ? { employerUserId: ownerId } : {}), ...(q.company_id ? { companyId: q.company_id } : {}), ...(q.status ? { paymentStatus: q.status } : {}), invoiceDate: reportDateRange(q, 'calendar') };
  const total = await db.invoice.count({ where });
  const groups = await db.invoice.groupBy({ by: ['paymentStatus'], where, _sum: { amount: true, taxAmount: true, totalAmount: true }, _count: { _all: true } });
  const rows = await db.invoice.findMany({ where, skip, take, orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }], select: { id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, amount: true, taxAmount: true, totalAmount: true, paymentStatus: true, paidAt: true } });
  const today = Date.parse(new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10) + 'T00:00:00Z');
  return { total, basis: 'invoices.invoice_date (calendar date); overdue age as of today IST', warnings: [{ code: 'INVOICE_FACE_VALUE', section: 'invoices', message: 'Totals are stored invoice face values by status. Outstanding receivables and partial payment allocation cannot be reconstructed from invoice status alone; ageing excludes paid/cancelled/void records.' }],
    columns: col(['number', 'Invoice'], ['invoice_date', 'Invoice date'], ['due_date', 'Due date'], ['amount', 'Base (INR)'], ['tax', 'Tax (INR)'], ['total', 'Total (INR)'], ['status', 'Payment status'], ['overdue_days', 'Overdue days'], ['paid_at', 'Paid at'], ['id', 'Invoice ID']),
    items: rows.map(r => ({ id: r.id, number: r.invoiceNumber, invoice_date: r.invoiceDate.toISOString().slice(0, 10), due_date: r.dueDate?.toISOString().slice(0, 10) ?? null, amount: money(r.amount), tax: money(r.taxAmount), total: money(r.totalAmount), status: r.paymentStatus, overdue_days: r.dueDate && !r.paidAt && !['paid', 'completed', 'cancelled', 'void'].includes(r.paymentStatus) ? Math.max(0, Math.floor((today - r.dueDate.getTime()) / 86400000)) : null, paid_at: iso(r.paidAt) })),
    summary: { invoices: total, invoice_face_values_by_status: Object.fromEntries(groups.map(g => [g.paymentStatus, { count: g._count._all, base: money(g._sum.amount), tax: money(g._sum.taxAmount), total: money(g._sum.totalAmount) }])) },
  };
}

export async function extendedReport(db: Db, actor: ReportActor | undefined, role: ReportingRole, kind: string, raw: unknown, exporting = false) {
  const user = authorize(actor, role);
  if (!EXTENDED_REPORTS[role].some(r => r.kind === kind)) throw new HttpError(404, 'Report not available for your role.');
  const q = schema.parse(raw);
  for (const key of Object.keys(raw as object)) if (![...commonFilters, ...allowed[kind]].includes(key)) throw new HttpError(422, `Unsupported filter: ${key}.`);
  if (role === 'employer' && q.employer_id) throw new HttpError(422, 'Employer scope comes from your signed-in account.');
  if (role === 'guard' && q.guard_id) throw new HttpError(422, 'Associate scope comes from your signed-in account.');
  if ((role === 'employer' || role === 'super_admin') && ['sites', 'invoices', 'recruitment-pipeline', 'associate-work-history', 'associate-attendance-history', 'associates', 'jobs'].includes(kind) && (q.employer_id || q.company_id || q.site_id || q.job_id)) {
    const resolved = await resolveReportScope(db, user, role, q);
    if (role === 'super_admin' && resolved.employerUserId) q.employer_id = resolved.employerUserId;
  }
  if (kind === 'associate-wallets' && (q.date_from || q.date_to)) throw new HttpError(422, 'Wallet balances are a current snapshot and do not accept dates.');
  // Validate dates even for reports where a filtered table is empty.
  reportDateRange(q, 'timestamp');
  const { skip, take } = exporting ? { skip: 0, take: EXPORT_LIMIT + 1 } : reportPagination(q);
  let result: Result;
  if (kind.endsWith('-registrations')) result = await registrations(db, user, kind, q, skip, take);
  else if (kind === 'employer-master') result = await employerMaster(db, q, skip, take);
  else if (kind === 'employer-credits') result = await employerCredits(db, user, q, skip, take);
  else if (kind === 'associate-wallets') result = await associateWallets(db, user, q, skip, take);
  else if (kind === 'associate-statement') result = await associateStatement(db, user, q, skip, take);
  else if (kind === 'withdrawals') result = await withdrawals(db, user, q, skip, take);
  else if (kind === 'associates') result = await associateMaster(db, user, q, skip, take);
  else if (kind === 'associate-work-history') result = await associateWorkHistory(db, user, q, skip, take);
  else if (kind === 'associate-attendance-history') result = await associateAttendanceHistory(db, user, q, skip, take);
  else if (kind === 'employees') result = await employeeMaster(db, user, q, skip, take);
  else if (kind === 'jobs') result = await jobMaster(db, user, q, skip, take);
  else if (kind === 'recruitment-pipeline') result = await pipeline(db, user, q, skip, take);
  else if (kind === 'invoices') result = await invoices(db, user, q, skip, take);
  else result = await companyRegister(db, user, kind, q, skip, take);
  const scope = { role, ...(role === 'super_admin' || role === 'finance' ? { scope: 'platform' } : { account_id: user.id }) };
  if (exporting) {
    const metadata = { report: kind, scope, filters: q, date_basis: result.basis, timezone: 'Asia/Kolkata', generated_at: new Date().toISOString(), summary: result.summary, warnings: result.warnings ?? [] };
    return { csv: reportCsv(result.items, [...result.columns.map(c => ({ header: c.label, value: (r: Row) => r[c.key] })), { header: 'Report metadata', value: () => JSON.stringify(metadata) }], result.total, EXPORT_LIMIT) };
  }
  return { ...reportResponse(result.items, result.summary, result.total, q, { scope, filters: q, date_basis: result.basis, warnings: result.warnings }), columns: result.columns };
}
