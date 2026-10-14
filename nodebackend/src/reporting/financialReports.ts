import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../utils/http';
import { assertReportRole, resolveReportScope, type ReportActor } from './scope';
import { readInChunks, reportAmount, reportAmountRange, reportDateRange, reportPagination, reportQuerySchema } from './query';
import { reportCsv, reportResponse, type ReportWarning } from './response';
import { EXPORT_LIMIT, type Column } from './employerReports';

type Db = Prisma.TransactionClient;
type Row = Record<string, unknown>;
type Role = 'employer' | 'super_admin';
export const EMPLOYER_FINANCIAL_KINDS = ['payments', 'wallet-statement'] as const;
export const ADMIN_FINANCIAL_KINDS = ['wallets', 'wallet-movements', 'settlements'] as const;
export type FinancialKind = typeof EMPLOYER_FINANCIAL_KINDS[number] | typeof ADMIN_FINANCIAL_KINDS[number];
const HISTORY_LIMIT = 10000;
const querySchema = reportQuerySchema.extend({
  guard_id: z.string().uuid().optional(), status: z.string().min(1).max(50).optional(), date_basis: z.string().optional(),
  payment_method: z.string().min(1).max(50).optional(), source: z.string().min(1).max(50).optional(),
  transaction_type: z.enum(['credit', 'debit']).optional(), reference_id: z.string().min(1).max(36).optional(),
  min_amount: reportAmount.optional(), max_amount: reportAmount.optional(),
  linkage: z.enum(['attendance-linked', 'application-only', 'job-only', 'unlinked', 'missing-reference', 'conflicting']).optional(),
  link_condition: z.enum(['missing-debit', 'missing-credit', 'amount-mismatch', 'multiple-entries', 'status-mismatch', 'unlinked']).optional(),
}).strict();
type Query = z.infer<typeof querySchema>;
const dec = (value: unknown) => new Prisma.Decimal(value == null ? 0 : String(value));
const money = (value: unknown) => value == null ? null : dec(value).toFixed(2);
const dateText = (value: Date | null) => value?.toISOString() ?? null;
const object = (value: unknown): Row => (value ?? {}) as Row;
function validateFilters(raw: unknown, supported: string[]) {
  const common = ['page', 'page_size', 'employer_id'];
  for (const key of Object.keys(raw as Row)) if (![...common, ...supported].includes(key)) throw new HttpError(422, `Unsupported filter: ${key}.`);
}
function missingSchema(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && ['P2021', 'P2022'].includes(error.code); }
const cols = (...pairs: string[][]): Column[] => pairs.map(([key, label]) => ({ key, label }));
const paymentColumns = cols(['id', 'Payment ID'], ['employer', 'Employer'], ['associate', 'Associate'], ['company', 'Company'], ['site', 'Site'], ['job', 'Job'], ['linkage', 'Linkage'], ['attendance_id', 'Attendance ID'], ['application_id', 'Application ID'], ['amount', 'Amount (INR)'], ['method', 'Method'], ['status', 'Recorded payment status'], ['created_at', 'Created date'], ['payment_date', 'Recorded payment date'], ['debit_references', 'Employer debit IDs'], ['debit_amount', 'Recorded completed debit (INR)'], ['associate_credit_status', 'Associate credit status'], ['associate_credit_amount', 'Associate credit amount (INR)'], ['diagnostics', 'Investigation flags']);
const movementColumns = cols(['id', 'Transaction ID'], ['employer', 'Employer'], ['created_at', 'Recorded transaction date'], ['type', 'Type'], ['source', 'Source'], ['purpose', 'Purpose'], ['amount', 'Amount (INR)'], ['status', 'Status'], ['reference_type', 'Reference type'], ['reference_id', 'Reference ID'], ['job', 'Job'], ['associate', 'Associate'], ['balance_after', 'Recorded balance after (INR)']);
const walletColumns = cols(['id', 'Employer ID'], ['employer', 'Employer'], ['wallet_id', 'Wallet ID'], ['status', 'Wallet status'], ['currency', 'Currency'], ['balance', 'Current balance (INR)'], ['deposit_balance', 'Current deposit balance (INR)'], ['credit_balance', 'Current admin credit (INR)'], ['total_recharged', 'Recorded recharge total (INR)'], ['total_credited', 'Recorded admin credit total (INR)'], ['total_debited', 'Recorded debit total (INR)']);
function result(rows: Row[], summary: Row, total: number, columns: Column[], q: Query, scope: Record<string, string>, basis: string, warnings: ReportWarning[], exporting: boolean) {
  if (exporting) {
    if (warnings.some(w => w.code === 'missing_schema')) throw new HttpError(503, 'Export is unavailable while required financial evidence is missing.');
    const value = (v: unknown): string | number | null => v == null ? null : typeof v === 'number' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
    const exportCols = columns.map(c => ({ header: c.label, value: (r: Row) => {
      const v = value(r[c.key]);
      return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(Date.parse(v) + 330 * 60000).toISOString().replace('Z', '+05:30') : v;
    } }));
    exportCols.push({ header: 'Reporting timezone', value: () => 'Asia/Kolkata' }, { header: 'Date basis', value: () => basis },
      { header: 'From date', value: () => q.date_from ?? null }, { header: 'Through date', value: () => q.date_to ?? null },
      { header: 'Applied scope', value: () => JSON.stringify(scope) }, { header: 'Applied filters', value: () => JSON.stringify(q) },
      { header: 'Full-filter summary', value: () => JSON.stringify(summary) }, { header: 'Report warnings', value: () => warnings.map(w => w.message).join('; ') });
    return { csv: reportCsv(rows, exportCols, total, EXPORT_LIMIT) };
  }
  return { ...reportResponse(rows, summary, total, q, { scope, filters: q, date_basis: basis, warnings }), columns };
}
function paging(total: number, q: Query, exporting: boolean) {
  if (exporting && total > EXPORT_LIMIT) throw new HttpError(422, `Exports support up to ${EXPORT_LIMIT} rows. Narrow the report filters.`);
  return exporting ? { take: EXPORT_LIMIT + 1 } : reportPagination(q);
}
function sums(rows: { amount: unknown; status: string }[]) {
  const groups: Record<string, { count: number; amount: string }> = {};
  for (const row of rows) {
    const group = groups[row.status] ?? { count: 0, amount: '0.00' };
    group.count++; group.amount = dec(group.amount).add(dec(row.amount)).toFixed(2); groups[row.status] = group;
  }
  return groups;
}

