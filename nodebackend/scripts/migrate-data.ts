/**
 * One-off data migration: live MySQL `granvia` -> SQL Server `granviadb`.
 *
 *   npx tsx scripts/migrate-data.ts
 *
 * Reads MySQL connection from MYSQL_* env vars and the SQL Server target from
 * DATABASE_URL (same as the app). Copies domain tables in FK-dependency order,
 * clearing the target first so the run is idempotent. Ephemeral tables
 * (sessions, cache, queue jobs, personal_access_tokens, migrations) are skipped.
 *
 * Column handling: only columns present in BOTH the MySQL row and the SQL Server
 * table are copied (tolerates drift); JSON/array values are stringified into the
 * NVARCHAR(MAX) columns.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import sql from 'mssql';

// Parents first — children reference these via FK.
const TABLE_ORDER = [
  'users',
  'guard_profiles',
  'employer_profiles',
  'sub_admin_profiles',
  'employer_companies',
  'company_sites',
  'company_documents',
  'employer_aadhaar_verifications',
  'guard_aadhaar_verifications',
  'guard_documents',
  'job_posts',
  'job_applications',
  'application_status_logs',
  'interview_requests',
  'job_offers',
  'agreements',
  'attendance_records',
  'employer_wallets',
  'wallet_transactions',
  'payments',
  'invoices',
  'notifications',
  'support_tickets',
  'support_ticket_messages',
  'staff_members',
  'discounts',
];

function parseMssqlUrl(url: string): sql.config {
  const body = url.replace(/^sqlserver:\/\//, '');
  const [serverPart, ...kvParts] = body.split(';');
  const [server, portStr] = serverPart.split(':');
  const kv: Record<string, string> = {};
  for (const part of kvParts.filter(Boolean)) {
    const i = part.indexOf('=');
    kv[part.slice(0, i).toLowerCase()] = part.slice(i + 1);
  }
  return {
    server,
    port: Number(portStr || 1433),
    database: kv['database'],
    user: kv['user'],
    password: kv['password'],
    options: {
      encrypt: (kv['encrypt'] ?? 'true') !== 'false',
      trustServerCertificate: (kv['trustservercertificate'] ?? 'true') !== 'false',
    },
    requestTimeout: 60000,
  };
}

function normalize(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value); // JSON/array column -> stored as text
  }
  return value;
}

async function main() {
  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE ?? 'granvia',
    dateStrings: false,
  });
  const pool = await sql.connect(parseMssqlUrl(process.env.DATABASE_URL!));

  // Which tables actually exist in the MySQL source?
  const [tableRows] = (await mysqlConn.query('SHOW TABLES')) as [Record<string, string>[], unknown];
  const sourceTables = new Set(tableRows.map((r) => String(Object.values(r)[0])));

  console.log('Clearing target tables...');
  for (const t of [...TABLE_ORDER].reverse()) {
    await pool.request().query(`IF OBJECT_ID('dbo.${t}','U') IS NOT NULL DELETE FROM [${t}]`);
  }

  console.log('Copying data (MySQL -> SQL Server):');
  let grandTotal = 0;
  for (const t of TABLE_ORDER) {
    if (!sourceTables.has(t)) {
      console.log(`  ${t}: (not in source, skipped)`);
      continue;
    }

    const colRes = await pool
      .request()
      .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}'`);
    const targetCols = new Set(colRes.recordset.map((r) => r.COLUMN_NAME as string));

    const [rows] = (await mysqlConn.query(`SELECT * FROM \`${t}\``)) as [Record<string, unknown>[], unknown];
    let inserted = 0;
    for (const row of rows) {
      const cols = Object.keys(row).filter((c) => targetCols.has(c));
      if (!cols.length) continue;
      const req = pool.request();
      cols.forEach((c, i) => req.input(`p${i}`, normalize(row[c])));
      const colList = cols.map((c) => `[${c}]`).join(',');
      const valList = cols.map((_, i) => `@p${i}`).join(',');
      await req.query(`INSERT INTO [${t}] (${colList}) VALUES (${valList})`);
      inserted++;
    }
    grandTotal += inserted;
    console.log(`  ${t}: ${inserted}`);
  }

  console.log(`Done. ${grandTotal} rows migrated.`);
  await mysqlConn.end();
  await pool.close();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
