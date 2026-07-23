import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, serializeOut, toPrismaData } from '../utils/serialize';
import { urlFor } from '../utils/fileStorage';

// Port of App\Http\Controllers\SubAdminController (role: sub_admin).

const COMMISSION_RATE = 0.1;

async function clientIds(subAdminId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: 'employer', employerProfile: { subAdminId } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function guardIds(subAdminId: string): Promise<string[]> {
  const rows = await prisma.guardProfile.findMany({ where: { subAdminId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

const parseJson = (v: string | null): unknown[] => (v ? (JSON.parse(v) as unknown[]) : []);

/** GET /subadmin/reports/counts */
export async function counts(req: Request, res: Response) {
  const [cIds, gIds] = await Promise.all([clientIds(req.user!.id), guardIds(req.user!.id)]);

  const revenueAgg = await prisma.payment.aggregate({
    where: { employerUserId: { in: cIds }, paymentStatus: 'completed' },
    _sum: { amount: true },
  });
  const revenue = Number(revenueAgg._sum.amount ?? 0);

  const [activeJobs, totalJobs, staff] = await Promise.all([
    prisma.jobPost.count({ where: { employerUserId: { in: cIds }, status: 'active' } }),
    prisma.jobPost.count({ where: { employerUserId: { in: cIds } } }),
    prisma.staffMember.count({ where: { subAdminUserId: req.user!.id } }),
  ]);

  return res.json({
    active_jobs: activeJobs,
    total_jobs: totalJobs,
    service_partners: gIds.length,
    clients: cIds.length,
    staff,
    revenue: Math.round(revenue * 100) / 100,
    commission: Math.round(revenue * COMMISSION_RATE * 100) / 100,
  });
}

/** GET /subadmin/company */
export async function company(req: Request, res: Response) {
  let profile = await prisma.subAdminProfile.findFirst({ where: { userId: req.user!.id } });
  if (!profile) {
    profile = await prisma.subAdminProfile.create({
      data: { userId: req.user!.id, branchName: `${req.user!.fullName} Branch` },
    });
  }

  const cIds = await clientIds(req.user!.id);
  const sites = await prisma.companySite.findMany({
    where: { employerUserId: { in: cIds } },
    select: { id: true, siteName: true, address: true, city: true, state: true },
  });

  return res.json({ profile: snakeKeys(profile), sites: serializeOut(sites, ['address']) });
}

/** PATCH /subadmin/company */
export async function updateCompany(req: Request, res: Response) {
  const data = z
    .object({
      branch_name: z.string(),
      registration_no: z.string().nullish(),
      gst_number: z.string().nullish(),
      address: z.string().nullish(),
      contact_email: z.string().email().nullish(),
      phone: z.string().nullish(),
    })
    .partial()
    .parse(req.body);

  const existing = await prisma.subAdminProfile.findFirst({ where: { userId: req.user!.id } });
  const writeData = { ...toPrismaData(data), branchName: data.branch_name ?? `${req.user!.fullName} Branch` };

  const profile = existing
    ? await prisma.subAdminProfile.update({ where: { id: existing.id }, data: writeData as never })
    : await prisma.subAdminProfile.create({ data: { userId: req.user!.id, ...writeData } as never });

  return res.json(snakeKeys(profile));
}

// ── Staff ────────────────────────────────────────────────────────────────

const staffSchema = z.object({
  name: z.string().min(2),
  role: z.string(),
  email: z.string().email().nullish(),
  mobile: z.string().nullish(),
  status: z.enum(['Active', 'Inactive']).nullish(),
  permissions: z.array(z.string()).nullish(),
});

/** GET /subadmin/staff */
export async function staff(req: Request, res: Response) {
  const rows = await prisma.staffMember.findMany({
    where: { subAdminUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(rows, ['permissions']));
}

/** POST /subadmin/staff */
export async function storeStaff(req: Request, res: Response) {
  const data = staffSchema.parse(req.body);
  const created = await prisma.staffMember.create({
    data: { ...toPrismaData(data, ['permissions']), subAdminUserId: req.user!.id } as never,
  });
  return res.status(201).json(serializeOut(created, ['permissions']));
}

/** PATCH /subadmin/staff/:staff */
export async function updateStaff(req: Request, res: Response) {
  const member = await prisma.staffMember.findUnique({ where: { id: req.params.staff } });
  if (!member) throw new HttpError(404, 'Not found.');
  if (member.subAdminUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = staffSchema.partial().parse(req.body);
  const updated = await prisma.staffMember.update({
    where: { id: member.id },
    data: toPrismaData(data, ['permissions']) as never,
  });
  return res.json(serializeOut(updated, ['permissions']));
}

/** DELETE /subadmin/staff/:staff */
export async function destroyStaff(req: Request, res: Response) {
  const member = await prisma.staffMember.findUnique({ where: { id: req.params.staff } });
  if (!member) throw new HttpError(404, 'Not found.');
  if (member.subAdminUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');
  await prisma.staffMember.delete({ where: { id: member.id } });
  return res.json({ message: 'Staff member removed.' });
}

// ── Verification desk ──────────────────────────────────────────────────────

/** GET /subadmin/verification */
export async function verificationQueue(req: Request, res: Response) {
  const guards = await prisma.guardProfile.findMany({
    where: { subAdminId: req.user!.id },
    include: { user: { select: { id: true, fullName: true, mobile: true } } },
  });
  const gIds = guards.map((g) => g.userId);
  const docs = await prisma.guardDocument.findMany({
    where: { guardUserId: { in: gIds } },
    orderBy: { createdAt: 'desc' },
  });
  const byGuard = new Map<string, typeof docs>();
  for (const d of docs) {
    const arr = byGuard.get(d.guardUserId) ?? [];
    arr.push(d);
    byGuard.set(d.guardUserId, arr);
  }

  return res.json(
    guards.map((g) => ({
      id: g.userId,
      name: g.fullName,
      mobile: g.mobile,
      city: g.city,
      qualification: g.qualification,
      experience: g.experience,
      languages: parseJson(g.languages),
      verification_status: g.verificationStatus,
      documents: (byGuard.get(g.userId) ?? []).map((d) => ({
        id: d.id,
        document_type: d.documentType,
        file_name: d.fileName,
        status: d.status,
        admin_remarks: d.adminRemarks,
        uploaded_at: d.createdAt.toISOString(),
        download_url: urlFor('guard-documents', d.filePath),
      })),
    }))
  );
}

/** PATCH /subadmin/guard-documents/:document */
export async function updateDocument(req: Request, res: Response) {
  const document = await prisma.guardDocument.findUnique({ where: { id: req.params.document } });
  if (!document) throw new HttpError(404, 'Not found.');

  const scoped = await prisma.guardProfile.findFirst({
    where: { userId: document.guardUserId, subAdminId: req.user!.id },
    select: { id: true },
  });
  if (!scoped) throw new HttpError(403, 'This associate is not in your branch.');

  const data = z
    .object({ status: z.enum(['verified', 'rejected', 'pending']), admin_remarks: z.string().nullish() })
    .parse(req.body);

  const updated = await prisma.$transaction(async (tx) => {
    const doc = await tx.guardDocument.update({
      where: { id: document.id },
      data: {
        status: data.status,
        ...(data.admin_remarks !== undefined ? { adminRemarks: data.admin_remarks } : {}),
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      },
    });
    if (document.documentType === 'police_verification') {
      await tx.guardProfile.updateMany({
        where: { userId: document.guardUserId },
        data: { policeVerificationStatus: data.status },
      });
    }
    return doc;
  });

  return res.json(snakeKeys(updated));
}

// ── Clients / guards / reports ─────────────────────────────────────────────

/** GET /subadmin/clients */
export async function clients(req: Request, res: Response) {
  const list = await prisma.user.findMany({
    where: { role: 'employer', employerProfile: { subAdminId: req.user!.id } },
    include: { employerProfile: true },
  });
  const ids = list.map((c) => c.id);
  const [siteCounts, jobCounts] = await Promise.all([
    prisma.companySite.groupBy({ by: ['employerUserId'], where: { employerUserId: { in: ids } }, _count: { _all: true } }),
    prisma.jobPost.groupBy({ by: ['employerUserId'], where: { employerUserId: { in: ids } }, _count: { _all: true } }),
  ]);
  const sMap = new Map(siteCounts.map((r) => [r.employerUserId ?? '', r._count._all]));
  const jMap = new Map(jobCounts.map((r) => [r.employerUserId, r._count._all]));

  return res.json(
    list.map((u) => ({
      id: u.id,
      company: u.fullName,
      contact: u.email,
      sites: sMap.get(u.id) ?? 0,
      jobs: jMap.get(u.id) ?? 0,
      status: u.employerProfile?.billingStatus ?? 'current',
    }))
  );
}

/** GET /subadmin/guards */
export async function guards(req: Request, res: Response) {
  const rows = await prisma.guardProfile.findMany({
    where: { subAdminId: req.user!.id },
    include: { user: { select: { id: true, accountStatus: true } } },
  });
  return res.json(
    rows.map((g) => ({
      id: g.userId,
      name: g.fullName,
      city: g.city,
      status: g.verificationStatus,
      account_status: g.user?.accountStatus ?? null,
      experience: g.experience,
    }))
  );
}

/** GET /subadmin/reports/skills */
export async function skillsReport(req: Request, res: Response) {
  const rows = await prisma.guardProfile.findMany({ where: { subAdminId: req.user!.id } });
  return res.json(
    rows.map((g) => {
      const langs = parseJson(g.languages) as string[];
      const skills = parseJson(g.skills) as string[];
      return {
        id: g.userId,
        name: g.fullName,
        languages: langs,
        english: langs.includes('English') ? 'Yes' : 'No',
        qualification: g.qualification,
        specialization: skills[0] ?? null,
        experience: g.experience,
      };
    })
  );
}

/** GET /subadmin/reports/commission */
export async function commissionReport(req: Request, res: Response) {
  const cIds = await clientIds(req.user!.id);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6, 1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const payments = await prisma.payment.findMany({
    where: { employerUserId: { in: cIds }, paymentStatus: 'completed', paymentDate: { gte: sixMonthsAgo } },
  });

  const byMonth = new Map<string, { settlements: number; amount: number }>();
  for (const p of payments) {
    const month = p.paymentDate ? p.paymentDate.toLocaleString('en-US', { month: 'short' }) : 'Unknown';
    const entry = byMonth.get(month) ?? { settlements: 0, amount: 0 };
    entry.settlements += 1;
    entry.amount += Number(p.amount);
    byMonth.set(month, entry);
  }

  const totalAgg = await prisma.payment.aggregate({
    where: { employerUserId: { in: cIds }, paymentStatus: 'completed' },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const total = Number(totalAgg._sum.amount ?? 0);

  return res.json({
    commission_rate: COMMISSION_RATE,
    total_earned: Math.round(total * COMMISSION_RATE * 100) / 100,
    settlements_count: totalAgg._count._all,
    by_month: [...byMonth.entries()].map(([month, v]) => ({
      month,
      settlements: v.settlements,
      commission: Math.round(v.amount * COMMISSION_RATE * 100) / 100,
    })),
  });
}