/** Reconstruction validates recorded history only; it is not bank reconciliation. */
export function inspectWalletHistory(wallet: Row, entries: Row[], period: { gte?: Date; lt?: Date }) {
  let balance = dec(0), recharge = dec(0), credit = dec(0), debit = dec(0), opening = dec(0), closing = dec(0);
  const unavailable = (reason: string) => ({ history_status: 'unavailable', opening_balance: null, closing_balance: null, reason });
  if (!(wallet.createdAt instanceof Date) || !Number.isFinite(wallet.createdAt.getTime())) return unavailable('Wallet creation history is unavailable.');
  if (['balance', 'depositBalance', 'creditBalance', 'totalRecharged', 'totalCredited', 'totalDebited'].some(key => wallet[key] == null)) return unavailable('Current wallet counters are incomplete.');
  if (entries.some(entry => !(entry.createdAt instanceof Date) || !Number.isFinite((entry.createdAt as Date).getTime()))) return unavailable('Historical transaction dates are incomplete.');
  const ordered = [...entries].sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime() || String(a.id).localeCompare(String(b.id)));
  for (const entry of ordered) {
    if (!(entry.createdAt instanceof Date) || entry.createdAt < wallet.createdAt || entry.balanceAfter == null || entry.status !== 'completed') return unavailable('Historical dates, balances or posting status are incomplete.');
    const amount = dec(entry.amount);
    if (amount.lt(0)) return unavailable('An unsupported negative ledger amount exists.');
    if (entry.transactionType === 'credit' && entry.source === 'mock_gateway_recharge') { balance = balance.add(amount); recharge = recharge.add(amount); }
    else if (entry.transactionType === 'credit' && entry.source === 'admin_credit') { balance = balance.add(amount); credit = credit.add(amount); }
    else if (entry.transactionType === 'debit' && entry.source === 'job_payment') { balance = balance.sub(amount); debit = debit.add(amount); }
    else return unavailable('Legacy or unknown ledger sources need review.');
    if (!balance.eq(dec(entry.balanceAfter))) return unavailable('Recorded ledger balances are discontinuous or their ordering is ambiguous.');
    if (period.gte && entry.createdAt < period.gte) opening = balance;
    if (!period.lt || entry.createdAt < period.lt) closing = balance;
  }
  if (!balance.eq(dec(wallet.balance)) || !recharge.eq(dec(wallet.totalRecharged)) || !credit.eq(dec(wallet.totalCredited)) || !debit.eq(dec(wallet.totalDebited)) || !dec(wallet.depositBalance).add(dec(wallet.creditBalance)).eq(balance)) return unavailable('Recorded history does not reconcile with the current wallet and its counters.');
  return { history_status: 'reconstructed from recorded ledger', opening_balance: opening.toFixed(2), closing_balance: closing.toFixed(2), reason: null };
}

