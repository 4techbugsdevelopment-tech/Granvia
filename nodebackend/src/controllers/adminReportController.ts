import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { snakeKeys, parseJsonField } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';
import { autoCheckoutExpiredAttendance } from '../services/attendanceAutoCheckout';
import { buildAdminAttendanceWhere } from '../utils/queryFilters';

// Platform-wide admin views for the Super Admin panel:
//   GET /admin/attendance            — all attendance + today stats
//   GET /admin/hiring                — recruitment funnel + recent hires
//   GET /admin/reports/analytics     — area availability, language, commission

const HIRED_STATUSES = ['selected', 'offer_sent', 'accepted', 'joined'];
const COMMISSION_RATE = 0.1;

function todayDateOnly(): Date {
  const indiaNow = new Date(Date.now() + 330 * 60_000);
  const iso = indiaNow.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

const jobInclude = {
  job: {
    select: {
      id: true,
      title: true,
      site: { select: { id: true, siteName: true, city: true, latitude: true, longitude: true } },
      company: { select: { id: true, companyName: true } },
    },
  },
} as const;

function isMissingMigrationError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ['P2021', 'P2022'].includes(error.code);
}

function optionalDelegate<T>(delegate: T | undefined): T | null {
  return delegate ?? null;
}

/** GET /admin/attendance */
export async function attendance(req: Request, res: Response) {
  await autoCheckoutExpiredAttendance();
  const today = todayDateOnly();
  const where = buildAdminAttendanceWhere(req.query);

  const [records, checkedInToday, activeToday, verified, pending] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: jobInclude,
      orderBy: [{ attendanceDate: 'desc' }, { inTime: 'desc' }],
      take: 200,
    }),
    prisma.attendanceRecord.count({ where: { attendanceDate: today } }),
    prisma.attendanceRecord.count({ where: { attendanceDate: today, outTime: null } }),
    prisma.attendanceRecord.count({ where: { status: { in: ['approved', 'verified'] } } }),
    prisma.attendanceRecord.count({ where: { status: 'pending_verification' } }),
  ]);

  const rows = snakeKeys(records) as Array<Record<string, unknown> & { guard_user_id?: string }>;
  const enriched = await attachGuardProfiles(rows);
  const recordIds = records.map((record) => record.id);
  const warnings: string[] = [];
  let payments: Array<{ id: string; attendanceId: string | null; amount: Prisma.Decimal; paymentStatus: string; paymentDate: Date | null }> = [];
  if (recordIds.length) {
    try {
      payments = await prisma.payment.findMany({
        where: { attendanceId: { in: recordIds } } as never,
        select: { id: true, attendanceId: true, amount: true, paymentStatus: true, paymentDate: true },
      });
    } catch (error) {
      if (!isMissingMigrationError(error)) throw error;
      console.warn('[admin/attendance] settlement data unavailable; payment migration is not applied', error);
      warnings.push('Attendance settlement data is unavailable because the server database is missing the latest payment update.');
    }
  }
  const paymentsByAttendance = new Map(payments.map((payment) => [payment.attendanceId, payment]));
  const exceptionRequestDelegate = optionalDelegate((prisma as unknown as { attendanceExceptionRequest?: typeof prisma.attendanceExceptionRequest }).attendanceExceptionRequest);
  let exceptionRequests: Awaited<ReturnType<typeof prisma.attendanceExceptionRequest.findMany>> = [];
  if (!exceptionRequestDelegate) {
    warnings.push('Attendance exception requests are unavailable because the server is missing the latest attendance exception update.');
  } else {
    try {
      exceptionRequests = await exceptionRequestDelegate.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { job: { select: { id: true, title: true, site: { select: { id: true, siteName: true, latitude: true, longitude: true } }, company: { select: { id: true, companyName: true } } } } },
      });
    } catch (error) {
      if (!isMissingMigrationError(error)) throw error;
      console.warn('[admin/attendance] exception requests unavailable; attendance exception migration is not applied', error);
      warnings.push('Attendance exception requests are unavailable because the server database is missing the latest attendance exception update.');
    }
  }
  const requestIds = exceptionRequests.map((request) => request.id);
  const auditEventDelegate = optionalDelegate((prisma as unknown as { attendanceAuditEvent?: typeof prisma.attendanceAuditEvent }).attendanceAuditEvent);
  let auditEvents: Awaited<ReturnType<typeof prisma.attendanceAuditEvent.findMany>> = [];
  if (!auditEventDelegate) {
    warnings.push('Attendance audit events are unavailable because the server is missing the latest attendance audit update.');
  } else if (recordIds.length || requestIds.length) {
    try {
      auditEvents = await auditEventDelegate.findMany({
        where: {
          OR: [
            ...(recordIds.length ? [{ attendanceRecordId: { in: recordIds } }] : []),
            ...(requestIds.length ? [{ exceptionRequestId: { in: requestIds } }] : []),
          ],
        },
        orderBy: { eventAt: 'asc' },
      });
    } catch (error) {
      if (!isMissingMigrationError(error)) throw error;
      console.warn('[admin/attendance] audit events unavailable; attendance audit migration is not applied', error);
      warnings.push('Attendance audit events are unavailable because the server database is missing the latest attendance audit update.');
    }
  }
  const actorIds = [...new Set(auditEvents.map((event) => event.actorUserId).filter(Boolean) as string[])];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true, role: true } })
    : [];
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const auditsByRecord = new Map<string, Array<Record<string, unknown>>>();
  const auditsByRequest = new Map<string, Array<Record<string, unknown>>>();
  for (const event of auditEvents) {
    const shaped = { ...snakeKeys(event), actor: event.actorUserId ? actorById.get(event.actorUserId) ?? null : null } as Record<string, unknown>;
    if (event.attendanceRecordId) auditsByRecord.set(event.attendanceRecordId, [...(auditsByRecord.get(event.attendanceRecordId) ?? []), shaped]);
    if (event.exceptionRequestId) auditsByRequest.set(event.exceptionRequestId, [...(auditsByRequest.get(event.exceptionRequestId) ?? []), shaped]);
  }
  const requestRows = snakeKeys(exceptionRequests) as Array<Record<string, unknown> & { guard_user_id?: string; id: string }>;
  const enrichedRequests = await attachGuardProfiles(requestRows);

  return res.json({
    stats: {
      checked_in_today: checkedInToday,
      active: activeToday,
      verified,
      pending,
    },
    warnings,
    records: enriched.map((record) => ({
      ...record,
      audit_events: auditsByRecord.get(record.id as string) ?? [],
      settlement: paymentsByAttendance.get(record.id as string)
        ? snakeKeys(paymentsByAttendance.get(record.id as string)!)
        : null,
    })),
    attendance_requests: enrichedRequests.map((request) => ({
      ...request,
      audit_events: auditsByRequest.get(request.id as string) ?? [],
    })),
  });
}

