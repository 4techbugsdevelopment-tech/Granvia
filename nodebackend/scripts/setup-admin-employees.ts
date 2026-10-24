import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { env } from '../src/config/env';

// Checks by default. --apply runs only the additive two-table feature migration,
// never unrelated pending migrations, data seeds, resets or db push.
const db = new PrismaClient({ adapter: new PrismaMssql(env.databaseUrl), log: [] });
const applying = process.argv.includes('--apply');
const timeout = setTimeout(() => { console.error('Employee schema setup timed out. Check database state before retrying.'); process.exit(2); }, 30000);
const required: Record<string, string[]> = {
  admin_employee_roles: ['id', 'owner_user_id', 'name', 'description', 'permissions', 'status', 'created_at', 'updated_at'],
  admin_employees: ['id', 'user_id', 'owner_user_id', 'role_id', 'created_at'],
};
async function check() {
  const columns = await db.$queryRaw<{ table_name: string; column_name: string }[]>`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME IN ('admin_employee_roles', 'admin_employees')`;
  return Object.fromEntries(Object.entries(required).map(([table, fields]) => [table, fields.filter(field => !columns.some(column => column.table_name === table && column.column_name === field))]));
}
async function main() {
  if (typeof db.adminEmployeeRole?.findMany !== 'function' || typeof db.adminEmployee?.findMany !== 'function') throw new Error('Generated Prisma Client is stale. Run npm run build before this command.');
  let missing = await check();
  console.log(JSON.stringify({ mode: applying ? 'apply_feature_migration' : 'read_only', missing_columns: missing }));
  if (applying && Object.values(missing).some(fields => fields.length > 0)) {
    // Refuse to mask a partial/incompatible schema with a successful no-op.
    for (const [table, fields] of Object.entries(missing)) if (fields.length && fields.length !== required[table].length) throw new Error(`Partial ${table} schema detected. Review it before applying this migration.`);
    const userId = await db.$queryRaw<{ data_type: string; max_length: number }[]>`SELECT DATA_TYPE AS data_type, CHARACTER_MAXIMUM_LENGTH AS max_length FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='users' AND COLUMN_NAME='id'`;
    if (userId[0]?.data_type !== 'nvarchar' || userId[0]?.max_length !== 36) throw new Error('The users.id schema does not match the expected SQL Server target. No migration applied.');
    const sql = readFileSync(path.resolve(__dirname, '../prisma/migrations/20261023120000_super_admin_employees/migration.sql'), 'utf8');
    await db.$executeRawUnsafe(sql);
    missing = await check();
  }
  if (Object.values(missing).some(fields => fields.length)) {
    process.exitCode = 2;
    console.error('Employee schema is incomplete. Run this command with --apply on the intended database to install only this feature.');
    return;
  }
  // Exercise both delegates and the relation used by the real list APIs.
  await db.adminEmployeeRole.findMany({ take: 1, select: { id: true } });
  await db.adminEmployee.findMany({ take: 1, select: { id: true, role: { select: { id: true } }, user: { select: { id: true } } } });
  console.log(JSON.stringify({ schema: 'ready', role_query: 'passed', employee_relation_query: 'passed', migration_ledger: 'unchanged' }));
}
main().catch(error => {
  // Avoid printing connection strings, credentials or user records.
  console.error(JSON.stringify({ status: 'failed', code: error?.code ?? 'SETUP_ERROR', message: error instanceof Error && !error?.code ? error.message : 'Database schema setup or verification failed.' }));
  process.exitCode = 2;
}).finally(async () => { clearTimeout(timeout); await db.$disconnect(); });
