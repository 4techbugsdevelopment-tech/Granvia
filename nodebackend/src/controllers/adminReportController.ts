import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { snakeKeys, parseJsonField } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';
import { autoCheckoutExpiredAttendance } from '../services/attendanceAutoCheckout';

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
      site: { select: { id: true, siteName: true, city: true } },
      company: { select: { id: true, companyName: true } },
    },
  },
} as const;

/** GET /admin/attendance */
export async function attendance(req: Request, res: Response) {
  await autoCheckoutExpiredAttendance();
  const today = todayDateOnly();

  const [records, checkedInToday, activeToday, verified, pending] = await Promise.all([
    prisma.attendanceRecord.findMany({
      include: jobInclude,
      orderBy: [{ attendanceDate: 'desc' }, { inTime: 'desc' }],
      take: 200,
    }),
    prisma.attendanceRecord.count({ where: { attendanceDate: today } }),
    prisma.attendanceRecord.count({ where: { attendanceDate: today, outTime: null } }),
    prisma.attendanceRecord.count({ where: { status: 'verified' } }),
    prisma.attendanceRecord.count({ where: { status: 'pending_verification' } }),
  ]);

  const rows = snakeKeys(records) as Array<Record<string, unknown> & { guard_user_id?: string }>;
  const enriched = await attachGuardProfiles(rows);

  return res.json({
    stats: {
      checked_in_today: checkedInToday,
      active: activeToday,
      verified,
      pending,
    },
    records: enriched,
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