/** GET /admin/hiring */
export async function hiring(_req: Request, res: Response) {
  const [applied, selected, offers, agreements, joined, recent] = await Promise.all([
    prisma.jobApplication.count(),
    prisma.jobApplication.count({ where: { status: { in: HIRED_STATUSES } } }),
    prisma.jobOffer.count(),
    prisma.agreement.count(),
    prisma.jobApplication.count({ where: { status: 'joined' } }),
    prisma.agreement.findMany({ include: jobInclude, orderBy: { createdAt: 'desc' }, take: 15 }),
  ]);

  const funnel = [
    { stage: 'Applied', count: applied, color: '#94a3b8' },
    { stage: 'Selected', count: selected, color: '#1d4ed8' },
    { stage: 'Offered', count: offers, color: '#7c3aed' },
    { stage: 'Agreement', count: agreements, color: '#0891b2' },
    { stage: 'Joined', count: joined, color: '#166534' },
  ];

  const recentRows = snakeKeys(recent) as Array<Record<string, any> & { guard_user_id?: string }>;
  const enriched = await attachGuardProfiles(recentRows);
  const recent_hires = enriched.map((a) => ({
    guard: a.guard_profile?.full_name ?? '—',
    employer: a.job?.company?.company_name ?? '—',
    site: a.job?.site?.site_name ?? '—',
    date: a.signed_at ?? a.created_at,
    status: a.status,
  }));

  return res.json({ funnel, recent_hires });
}

/** GET /admin/reports/analytics */
export async function analytics(_req: Request, res: Response) {
  const guards = await prisma.guardProfile.findMany({
    select: { userId: true, city: true, languages: true },
  });

  const hiredRows = await prisma.jobApplication.findMany({
    where: { status: { in: HIRED_STATUSES } },
    select: { guardUserId: true },
  });
  const hiredIds = new Set(hiredRows.map((r) => r.guardUserId));

  const byArea = new Map<string, { available: number; deployed: number; english: number }>();
  for (const g of guards) {
    const area = g.city?.trim() || 'Unspecified';
    const entry = byArea.get(area) ?? { available: 0, deployed: 0, english: 0 };
    if (hiredIds.has(g.userId)) entry.deployed += 1;
    else entry.available += 1;
    const langs = parseJsonField(g.languages) as unknown;
    const langList = Array.isArray(langs) ? langs.map((l) => String(l).toLowerCase()) : [];
    if (langList.includes('english')) entry.english += 1;
    byArea.set(area, entry);
  }

  const area_availability = [...byArea.entries()]
    .map(([area, v]) => ({
      area,
      available: v.available,
      deployed: v.deployed,
      total: v.available + v.deployed,
      languages: { English: v.english },
    }))
    .sort((a, b) => b.total - a.total);

  const total_english = area_availability.reduce((s, a) => s + a.languages.English, 0);

  // Commission by month (last 6 months) from completed payments, platform-wide.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const payments = await prisma.payment.findMany({
    where: { paymentStatus: 'completed', paymentDate: { gte: sixMonthsAgo } },
    select: { amount: true, paymentDate: true },
  });

  const monthOrder: string[] = [];
  const byMonth = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const key = d.toLocaleString('en-US', { month: 'short' });
    monthOrder.push(key);
    byMonth.set(key, 0);
  }
  for (const p of payments) {
    const key = p.paymentDate ? p.paymentDate.toLocaleString('en-US', { month: 'short' }) : null;
    if (key && byMonth.has(key)) byMonth.set(key, byMonth.get(key)! + Number(p.amount));
  }
  const commission_by_month = monthOrder.map((month) => ({
    month,
    commission: Math.round((byMonth.get(month) ?? 0) * COMMISSION_RATE * 100) / 100,
  }));

  const totalAgg = await prisma.payment.aggregate({
    where: { paymentStatus: 'completed' },
    _sum: { amount: true },
  });
  const total_earned = Math.round(Number(totalAgg._sum.amount ?? 0) * COMMISSION_RATE * 100) / 100;

  return res.json({
    area_availability,
    total_english,
    commission_by_month,
    commission_rate: COMMISSION_RATE,
    total_earned,
  });
}
