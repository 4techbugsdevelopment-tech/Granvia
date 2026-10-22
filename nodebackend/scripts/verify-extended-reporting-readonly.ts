import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { calendarDate } from '../src/reporting/query';
import { EXTENDED_REPORTS, extendedReport, extendedReportOptions, type ReportingRole } from '../src/reporting/extendedReports';

// Read-only: no seed, migration, wallet creation/synchronisation or business writes.
const artifact = path.resolve(__dirname, '../api-smoke-artifacts/EXTENDED_REPORTING_RUNTIME_VERIFICATION.json');
type Check = { role: string; report: string; status: string; records?: number; warnings?: string[]; error_code?: string };
const checks: Check[] = [];
let status = 'running', clientDate = '';
function save() {
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify({ client_date: clientDate, status, verification: 'Read-only configured-database service queries; not browser, deployed API or release acceptance', checks }, null, 2) + '\n');
}
function code(error: unknown) {
  const value = (error as { code?: unknown })?.code;
  return typeof value === 'string' && /^P\d{4}$/.test(value) ? value : 'CONNECTION_OR_QUERY_FAILURE';
}
async function main() {
  clientDate = calendarDate.parse(process.argv[2]);
  const timeout = setTimeout(() => { status = 'incomplete_timeout'; save(); process.stdout.write('Extended report checks timed out; partial evidence saved.\n'); process.exit(2); }, 55000);
  let db: PrismaClient | undefined;
  try {
    const { env } = await import('../src/config/env');
    db = new PrismaClient({ adapter: new PrismaMssql(env.databaseUrl), log: [] });
    const database = db;
    for (const role of Object.keys(EXTENDED_REPORTS) as ReportingRole[]) {
      const actor = await database.user.findFirst({ where: { role, accountStatus: 'active' }, select: { id: true, role: true, accountStatus: true } });
      if (!actor) { checks.push({ role, report: 'actor', status: 'unverified_no_active_account' }); continue; }
      for (const report of EXTENDED_REPORTS[role]) {
        try {
          const result = await database.$transaction(async tx => {
            const query = report.kind === 'associate-wallets' ? { page_size: '1' } : { date_from: clientDate.slice(0, 7) + '-01', date_to: clientDate, page_size: '1' };
            await extendedReportOptions(tx, actor, role, { kind: report.kind });
            return extendedReport(tx, actor, role, report.kind, query);
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
          if ('items' in result) checks.push({ role, report: report.kind, status: 'query_passed', records: result.pagination.total, warnings: result.meta.warnings.map(w => w.code) });
        } catch (error) { checks.push({ role, report: report.kind, status: 'query_failed', error_code: code(error) }); }
        save();
      }
    }
    status = checks.some(check => check.status !== 'query_passed') ? 'incomplete' : 'queries_verified';
    if (status !== 'queries_verified') process.exitCode = 2;
  } catch (error) { status = 'blocked_connection_or_query'; checks.push({ role: 'database', report: 'connection', status: 'unverified', error_code: code(error) }); process.exitCode = 2; }
  finally {
    save(); process.stdout.write(`Extended reporting verification: ${status}. Redacted artifact saved.\n`);
    try { await db?.$disconnect(); } finally { clearTimeout(timeout); }
  }
}
main().catch(() => { status = 'blocked_initialisation'; save(); process.stdout.write('Extended report verifier could not initialise.\n'); process.exitCode = 2; });
