import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, serializeOut, toPrismaData, parseJsonField } from '../utils/serialize';

const OUT_JSON = ['required_skills', 'language_requirements'];

/** serializeOut + parse the nested full `site.address` json when present. */
function serializeJobsWithSite(jobs: unknown) {
  const rows = serializeOut(jobs, OUT_JSON) as Array<Record<string, unknown>>;
  for (const r of rows) {
    const site = r.site as Record<string, unknown> | null;
    if (site && typeof site.address === 'string') site.address = parseJsonField(site.address);
  }
  return rows;
}

// Employer-facing methods of App\Http\Controllers\JobController.
// (active/pending/all/approve/reject belong to shared/admin routes.)

const JSON_FIELDS = ['required_skills', 'language_requirements'];

const jobFields = {
  site_id: z.string().uuid().nullish(),
  category: z.string().nullish(),
  guard_type: z.string().nullish(),
  guards_required: z.coerce.number().int().min(1).nullish(),
  gender_preference: z.string().nullish(),
  experience_required: z.string().nullish(),
  qualification_required: z.string().nullish(),
  salary_amount: z.coerce.number().nullish(),
  payment_type: z.string().nullish(),
  duty_hours: z.string().nullish(),
  shift_type: z.string().nullish(),
  start_date: z.coerce.date().nullish(),
  end_date: z.coerce.date().nullish(),
  duration_type: z.string().nullish(),
  required_skills: z.array(z.any()).nullish(),
  language_requirements: z.array(z.any()).nullish(),
  police_verification_required: z.boolean().nullish(),
  uniform_required: z.boolean().nullish(),
  food_facility: z.boolean().nullish(),
  accommodation_facility: z.boolean().nullish(),
  description: z.string().nullish(),
  special_instructions: z.string().nullish(),
  status: z.string().nullish(),
};

const createSchema = z.object({ company_id: z.string().uuid(), title: z.string(), ...jobFields });
const updateSchema = z.object({ company_id: z.string().uuid(), title: z.string(), ...jobFields }).partial();

const companySelect = { company: { select: { id: true, companyName: true } } };
const siteSelect = { site: { select: { id: true, siteName: true, city: true, state: true } } };

/** GET /employer/jobs */
export async function mine(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const jobs = await prisma.jobPost.findMany({
    where: { employerUserId: req.user!.id, ...(companyId ? { companyId } : {}) },
    include: { ...companySelect, ...siteSelect },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(jobs, OUT_JSON));
}

/** POST /employer/jobs */
export async function store(req: Request, res: Response) {
  const data = createSchema.parse(req.body);

  if (data.site_id) {
    const site = await prisma.companySite.findUnique({ where: { id: data.site_id } });
    if (!site || site.companyId !== data.company_id) {
      throw new HttpError(422, 'Site does not belong to the selected company.');
    }
  }

  const job = await prisma.jobPost.create({
    data: {
      ...toPrismaData(data, JSON_FIELDS),
      employerUserId: req.user!.id,
      status: 'pending_approval',
    } as never,
  });
  return res.status(201).json(serializeOut(job, OUT_JSON));
}

/** PATCH /employer/jobs/:job */
export async function update(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');
  if (job.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = updateSchema.parse(req.body);
  const updated = await prisma.jobPost.update({
    where: { id: job.id },
    data: toPrismaData(data, JSON_FIELDS) as never,
  });
  return res.json(serializeOut(updated, OUT_JSON));
}

/** DELETE /employer/jobs/:job */
export async function destroy(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');
  if (job.employerUserId !== req.user!.id && req.user!.role !== 'super_admin') {
    throw new HttpError(403, 'Forbidden.');
  }
  await prisma.jobPost.delete({ where: { id: job.id } });
  return res.json({ message: 'Job deleted.' });
}

// --- public / admin -------------------------------------------------------

const companyName = { company: { select: { id: true, companyName: true } } };
const siteBrief = { site: { select: { id: true, siteName: true, city: true, state: true } } };

/** GET /jobs (public) — active jobs with full site. */
export async function active(_req: Request, res: Response) {
  const jobs = await prisma.jobPost.findMany({
    where: { status: 'active' },
    include: { ...companyName, site: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeJobsWithSite(jobs));
}

/** GET /admin/jobs/pending */
export async function pending(_req: Request, res: Response) {
  const jobs = await prisma.jobPost.findMany({
    where: { status: 'pending_approval' },
    include: { ...companyName, ...siteBrief },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(jobs, OUT_JSON));
}

/** GET /admin/jobs */
export async function all(_req: Request, res: Response) {
  const jobs = await prisma.jobPost.findMany({
    include: { ...companyName, ...siteBrief },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(jobs, OUT_JSON));
}

/** PATCH /admin/jobs/:job/approve */
export async function approve(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');
  const updated = await prisma.jobPost.update({
    where: { id: job.id },
    data: { status: 'active', rejectionReason: null },
  });
  return res.json(serializeOut(updated, OUT_JSON));
}

/** PATCH /admin/jobs/:job/reject */
export async function reject(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');
  const reason = z.object({ reason: z.string().nullish() }).parse(req.body).reason ?? '';
  const updated = await prisma.jobPost.update({
    where: { id: job.id },
    data: { status: 'rejected', rejectionReason: reason },
  });
  return res.json(serializeOut(updated, OUT_JSON));
}

/** PATCH /admin/jobs/:job/status — admin-only non-approval status changes. */
export async function adminUpdateStatus(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');

  const { status } = z.object({
    status: z.enum(['pending_approval', 'closed']),
  }).parse(req.body);

  const updated = await prisma.jobPost.update({
    where: { id: job.id },
    data: { status, rejectionReason: null },
  });
  return res.json(serializeOut(updated, OUT_JSON));
}
