import { z } from 'zod';
import { HttpError } from '../utils/http';

export type ReportWarning = { code: string; section: string; message: string };
export type ReportMetadata = {
  scope: Record<string, string>;
  filters: Record<string, unknown>;
  date_basis: string | null;
  warnings?: ReportWarning[];
};

/** summary and total MUST come from the full authorised filter, not items.length. */
export function reportResponse<T, S>(items: T[], summary: S, total: number,
  query: { page: number; page_size: number }, metadata: ReportMetadata) {
  z.number().int().nonnegative().parse(total);
  z.number().int().positive().parse(query.page);
  z.number().int().min(1).max(100).parse(query.page_size);
  const warnings = metadata.warnings ?? [];
  return {
    items, summary,
    pagination: { page: query.page, page_size: query.page_size, total, total_pages: Math.ceil(total / query.page_size) },
    meta: { ...metadata, warnings, timezone: 'Asia/Kolkata', generated_at: new Date().toISOString(), partial: warnings.length > 0 },
  };
}

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | boolean | null | undefined };

function csvCell(value: string | number | boolean | null | undefined) {
  let text = value == null ? '' : String(value);
  // Include leading whitespace/control characters so formula payloads cannot hide behind them.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Pass complete authorised rows. Callers must check full count before fetching. */
export function reportCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[], total: number, limit: number) {
  z.number().int().nonnegative().parse(total);
  z.number().int().positive().parse(limit);
  if (total > limit) throw new HttpError(422, 'This export is too large. Narrow the report filters.');
  if (rows.length !== total) throw new HttpError(409, 'Export data is incomplete. Refresh and retry.');
  return '\uFEFF' + [columns.map(c => csvCell(c.header)).join(','),
    ...rows.map(row => columns.map(c => csvCell(c.value(row))).join(','))].join('\r\n') + '\r\n';
}
