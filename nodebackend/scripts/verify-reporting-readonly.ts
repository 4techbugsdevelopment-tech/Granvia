import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { calendarDate } from '../src/reporting/query';
import { adminReport, ADMIN_REPORT_KINDS } from '../src/reporting/adminReports';
import { employerReport, REPORT_KINDS } from '../src/reporting/employerReports';
import { financialReport, EMPLOYER_FINANCIAL_KINDS, ADMIN_FINANCIAL_KINDS } from '../src/reporting/financialReports';

// No migration, checkout, wallet creation, settlement, or other write method is invoked.
const artifact = path.resolve(__dirname, '../api-smoke-artifacts/REPORTING_RUNTIME_VERIFICATION.json');
type Check = { name: string; status: string; records?: number; warnings?: string[]; error_code?: string };
const checks: Check[] = [];
let status = 'running', clientDate = '';
function save() {
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify({ client_date: clientDate, status, verification: 'Read-only schema and report service checks; not browser, bearer-token API or deployment acceptance', checks }, null, 2) + '\n');
}
function code(error: unknown) {
  const value = (error as { code?: unknown })?.code;
  return typeof value === 'string' && /^P\d{4}$/.test(value) ? value : 'CONNECTION_OR_QUERY_FAILURE';
}
async function main() {
  clientDate = calendarDate.parse(process.argv[2]);
  const timeout = setTimeout(() => { status = 'blocked_timeout'; checks.push({ name: 'configured_database', status: 'unverified_timeout' }); save(); process.stdout.write('Read-only reporting verification timed out; no runtime success claimed.\n'); process.exit(2); }, 25000);
  let db: PrismaClient | undefined;
  try {
    const { env } = await import('../src/config/env');
    // Use the same configured connection while suppressing automatic query-error dumps.
    db = new PrismaClient({ adapter: new PrismaMssql(env.databaseUrl), log: [] });
    const columns = await db.$queryRaw<{ table_name: string; column_name: string }[]>`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo'`;
    const required: Record<string, string[]> = {
      users: ['id', 'role', 'account_status', 'created_at'], employer_profiles: ['user_id', 'verification_status'], guard_profiles: ['user_id', 'verification_status'],
      employer_companies: ['id', 'employer_user_id'], company_sites: ['id', 'company_id'], job_posts: ['id', 'guards_required'], job_applications: ['job_id', 'status'],
      company_documents: ['company_id', 'verification_status'], guard_documents: ['guard_user_id', 'reviewed_at'],
      attendance_records: ['attendance_date', 'total_hours'], attendance_exception_requests: ['decided_at'], attendance_audit_events: ['event_at'],
      associate_partner_agreements: ['current_key'], employer_wallets: ['deposit_balance', 'credit_balance', 'total_recharged'],
      wallet_transactions: ['source', 'reference_type', 'balance_after'], payments: ['attendance_id', 'application_id', 'payment_date'],
      associate_wallets: ['guard_user_id'], associate_wallet_transactions: ['reference_id', 'status'],
    };
    for (const [table, fields] of Object.entries(required)) {
      const found = new Set(columns.filter(c => c.table_name === table).map(c => c.column_name));
      const missing = fields.filter(f => !found.has(f));
      checks.push({ name: `schema:${table}`, status: missing.length ? 'missing_fields' : 'present', warnings: missing });
    }
    if (checks.some(c => c.status === 'missing_fields')) { status = 'blocked_schema'; process.exitCode = 2; return; }
    const database = db;
    const admin = await database.user.findFirst({ where: { role: 'super_admin', accountStatus: 'active' }, select: { id: true, role: true, accountStatus: true } });
    const employer = await database.user.findFirst({ where: { role: 'employer', accountStatus: 'active' }, select: { id: true, role: true, accountStatus: true } });
    const range = { date_from: clientDate.slice(0, 7) + '-01', date_to: clientDate, page_size: '1' };
    async function check(name: string, run: () => Promise<unknown>) {
      try {
        const result = await run() as { pagination?: { total: number }; meta?: { warnings: { code: string }[] } };
        checks.push({ name, status: result.meta?.warnings.length ? 'query_passed_with_warnings' : 'query_passed', records: result.pagination?.total, warnings: result.meta?.warnings.map(w => w.code) });
      } catch (error) { checks.push({ name, status: 'query_failed', error_code: code(error) }); }
    }
    const transaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => database.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    if (admin) {
      for (const kind of ADMIN_REPORT_KINDS) await check(`admin:${kind}`, () => transaction(tx => adminReport(tx, admin, kind, range)));
      for (const kind of ADMIN_FINANCIAL_KINDS) await check(`admin:${kind}`, () => transaction(tx => financialReport(tx, admin, 'super_admin', kind, kind === 'wallets' ? { page_size: '1' } : range)));
    } else checks.push({ name: 'admin_actor', status: 'unverified_no_active_account' });
    if (employer) {
      const company = await database.employerCompany.findFirst({ where: { employerUserId: employer.id }, select: { id: true } });
      if (company) for (const kind of REPORT_KINDS) await check(`employer:${kind}`, () => transaction(tx => employerReport(tx, employer, kind, { ...range, company_id: company.id })));
      else checks.push({ name: 'employer_company', status: 'unverified_no_company' });
      for (const kind of EMPLOYER_FINANCIAL_KINDS) await check(`employer:${kind}`, () => transaction(tx => financialReport(tx, employer, 'employer', kind, range)));
    } else checks.push({ name: 'employer_actor', status: 'unverified_no_active_account' });
    status = checks.some(c => c.status.startsWith('unverified') || c.status === 'query_failed') ? 'incomplete' : 'queries_verified';
    if (status !== 'queries_verified') process.exitCode = 2;
  } catch (error) { status = 'blocked_connection_or_query'; checks.push({ name: 'configured_database', status: 'unverified', error_code: code(error) }); process.exitCode = 2; }
  finally {
    save(); process.stdout.write(`Read-only reporting verification: ${status}. Redacted artifact saved.\n`);
    try { await db?.$disconnect(); } finally { clearTimeout(timeout); }
  }
}
main().catch(() => { status = 'blocked_initialisation'; save(); process.stdout.write('Read-only reporting verification could not initialise.\n'); process.exitCode = 2; });
