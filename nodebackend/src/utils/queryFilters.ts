export type QueryValue = unknown;
export type QueryInput = Record<string, QueryValue>;

export function dayStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function nextDay(value: string): Date | null {
  const date = dayStart(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function queryString(query: QueryInput, key: string): string | null {
  const value = query[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function queryNumber(query: QueryInput, key: string): number | null {
  const value = queryString(query, key);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildAdminAttendanceWhere(query: QueryInput) {
  const dateFrom = queryString(query, 'date_from');
  const dateTo = queryString(query, 'date_to');
  const from = dateFrom ? dayStart(dateFrom) : null;
  const to = dateTo ? nextDay(dateTo) : null;
  return {
    ...(queryString(query, 'employer_id') ? { employerUserId: queryString(query, 'employer_id')! } : {}),
    ...(queryString(query, 'company_id') ? { companyId: queryString(query, 'company_id')! } : {}),
    ...(queryString(query, 'site_id') ? { siteId: queryString(query, 'site_id')! } : {}),
    ...(queryString(query, 'guard_id') ? { guardUserId: queryString(query, 'guard_id')! } : {}),
    ...(queryString(query, 'job_id') ? { jobId: queryString(query, 'job_id')! } : {}),
    ...(queryString(query, 'status') ? { status: queryString(query, 'status')! } : {}),
    ...((from || to) ? { attendanceDate: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };
}

export function buildWalletTransactionWhere(query: QueryInput, forcedEmployerUserId?: string) {
  const dateFrom = queryString(query, 'date_from');
  const dateTo = queryString(query, 'date_to');
  const from = dateFrom ? dayStart(dateFrom) : null;
  const to = dateTo ? nextDay(dateTo) : null;
  const minAmount = queryNumber(query, 'min_amount');
  const maxAmount = queryNumber(query, 'max_amount');
  return {
    ...(forcedEmployerUserId ? { employerUserId: forcedEmployerUserId } : {}),
    ...(!forcedEmployerUserId && queryString(query, 'employer_id') ? { employerUserId: queryString(query, 'employer_id')! } : {}),
    ...(queryString(query, 'guard_id') ? { guardUserId: queryString(query, 'guard_id')! } : {}),
    ...(queryString(query, 'transaction_type') ? { transactionType: queryString(query, 'transaction_type')! } : {}),
    ...(queryString(query, 'source') ? { source: queryString(query, 'source')! } : {}),
    ...(queryString(query, 'status') ? { status: queryString(query, 'status')! } : {}),
    ...(queryString(query, 'reference_id') ? { referenceId: { contains: queryString(query, 'reference_id')! } } : {}),
    ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...((minAmount !== null || maxAmount !== null) ? { amount: { ...(minAmount !== null ? { gte: minAmount } : {}), ...(maxAmount !== null ? { lte: maxAmount } : {}) } } : {}),
  };
}
