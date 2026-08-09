import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { snakeKeys } from '../utils/serialize';

type EmailLogRow = {
  kind: string;
  status: string;
  toEmail: string;
  subject: string;
  sourceUrl?: string | null;
  requestUrl?: string | null;
  origin?: string | null;
  referer?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
};

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseDateInput(value: unknown): Date | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function index(req: Request, res: Response) {
  const kind = asString(req.query.kind);
  const status = asString(req.query.status);
  const q = asString(req.query.q)?.toLowerCase();
  const dateFrom = parseDateInput(req.query.date_from);
  const dateTo = parseDateInput(req.query.date_to);
  const limit = Math.min(Number(req.query.limit ?? 200) || 200, 500);

  const where: Record<string, unknown> = {};
  if (kind) where.kind = kind;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  let rows: EmailLogRow[] = [];
  let warning: string | undefined;
  const emailDeliveryLog = (prisma as any).emailDeliveryLog;

  if (!emailDeliveryLog?.findMany) {
    warning = 'The email logs model is not available in the running Prisma client yet.';
    return res.json({
      summary: { total: 0, sent: 0, skipped: 0, error: 0 },
      items: [],
      warning,
    });
  }

  try {
    rows = await emailDeliveryLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as EmailLogRow[];
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    const isMissingTable =
      message.includes('email_delivery_logs') ||
      message.includes('EmailDeliveryLog') ||
      message.includes('Invalid object name') ||
      message.includes('does not exist');
    if (!isMissingTable) {
      throw err;
    }
    warning = 'The email logs table has not been created in this database yet.';
  }

  const filtered = q
    ? rows.filter((row) =>
        [row.kind, row.status, row.toEmail, row.subject, row.sourceUrl, row.requestUrl, row.origin, row.referer, row.errorMessage]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      )
    : rows;

  const summary = {
    total: filtered.length,
    sent: filtered.filter((row) => row.status === 'sent').length,
    skipped: filtered.filter((row) => row.status === 'skipped').length,
    error: filtered.filter((row) => row.status === 'error').length,
  };

  return res.json({
    summary,
    items: snakeKeys(filtered),
    warning,
  });
}
