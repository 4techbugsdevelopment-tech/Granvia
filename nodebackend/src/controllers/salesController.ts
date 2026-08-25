import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, serializeOut } from '../utils/serialize';
import { hashPassword, verifyPassword } from '../utils/password';

// Port of App\Http\Controllers\SalesController (role: sales_executive).

// In-memory OTP store. Fine for a single-process dev server.
const otpStore = new Map<string, { hash: string; salesId: string; employerId: string; expires: number }>();

async function managedClientIds(salesId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: 'employer', employerProfile: { salesExecutiveId: salesId } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function authorizeClient(salesId: string, employerId: string) {
  const employer = await prisma.user.findUnique({
    where: { id: employerId },
    include: { employerProfile: true },
  });
  const ok = employer?.role === 'employer' && employer.employerProfile?.salesExecutiveId === salesId;
  if (!ok) throw new HttpError(403, 'This client is not assigned to you.');
  return employer!;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** GET /sales/reports/counts */
export async function counts(req: Request, res: Response) {
  const clientIds = await managedClientIds(req.user!.id);
  const inClients = { employerUserId: { in: clientIds } };

  const [activeJobs, totalJobs, totalApplications, accepted, activeDiscounts] = await Promise.all([
    prisma.jobPost.count({ where: { ...inClients, status: 'active' } }),
    prisma.jobPost.count({ where: inClients }),
    prisma.jobApplication.count({ where: inClients }),
    prisma.jobApplication.count({ where: { ...inClients, status: { in: ['accepted', 'selected', 'hired'] } } }),
    prisma.discount.count({ where: { salesExecutiveUserId: req.user!.id, status: 'Active' } }),
  ]);

  return res.json({
    managed_clients: clientIds.length,
    active_jobs: activeJobs,
    total_jobs: totalJobs,
    conversion_rate: totalApplications > 0 ? Math.round((accepted / totalApplications) * 1000) / 10 : 0,
    active_discounts: activeDiscounts,
  });
}

/** GET /sales/activity */
export async function activity(req: Request, res: Response) {
  const clientIds = await managedClientIds(req.user!.id);
  const inClients = { employerUserId: { in: clientIds } };

  const [jobs, apps] = await Promise.all([
    prisma.jobPost.findMany({
      where: inClients,
      include: { company: { select: { id: true, companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.jobApplication.findMany({
      where: inClients,
      include: { job: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  const items = [
    ...jobs.map((j) => ({
      type: 'job',
      title: `Job posted: ${j.title}`,
      subtitle: j.company?.companyName ?? null,
      at: j.createdAt,
    })),
    ...apps.map((a) => ({
      type: 'application',
      title: `New application${a.job?.title ? ' for ' + a.job.title : ''}`,
      subtitle: `Status: ${a.status}`,
      at: a.createdAt,
    })),
  ]
    .sort((x, y) => y.at.getTime() - x.at.getTime())
    .slice(0, 8);

  return res.json(snakeKeys(items));
}

/** GET /sales/clients */
export async function clients(req: Request, res: Response) {
  const clientList = await prisma.user.findMany({
    where: { role: 'employer', employerProfile: { salesExecutiveId: req.user!.id } },
    include: { employerProfile: true },
  });
  const ids = clientList.map((c) => c.id);
  const [companyCounts, siteCounts, jobCounts] = await Promise.all([
    prisma.employerCompany.groupBy({ by: ['employerUserId'], where: { employerUserId: { in: ids } }, _count: { _all: true } }),
    prisma.companySite.groupBy({ by: ['employerUserId'], where: { employerUserId: { in: ids } }, _count: { _all: true } }),
    prisma.jobPost.groupBy({ by: ['employerUserId'], where: { employerUserId: { in: ids } }, _count: { _all: true } }),
  ]);
  const cMap = new Map(companyCounts.map((r) => [r.employerUserId, r._count._all]));
  const sMap = new Map(siteCounts.map((r) => [r.employerUserId ?? '', r._count._all]));
  const jMap = new Map(jobCounts.map((r) => [r.employerUserId, r._count._all]));

  return res.json(
    clientList.map((u) => ({
      id: u.id,
      name: u.fullName,
      email: u.email,
      mobile: u.mobile,
      city: u.employerProfile?.city ?? null,
      state: u.employerProfile?.state ?? null,
      billing_status: u.employerProfile?.billingStatus ?? 'current',
      base_hourly_rate: u.employerProfile?.baseHourlyRate?.toString() ?? null,
      companies: cMap.get(u.id) ?? 0,
      sites: sMap.get(u.id) ?? 0,
      jobs: jMap.get(u.id) ?? 0,
    }))
  );
}

/** GET /sales/clients/:employer */
export async function clientDetail(req: Request, res: Response) {
  const employer = await authorizeClient(req.user!.id, req.params.employer);

  const [companies, jobs] = await Promise.all([
    prisma.employerCompany.findMany({ where: { employerUserId: employer.id } }),
    prisma.jobPost.findMany({
      where: { employerUserId: employer.id },
      include: { company: { select: { id: true, companyName: true } }, site: { select: { id: true, siteName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);
  const sites = await prisma.companySite.findMany({ where: { companyId: { in: companies.map((c) => c.id) } } });

  return res.json({
    client: {
      id: employer.id,
      name: employer.fullName,
      email: employer.email,
      mobile: employer.mobile,
      billing_status: employer.employerProfile?.billingStatus ?? 'current',
      base_hourly_rate: employer.employerProfile?.baseHourlyRate?.toString() ?? null,
    },
    companies: snakeKeys(companies),
    sites: serializeOut(sites, ['address']),
    jobs: serializeOut(jobs, ['required_skills', 'language_requirements']),
  });
}

/** GET /sales/jobs — all jobs belonging to clients assigned to this sales executive. */
export async function jobs(req: Request, res: Response) {
  const clientIds = await managedClientIds(req.user!.id);
  const rows = await prisma.jobPost.findMany({
    where: { employerUserId: { in: clientIds } },
    include: {
      company: { select: { id: true, companyName: true } },
      site: { select: { id: true, siteName: true, city: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const employers = await prisma.user.findMany({ where: { id: { in: clientIds } }, select: { id: true, fullName: true } });
  const employerNames = new Map(employers.map((employer) => [employer.id, employer.fullName]));
  return res.json(serializeOut(rows.map((row) => ({ ...row, employerName: employerNames.get(row.employerUserId) ?? 'Client' })), ['required_skills', 'language_requirements']));
}

/** POST /sales/jobs/request-otp */
export async function requestJobOtp(req: Request, res: Response) {
  const { employer_user_id } = z.object({ employer_user_id: z.string().uuid() }).parse(req.body);
  const employer = await authorizeClient(req.user!.id, employer_user_id);

  const otp = String(crypto.randomInt(1000, 10000));
  const otpId = crypto.randomUUID();
  otpStore.set(otpId, {
    hash: await hashPassword(otp),
    salesId: req.user!.id,
    employerId: employer.id,
    expires: Date.now() + 10 * 60 * 1000,
  });

  return res.json({ otp_id: otpId, sent_to: employer.mobile, dev_otp: otp });
}

/** POST /sales/jobs */
export async function storeJob(req: Request, res: Response) {
  const data = z
    .object({
      otp_id: z.string(),
      otp: z.string(),
      employer_user_id: z.string().uuid(),
      company_id: z.string().uuid(),
      site_id: z.string().uuid().nullish(),
      title: z.string(),
      duty_hours: z.string().nullish(),
      guards_required: z.coerce.number().int().min(1).nullish(),
      experience_required: z.string().nullish(),
      qualification_required: z.string().nullish(),
      language_requirements: z.array(z.any()).nullish(),
      salary_amount: z.coerce.number().nullish(),
      description: z.string().nullish(),
    })
    .parse(req.body);

  const employer = await authorizeClient(req.user!.id, data.employer_user_id);

  const cached = otpStore.get(data.otp_id);
  if (
    !cached ||
    cached.expires < Date.now() ||
    cached.employerId !== employer.id ||
    !(await verifyPassword(data.otp, cached.hash))
  ) {
    throw new HttpError(422, 'Invalid or expired client confirmation OTP.');
  }

  const company = await prisma.employerCompany.findFirst({
    where: { id: data.company_id, employerUserId: employer.id },
  });
  if (!company) throw new HttpError(422, 'Company does not belong to this client.');

  if (data.site_id) {
    const site = await prisma.companySite.findUnique({ where: { id: data.site_id } });
    if (!site || site.companyId !== company.id) {
      throw new HttpError(422, 'Site does not belong to the selected company.');
    }
  }

  const job = await prisma.jobPost.create({
    data: {
      employerUserId: employer.id,
      companyId: data.company_id,
      siteId: data.site_id ?? null,
      title: data.title,
      dutyHours: data.duty_hours ?? null,
      guardsRequired: data.guards_required ?? 1,
      experienceRequired: data.experience_required ?? null,
      qualificationRequired: data.qualification_required ?? null,
      languageRequirements: data.language_requirements ? JSON.stringify(data.language_requirements) : null,
      salaryAmount: data.salary_amount ?? null,
      description: data.description ?? null,
      category: 'proxy_sales',
      status: 'pending_approval',
    },
    include: { company: { select: { id: true, companyName: true } }, site: { select: { id: true, siteName: true } } },
  });

  otpStore.delete(data.otp_id);
  return res.status(201).json(serializeOut(job, ['required_skills', 'language_requirements']));
}

// ── Discounts ──────────────────────────────────────────────────────────────

const discountSchema = z.object({
  employer_user_id: z.string().uuid().nullish(),
  label: z.string(),
  discount_type: z.enum(['percentage', 'flat']).nullish(),
  value: z.coerce.number().min(0),
  applies_to: z.string().nullish(),
  status: z.enum(['Active', 'Expired']).nullish(),
});

async function withEmployerName(discount: Record<string, unknown>) {
  const employerUserId = discount.employer_user_id as string | null;
  let employer = null;
  if (employerUserId) {
    const u = await prisma.user.findUnique({ where: { id: employerUserId }, select: { id: true, fullName: true } });
    employer = u ? { id: u.id, full_name: u.fullName } : null;
  }
  return { ...discount, employer };
}

/** GET /sales/discounts */
export async function discounts(req: Request, res: Response) {
  const rows = await prisma.discount.findMany({
    where: { salesExecutiveUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  const shaped = snakeKeys(rows) as Array<Record<string, unknown>>;
  return res.json(await Promise.all(shaped.map(withEmployerName)));
}

/** POST /sales/discounts */
export async function storeDiscount(req: Request, res: Response) {
  const data = discountSchema.parse(req.body);
  if (data.employer_user_id) await authorizeClient(req.user!.id, data.employer_user_id);

  const created = await prisma.discount.create({
    data: {
      salesExecutiveUserId: req.user!.id,
      employerUserId: data.employer_user_id ?? null,
      label: data.label,
      discountType: data.discount_type ?? 'percentage',
      value: data.value,
      appliesTo: data.applies_to ?? null,
      status: data.status ?? 'Active',
    },
  });
  return res.status(201).json(await withEmployerName(snakeKeys(created) as Record<string, unknown>));
}

/** PATCH /sales/discounts/:discount */
export async function updateDiscount(req: Request, res: Response) {
  const discount = await prisma.discount.findUnique({ where: { id: req.params.discount } });
  if (!discount) throw new HttpError(404, 'Not found.');
  if (discount.salesExecutiveUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = discountSchema.partial().parse(req.body);
  const updated = await prisma.discount.update({
    where: { id: discount.id },
    data: {
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.discount_type ? { discountType: data.discount_type } : {}),
      ...(data.value !== undefined ? { value: data.value } : {}),
      ...(data.applies_to !== undefined ? { appliesTo: data.applies_to } : {}),
      ...(data.status ? { status: data.status } : {}),
    } as never,
  });
  return res.json(await withEmployerName(snakeKeys(updated) as Record<string, unknown>));
}

/** DELETE /sales/discounts/:discount */
export async function destroyDiscount(req: Request, res: Response) {
  const discount = await prisma.discount.findUnique({ where: { id: req.params.discount } });
  if (!discount) throw new HttpError(404, 'Not found.');
  if (discount.salesExecutiveUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');
  await prisma.discount.delete({ where: { id: discount.id } });
  return res.json({ message: 'Discount removed.' });
}

/** GET /sales/manpower */
export async function manpower(req: Request, res: Response) {
  const q = z
    .object({
      lat: z.coerce.number().min(-90).max(90).optional(),
      lng: z.coerce.number().min(-180).max(180).optional(),
      radius: z.coerce.number().min(1).max(100).optional(),
    })
    .parse(req.query);

  const guards = await prisma.guardProfile.findMany({
    where: { latitude: { not: null }, longitude: { not: null }, verificationStatus: 'verified' },
  });

  const partners = guards.map((g) => {
    const lat = Number(g.latitude);
    const lng = Number(g.longitude);
    const distance = q.lat !== undefined && q.lng !== undefined ? haversineKm(q.lat, q.lng, lat, lng) : null;
    return {
      id: g.userId,
      name: g.fullName,
      city: g.city,
      latitude: lat,
      longitude: lng,
      skills: g.skills ? JSON.parse(g.skills) : [],
      experience: g.experience,
      distance_km: distance !== null ? Math.round(distance * 10) / 10 : null,
    };
  });

  const withinRadius =
    q.radius !== undefined && q.lat !== undefined
      ? partners.filter((p) => p.distance_km !== null && p.distance_km <= q.radius!)
      : partners;

  return res.json({
    radius_km: q.radius ?? null,
    available_count: withinRadius.length,
    total_count: partners.length,
    partners: withinRadius,
  });
}