async function walletsReport(db: Db, q: Query, scope: Record<string, string>, exporting: boolean) {
  const where = { role: 'employer', ...(scope.employerUserId ? { id: scope.employerUserId } : {}),
    ...(q.status ? q.status === 'not-created' ? { employerWallet: null } : { employerWallet: { status: q.status } } : {}) };
  const total = await db.user.count({ where });
  const paginate = paging(total, q, exporting);
  const walletWhere = { user: where };
  const aggregate = await db.employerWallet.aggregate({ where: walletWhere, _sum: { balance: true, depositBalance: true, creditBalance: true } });
  const stored = await db.employerWallet.count({ where: walletWhere });
  const page = await db.user.findMany({ where, select: { id: true, fullName: true, employerWallet: { select: { id: true, currency: true, status: true, balance: true, depositBalance: true, creditBalance: true, totalRecharged: true, totalCredited: true, totalDebited: true } } }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], ...paginate });
  const rows = page.map(u => ({ id: u.id, employer: u.fullName, wallet_id: u.employerWallet?.id ?? null, status: u.employerWallet?.status ?? 'not-created', currency: u.employerWallet?.currency ?? null,
    balance: money(u.employerWallet?.balance), deposit_balance: money(u.employerWallet?.depositBalance), credit_balance: money(u.employerWallet?.creditBalance), total_recharged: money(u.employerWallet?.totalRecharged), total_credited: money(u.employerWallet?.totalCredited), total_debited: money(u.employerWallet?.totalDebited) }));
  return result(rows, { employers: total, stored_wallets: stored, wallets_not_created: total - stored, current_balance: money(aggregate._sum.balance) ?? '0.00', current_deposit_balance: money(aggregate._sum.depositBalance) ?? '0.00', current_admin_credit_balance: money(aggregate._sum.creditBalance) ?? '0.00' }, total, walletColumns, q, scope, 'Current stored wallet snapshot', [], exporting);
}

