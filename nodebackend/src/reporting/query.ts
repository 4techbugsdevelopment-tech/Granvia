import { z } from 'zod';

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');

const integerParameter = (fallback: number, max: number) => z.string()
  .regex(/^[1-9]\d*$/, 'Enter a positive integer.')
  .transform(Number).pipe(z.number().int().min(1).max(max)).default(String(fallback));

/** Extend with each report's supported filters; strict parsing rejects unknown filters. */
export const reportQuerySchema = z.object({
  employer_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  site_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  date_from: calendarDate.optional(),
  date_to: calendarDate.optional(),
  page: integerParameter(1, 1_000_000),
  page_size: integerParameter(50, 100),
}).strict();

export function validateDateOrder(query: { date_from?: string; date_to?: string }) {
  if (query.date_from && query.date_to && query.date_from > query.date_to) {
    throw new z.ZodError([{ code: 'custom', path: ['date_to'], message: 'End date must be on or after start date.' }]);
  }
}

/** SQL Date uses calendar values; timestamps use midnight IST converted to UTC. */
export function reportDateRange(query: { date_from?: string; date_to?: string }, kind: 'calendar' | 'timestamp') {
  const from = query.date_from ? calendarDate.parse(query.date_from) : undefined;
  const to = query.date_to ? calendarDate.parse(query.date_to) : undefined;
  validateDateOrder({ date_from: from, date_to: to });
  const offset = kind === 'timestamp' ? IST_OFFSET_MS : 0;
  const boundary = (value: string) => Date.parse(`${value}T00:00:00.000Z`) - offset;
  return {
    ...(from ? { gte: new Date(boundary(from)) } : {}),
    ...(to ? { lt: new Date(boundary(to) + DAY_MS) } : {}),
  };
}

export function reportPagination(query: { page: number; page_size: number }) {
  const page = z.number().int().min(1).max(1_000_000).parse(query.page);
  const pageSize = z.number().int().min(1).max(100).parse(query.page_size);
  return { skip: (page - 1) * pageSize, take: pageSize };
}

// SQL Decimal(12,2) filter values remain strings to preserve monetary precision.
export const reportAmount = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Enter a non-negative amount with at most two decimal places.');

export function reportAmountRange(query: { min_amount?: string; max_amount?: string }) {
  const min = query.min_amount === undefined ? undefined : reportAmount.parse(query.min_amount);
  const max = query.max_amount === undefined ? undefined : reportAmount.parse(query.max_amount);
  const cents = (value: string) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  };
  if (min !== undefined && max !== undefined && cents(min) > cents(max)) {
    throw new z.ZodError([{ code: 'custom', path: ['max_amount'], message: 'Maximum amount must be at least the minimum amount.' }]);
  }
  return { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) };
}

/** Report-specific callers provide an allowlist; ID always breaks ordering ties. */
export function reportOrderBy(field: string, direction: 'asc' | 'desc', allowed: readonly string[]) {
  if (!allowed.includes(field) || !['asc', 'desc'].includes(direction)) {
    throw new z.ZodError([{ code: 'custom', path: ['sort'], message: 'Unsupported report ordering.' }]);
  }
  return field === 'id' ? [{ id: direction }] : [{ [field]: direction }, { id: direction }];
}

/** Bound related-record queries and deduplicate IDs before generating SQL IN predicates. */
export async function readInChunks<T>(ids: readonly string[], read: (batch: string[]) => Promise<T[]>, size = 500): Promise<T[]> {
  z.number().int().min(1).max(500).parse(size);
  const unique = [...new Set(ids)], rows: T[] = [];
  for (let start = 0; start < unique.length; start += size) rows.push(...await read(unique.slice(start, start + size)));
  return rows;
}
