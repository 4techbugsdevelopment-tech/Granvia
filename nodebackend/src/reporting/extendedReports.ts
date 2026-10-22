import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../utils/http';
import { readInChunks, reportDateRange, reportPagination, reportQuerySchema } from './query';
import { reportCsv, reportResponse, type ReportWarning } from './response';
import { resolveReportScope, type ReportActor } from './scope';

type Db = Prisma.TransactionClient;
export type ReportingRole = 'super_admin' | 'employer' | 'guard' | 'sub_admin' | 'sales_executive' | 'operations' | 'finance';
type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;
type Column = { key: string; label: string };
const col = (...pairs: [string, string][]): Column[] => pairs.map(([key, label]) => ({ key, label }));
const EXPORT_LIMIT = 5000;
const money = (value: Prisma.Decimal | null | undefined) => new Prisma.Decimal(value ?? 0).toFixed(2);
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

/** Every entry is a real report. Deferred catalogue items are not advertised as implemented. */
export const EXTENDED_REPORTS: Record<ReportingRole, { kind: string; label: string }[]> = {
  super_admin: [
    { kind: 'employer-registrations', label: 'Employer registrations & growth' },
    { kind: 'associate-registrations', label: 'Associate registrations & growth' },
    { kind: 'employer-credits', label: 'Employer credits statement' },
    { kind: 'associate-wallets', label: 'Associate wallet balances' },
    { kind: 'associate-statement', label: 'Associate wallet movements' },
    { kind: 'withdrawals', label: 'Withdrawals & payout monitoring' },
    { kind: 'recruitment-pipeline', label: 'Recruitment pipeline & ageing' },
    { kind: 'invoices', label: 'Invoice register & ageing' },
  ],
  employer: [
    { kind: 'employer-credits', label: 'Total credits statement' },
    { kind: 'recruitment-pipeline', label: 'Applicants, workforce & pipeline' },
    { kind: 'companies', label: 'Company register' },
    { kind: 'sites', label: 'Site register' },
    { kind: 'invoices', label: 'Invoice register & ageing' },
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
  if (definition.filters.includes('guard_id') && role === 'super_admin') {
    const rows = await db.user.findMany({ where: { role: 'guard', ...(q.search ? { fullName: { contains: q.search } } : {}) }, select: { id: true, fullName: true }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], take: 501 });
    add('guard_id', rows.map(r => ({ id: r.id, label: r.fullName })));
  }
  if (definition.filters.includes('company_id') && ['super_admin', 'employer'].includes(role)) {
    const rows = await db.employerCompany.findMany({ where: { ...(role === 'employer' ? { employerUserId: user.id } : {}), ...(q.search ? { companyName: { contains: q.search } } : {}) }, select: { id: true, companyName: true }, orderBy: [{ companyName: 'asc' }, { id: 'asc' }], take: 501 });
    add('company_id', rows.map(r => ({ id: r.id, label: r.companyName })));
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
  'employer-credits': ['employer_id', 'source'], 'associate-wallets': ['guard_id', 'status'],
  'associate-statement': ['guard_id', 'status'], withdrawals: ['guard_id', 'status'],
  'recruitment-pipeline': ['employer_id', 'company_id', 'site_id', 'job_id', 'guard_id', 'status'],
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
    const rows = await db.employerCompany.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, companyName: true, createdAt: true, accountStatus: true, verificationStatus: true, city: true, state: true } });
    return { total, basis: 'employer_companies.created_at (IST)', columns: col(['name', 'Company'], ['created_at', 'Created at'], ['status', 'Account status'], ['verification', 'Verification'], ['city', 'City'], ['state', 'State'], ['id', 'Company ID']), items: rows.map(r => ({ id: r.id, name: r.companyName, created_at: iso(r.createdAt), status: r.accountStatus, verification: r.verificationStatus, city: r.city, state: r.state })), summary: { companies: total } };
  }
  const companies = await db.employerCompany.findMany({ where: { employerUserId: actor.id, ...(q.company_id ? { id: q.company_id } : {}) }, select: { id: true, companyName: true }, take: 501 });
  if (companies.length > 500) throw new HttpError(422, 'Select a company to narrow the site register.');
  const names = new Map(companies.map(c => [c.id, c.companyName]));
  const where: Prisma.CompanySiteWhereInput = { companyId: { in: companies.map(c => c.id) }, createdAt: reportDateRange(q, 'timestamp'), ...(q.status ? { status: q.status } : {}) };
  const total = await db.companySite.count({ where });
  const rows = await db.companySite.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, companyId: true, siteName: true, createdAt: true, status: true } });
  return { total, basis: 'company_sites.created_at (IST)', columns: col(['name', 'Site'], ['company', 'Company'], ['status', 'Status'], ['created_at', 'Created at'], ['id', 'Site ID']), items: rows.map(r => ({ id: r.id, name: r.siteName, company: names.get(r.companyId) ?? null, status: r.status, created_at: iso(r.createdAt) })), summary: { sites: total } };
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
  if ((role === 'employer' || role === 'super_admin') && ['sites', 'invoices', 'recruitment-pipeline'].includes(kind) && (q.employer_id || q.company_id || q.site_id || q.job_id)) {
    const resolved = await resolveReportScope(db, user, role, q);
    if (role === 'super_admin' && resolved.employerUserId) q.employer_id = resolved.employerUserId;
  }
  if (kind === 'associate-wallets' && (q.date_from || q.date_to)) throw new HttpError(422, 'Wallet balances are a current snapshot and do not accept dates.');
  // Validate dates even for reports where a filtered table is empty.
  reportDateRange(q, 'timestamp');
  const { skip, take } = exporting ? { skip: 0, take: EXPORT_LIMIT + 1 } : reportPagination(q);
  let result: Result;
  if (kind.endsWith('-registrations')) result = await registrations(db, user, kind, q, skip, take);
  else if (kind === 'employer-credits') result = await employerCredits(db, user, q, skip, take);
  else if (kind === 'associate-wallets') result = await associateWallets(db, user, q, skip, take);
  else if (kind === 'associate-statement') result = await associateStatement(db, user, q, skip, take);
  else if (kind === 'withdrawals') result = await withdrawals(db, user, q, skip, take);
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