async function movementsReport(db: Db, q: Query, scope: Record<string, string>, role: Role, statement: boolean, exporting: boolean) {
  if (q.date_basis && q.date_basis !== 'recorded') throw new HttpError(422, 'Wallet movements use recorded transaction dates.');
  const range = reportDateRange(q, 'timestamp'), amount = reportAmountRange(q);
  const wallets = await db.employerWallet.findMany({ where: { ...(scope.employerUserId ? { employerUserId: scope.employerUserId } : {}) }, select: { id: true, employerUserId: true, createdAt: true, balance: true, depositBalance: true, creditBalance: true, totalRecharged: true, totalCredited: true, totalDebited: true } });
  const warnings: ReportWarning[] = [];
  const where = { ...(role === 'super_admin' && !scope.employerUserId ? {} : { walletId: { in: wallets.map(w => w.id) } }), ...(Object.keys(range).length ? { createdAt: range } : {}),
    ...(q.status ? { status: q.status } : {}), ...(q.source ? { source: q.source } : {}), ...(q.transaction_type ? { transactionType: q.transaction_type } : {}),
    ...(q.reference_id ? { referenceId: { contains: q.reference_id } } : {}), ...(q.guard_id ? { guardUserId: q.guard_id } : {}), ...(q.job_id ? { jobId: q.job_id } : {}), ...(Object.keys(amount).length ? { amount } : {}) };
  const total = await db.walletTransaction.count({ where }), paginate = paging(total, q, exporting);
  const groups = await db.walletTransaction.groupBy({ by: ['transactionType', 'source', 'status'], where, _count: { _all: true }, _sum: { amount: true } });
  const summary: Row = { movements: total, filtered_movement_breakdown: Object.fromEntries(groups.map(g => [`${g.transactionType} / ${g.source ?? 'unknown'} / ${g.status}`, { count: g._count._all, amount: money(g._sum.amount) ?? '0.00' }])) };
  if (statement) {
    const wallet = wallets[0];
    summary.current_balance = money(wallet?.balance); summary.current_deposit_balance = money(wallet?.depositBalance); summary.current_admin_credit_balance = money(wallet?.creditBalance);
    if (!wallet) { summary.history_status = 'unavailable'; summary.opening_balance = null; summary.closing_balance = null; warnings.push({ code: 'wallet_not_created', section: 'wallet', message: 'No wallet has been created for this Employer. This report does not create one or assume a balance.' }); }
    else {
      const fullWhere = { walletId: wallet.id, status: 'completed' };
      const historyCount = await db.walletTransaction.count({ where: fullWhere });
      const history = historyCount <= HISTORY_LIMIT ? await db.walletTransaction.findMany({ where: fullWhere, select: { id: true, createdAt: true, status: true, transactionType: true, source: true, amount: true, balanceAfter: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }) : null;
      const check = history ? inspectWalletHistory(wallet, history, range) : { history_status: 'unavailable', opening_balance: null, closing_balance: null, reason: 'Historical continuity checks exceed the first-release 10,000-entry limit.' };
      Object.assign(summary, check);
      if (check.reason) warnings.push({ code: 'history_unavailable', section: 'historical_balances', message: `${check.reason} Opening and closing balances are unavailable; current balances and recorded movements remain visible.` });
      const periodGroups = await db.walletTransaction.groupBy({ by: ['transactionType'], where: { ...fullWhere, ...(Object.keys(range).length ? { createdAt: range } : {}) }, _sum: { amount: true } });
      summary.account_period_credits = money(periodGroups.find(g => g.transactionType === 'credit')?._sum.amount) ?? '0.00';
      summary.account_period_debits = money(periodGroups.find(g => g.transactionType === 'debit')?._sum.amount) ?? '0.00';
    }
  }
  const page = await db.walletTransaction.findMany({ where, select: { id: true, walletId: true, createdAt: true, transactionType: true, source: true, purpose: true, amount: true, status: true, referenceType: true, referenceId: true, jobId: true, guardUserId: true, balanceAfter: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...paginate });
  const users = await readInChunks([...wallets.map(w => w.employerUserId), ...page.map(p => p.guardUserId).filter((s): s is string => s != null)], batch => db.user.findMany({ where: { id: { in: batch } }, select: { id: true, fullName: true } }));
  const names = new Map(users.map(u => [u.id, u.fullName]));
  const jobs = await readInChunks(page.map(p => p.jobId).filter((s): s is string => s != null), batch => db.jobPost.findMany({ where: { id: { in: batch } }, select: { id: true, title: true, employerUserId: true } }));
  const rows = page.map(p => { const wallet = wallets.find(w => w.id === p.walletId), job = jobs.find(j => j.id === p.jobId && j.employerUserId === wallet?.employerUserId);
    return { id: p.id, employer: names.get(wallet?.employerUserId ?? '') ?? null, created_at: dateText(p.createdAt), type: p.transactionType, source: p.source, purpose: p.purpose, amount: money(p.amount), status: p.status, reference_type: p.referenceType, reference_id: p.referenceId, job: job?.title ?? null, associate: names.get(p.guardUserId ?? '') ?? null, balance_after: money(p.balanceAfter) }; });
  if (groups.some(g => g.source === 'mock_gateway_recharge')) warnings.push({ code: 'mock_recharge', section: 'movements', message: 'Mock gateway recharge is a recorded wallet entry, not verified bank collection.' });
  if (page.some(p => !wallets.some(w => w.id === p.walletId))) warnings.push({ code: 'orphan_wallet_reference', section: 'movements', message: 'Some movements reference a missing wallet. They are retained in this platform view with an unknown Employer; they are not attributed to an Employer account.' });
  return result(rows, summary, total, role === 'employer' ? movementColumns.filter(c => c.key !== 'employer') : movementColumns, q, scope, 'wallet_transactions.created_at', warnings, exporting);
}

export function resolvePaymentLink(payment: Row, references: { attendance?: Row; application?: Row; jobs: Map<string, Row> }) {
  const ids = [payment.jobId, references.attendance?.jobId, references.application?.jobId].filter((v): v is string => typeof v === 'string');
  const missing = (!!payment.attendanceId && !references.attendance) || (!!payment.applicationId && !references.application) || ids.some(id => !references.jobs.has(id));
  const conflict = new Set(ids).size > 1 || [references.attendance, references.application].some(ref => ref && ((ref.employerUserId != null && ref.employerUserId !== payment.employerUserId) || (ref.guardUserId != null && payment.guardUserId != null && ref.guardUserId !== payment.guardUserId))) || ids.some(id => references.jobs.get(id)?.employerUserId !== payment.employerUserId);
  const job = !conflict && !missing && ids.length ? references.jobs.get(ids[0]) : undefined;
  const linkage = conflict ? 'conflicting' : missing ? 'missing-reference' : payment.attendanceId ? 'attendance-linked' : payment.applicationId ? 'application-only' : job ? 'job-only' : 'unlinked';
  return { job, linkage };
}

async function paymentsReport(db: Db, q: Query, scope: Record<string, string>, role: Role, exporting: boolean) {
  const basis = q.date_basis ?? 'created';
  if (!['created', 'recorded-payment'].includes(basis)) throw new HttpError(422, 'Use payment creation date or recorded payment date. Completion date is unavailable.');
  const range = reportDateRange(q, 'timestamp'), amount = reportAmountRange(q), warnings: ReportWarning[] = [];
  const where = { ...(scope.employerUserId ? { employerUserId: scope.employerUserId } : {}), ...(Object.keys(range).length ? { [basis === 'created' ? 'createdAt' : 'paymentDate']: range } : {}), ...(q.status ? { paymentStatus: q.status } : {}), ...(q.guard_id ? { guardUserId: q.guard_id } : {}), ...(q.payment_method ? { paymentMethod: q.payment_method } : {}), ...(q.reference_id ? { id: { contains: q.reference_id } } : {}), ...(Object.keys(amount).length ? { amount } : {}) };
  const payments = await db.payment.findMany({ where, select: { id: true, employerUserId: true, guardUserId: true, jobId: true, applicationId: true, attendanceId: true, amount: true, paymentMethod: true, paymentStatus: true, paymentDate: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const ids = payments.map(p => p.id), attendanceIds = payments.map(p => p.attendanceId).filter((v): v is string => v != null), applicationIds = payments.map(p => p.applicationId).filter((v): v is string => v != null);
  const attendance = await readInChunks(attendanceIds, batch => db.attendanceRecord.findMany({ where: { id: { in: batch } }, select: { id: true, jobId: true, employerUserId: true, guardUserId: true } }));
  const applications = await readInChunks(applicationIds, batch => db.jobApplication.findMany({ where: { id: { in: batch } }, select: { id: true, jobId: true, employerUserId: true, guardUserId: true } }));
  const jobIds = [...new Set([...payments.map(p => p.jobId), ...attendance.map(a => a.jobId), ...applications.map(a => a.jobId)].filter((v): v is string => v != null))];
  const jobs = await readInChunks(jobIds, batch => db.jobPost.findMany({ where: { id: { in: batch } }, select: { id: true, employerUserId: true, companyId: true, siteId: true, title: true, company: { select: { companyName: true } }, site: { select: { siteName: true, companyId: true, employerUserId: true } } } }));
  const jobMap = new Map<string, Row>(jobs.map(j => [j.id, j]));
  const classified = payments.map(p => ({ payment: p, ...resolvePaymentLink(p, { attendance: attendance.find(a => a.id === p.attendanceId), application: applications.find(a => a.id === p.applicationId), jobs: jobMap }) }));
  const excluded = classified.filter(p => !p.job).length;
  let matching = classified.filter(p => (!scope.companyId || p.job?.companyId === scope.companyId) && (!scope.siteId || p.job?.siteId === scope.siteId) && (!scope.jobId || p.job?.id === scope.jobId) && (!q.linkage || p.linkage === q.linkage));
  if (exporting && !q.link_condition && matching.length > EXPORT_LIMIT) throw new HttpError(422, `Exports support up to ${EXPORT_LIMIT} rows. Narrow the report filters.`);
  if ((scope.companyId || scope.siteId || scope.jobId) && excluded) warnings.push({ code: 'unattributed_payments', section: 'company_scope', message: `${excluded} payments cannot be safely attributed to this company/site/job. Use the account or platform view to inspect unlinked, missing or conflicting references.` });
  const ownerIds = [...new Set(payments.map(p => p.employerUserId).filter((v): v is string => v != null))];
  const associateIds = payments.map(p => p.guardUserId).filter((v): v is string => v != null);
  let wallets: { id: string; employerUserId: string }[] = [], associateWallets: { id: string; guardUserId: string }[] = [];
  type EvidenceEntry = { id: string; walletId: string; referenceId: string | null; amount: Prisma.Decimal; status: string };
  let debits: EvidenceEntry[] = [], credits: EvidenceEntry[] = [];
  try {
    wallets = await readInChunks(ownerIds, batch => db.employerWallet.findMany({ where: { employerUserId: { in: batch } }, select: { id: true, employerUserId: true } }));
    associateWallets = await readInChunks(associateIds, batch => db.associateWallet.findMany({ where: { guardUserId: { in: batch } }, select: { id: true, guardUserId: true } }));
    if (ids.length) {
      const evidenceSelect = { id: true, walletId: true, referenceId: true, amount: true, status: true } as const;
      debits = await readInChunks(ids, batch => db.walletTransaction.findMany({ where: { referenceType: 'payment', referenceId: { in: batch }, transactionType: 'debit' }, select: evidenceSelect }));
      credits = await readInChunks(ids, batch => db.associateWalletTransaction.findMany({ where: { referenceType: 'payment', referenceId: { in: batch }, transactionType: 'credit' }, select: evidenceSelect }));
    }
  } catch (error) { if (!missingSchema(error)) throw error; warnings.push({ code: 'missing_schema', section: 'ledger_evidence', message: 'Some settlement ledger evidence is unavailable because a required database update is missing.' }); }
  const names = new Map((await readInChunks([...ownerIds, ...associateIds], batch => db.user.findMany({ where: { id: { in: batch } }, select: { id: true, fullName: true } }))).map(u => [u.id, u.fullName]));
  const evidence = new Map<string, { row: Row; flags: string[] }>();
  for (const item of matching) {
    const p = item.payment, ownerWallet = wallets.find(w => w.employerUserId === p.employerUserId), associateWallet = associateWallets.find(w => w.guardUserId === p.guardUserId);
    const ds = debits.filter(d => d.referenceId === p.id && d.walletId === ownerWallet?.id), cs = credits.filter(c => c.referenceId === p.id && c.walletId === associateWallet?.id);
    const flags: string[] = [], expected = ['processing', 'completed'].includes(p.paymentStatus);
    if (expected && !warnings.some(w => w.code === 'missing_schema')) {
      if (!ds.some(d => d.status === 'completed')) flags.push('missing-debit');
      if (!cs.length) flags.push('missing-credit');
      if (ds.some(d => !d.amount.eq(p.amount)) || cs.some(c => !c.amount.eq(p.amount))) flags.push('amount-mismatch');
      if (ds.length > 1 || cs.length > 1) flags.push('multiple-entries');
      if (p.paymentStatus === 'completed' && cs.some(c => c.status !== 'completed')) flags.push('status-mismatch');
    }
    if (!item.job) flags.push('unlinked');
    const site = object(item.job?.site);
    const siteName = site.companyId === item.job?.companyId && (site.employerUserId == null || site.employerUserId === p.employerUserId) ? site.siteName : null;
    evidence.set(p.id, { flags, row: { id: p.id, employer: names.get(p.employerUserId ?? '') ?? null, associate: names.get(p.guardUserId ?? '') ?? null, company: object(item.job?.company).companyName ?? null, job: item.job?.title ?? null, site: siteName ?? null, linkage: item.linkage, attendance_id: p.attendanceId, application_id: p.applicationId, amount: money(p.amount), method: p.paymentMethod, status: p.paymentStatus, created_at: dateText(p.createdAt), payment_date: dateText(p.paymentDate), debit_references: ds.map(d => d.id).join('; ') || null, debit_amount: ds.length ? ds.filter(d => d.status === 'completed').reduce((sum, d) => sum.add(d.amount), dec(0)).toFixed(2) : null, associate_credit_status: cs.length ? cs.map(c => c.status).join('; ') : warnings.some(w => w.code === 'missing_schema') ? 'unavailable' : null, associate_credit_amount: cs.length ? cs.reduce((sum, c) => sum.add(c.amount), dec(0)).toFixed(2) : null, diagnostics: warnings.some(w => w.code === 'missing_schema') ? 'Ledger evidence unavailable' : flags.join('; ') || 'No mismatch detected in recorded evidence' } });
  }
  if (q.link_condition) {
    if (warnings.some(w => w.code === 'missing_schema')) throw new HttpError(503, 'Ledger-condition filters are unavailable while required evidence is missing.');
    matching = matching.filter(p => evidence.get(p.payment.id)!.flags.includes(q.link_condition!));
  }
  const total = matching.length, pagination = paging(total, q, exporting);
  const summary: Row = { payments: total, recorded_payment_statuses: sums(matching.map(p => ({ amount: p.payment.amount, status: p.payment.paymentStatus }))), linkage_breakdown: sums(matching.map(p => ({ amount: p.payment.amount, status: p.linkage }))) };
  if (scope.companyId || scope.siteId || scope.jobId) summary.unattributed_account_payments = excluded;
  const flags: Record<string, number> = {};
  for (const p of matching) for (const flag of evidence.get(p.payment.id)!.flags) flags[flag] = (flags[flag] ?? 0) + 1;
  summary.investigation_flags = warnings.some(w => w.code === 'missing_schema') ? 'Unavailable' : flags;
  const start = 'skip' in pagination ? pagination.skip : 0;
  const rows = matching.slice(start, start + pagination.take).map(p => evidence.get(p.payment.id)!.row);
  return result(rows, summary, total, role === 'employer' ? paymentColumns.filter(c => c.key !== 'employer') : paymentColumns, q, scope, basis === 'created' ? 'payments.created_at' : 'payments.payment_date (not completion date)', warnings, exporting);
}

export async function financialReport(db: Db, actor: ReportActor | undefined, role: Role, kind: FinancialKind, raw: unknown, exporting = false) {
  assertReportRole(actor, role);
  const available: readonly string[] = role === 'employer' ? EMPLOYER_FINANCIAL_KINDS : ADMIN_FINANCIAL_KINDS;
  if (!available.includes(kind)) throw new HttpError(403, 'This report is not available to your role.');
  const q = querySchema.parse(raw), payments = kind === 'payments' || kind === 'settlements';
  const movementFilters = ['date_from', 'date_to', 'date_basis', 'guard_id', 'job_id', 'status', 'source', 'transaction_type', 'reference_id', 'min_amount', 'max_amount'];
  validateFilters(raw, kind === 'wallets' ? ['status'] : payments ? ['company_id', 'site_id', 'job_id', 'date_from', 'date_to', 'date_basis', 'guard_id', 'status', 'payment_method', 'linkage', 'link_condition', 'reference_id', 'min_amount', 'max_amount'] : movementFilters);
  const scope = payments ? await resolveReportScope(db, actor, role, q) : await resolveReportScope(db, actor, role, { employer_id: q.employer_id }, 'wallet');
  if (!payments && q.job_id) await resolveReportScope(db, actor, role, { employer_id: q.employer_id, job_id: q.job_id });
  try {
    if (kind === 'wallets') return walletsReport(db, q, scope, exporting);
    if (payments) return paymentsReport(db, q, scope, role, exporting);
    return movementsReport(db, q, scope, role, kind === 'wallet-statement', exporting);
  } catch (error) { if (missingSchema(error)) throw new HttpError(503, 'This report is unavailable because a required financial table or column is missing.'); throw error; }
}

export async function financialReportOptions(db: Db, actor: ReportActor | undefined, role: Role, raw: unknown) {
  const q = reportQuerySchema.pick({ employer_id: true, company_id: true }).strict().parse(raw);
  const scope = await resolveReportScope(db, actor, role, q);
  const ownerWhere = scope.employerUserId ? { employerUserId: scope.employerUserId } : {};
  const companies = await db.employerCompany.findMany({ where: ownerWhere, select: { id: true, companyName: true }, orderBy: [{ companyName: 'asc' }, { id: 'asc' }] });
  const jobs = await db.jobPost.findMany({ where: { ...ownerWhere, ...(scope.companyId ? { companyId: scope.companyId } : {}) }, select: { id: true, title: true, siteId: true }, orderBy: [{ title: 'asc' }, { id: 'asc' }] });
  const sites = await db.companySite.findMany({ where: { companyId: { in: scope.companyId ? [scope.companyId] : companies.map(c => c.id) } }, select: { id: true, siteName: true } });
  const people = await db.payment.groupBy({ by: ['guardUserId'], where: ownerWhere });
  const associates = await db.user.findMany({ where: { role: 'guard', id: { in: people.map(p => p.guardUserId).filter((v): v is string => v != null) } }, select: { id: true, fullName: true } });
  const employers = role === 'super_admin' ? await db.user.findMany({ where: { role: 'employer' }, select: { id: true, fullName: true } }) : [];
  return { companies: companies.map(c => ({ id: c.id, label: c.companyName })), jobs: jobs.map(j => ({ id: j.id, label: j.title, siteId: j.siteId })), sites: sites.map(s => ({ id: s.id, label: s.siteName })), associates: associates.map(a => ({ id: a.id, label: a.fullName })), employers: employers.map(e => ({ id: e.id, label: e.fullName })) };
}
