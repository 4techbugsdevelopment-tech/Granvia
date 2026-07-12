import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, toPrismaData } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';

// Port of App\Http\Controllers\JobOfferController.

const createSchema = z.object({
  application_id: z.string().uuid().nullish(),
  job_id: z.string().uuid().nullish(),
  guard_user_id: z.string().uuid(),
  company_id: z.string().uuid().nullish(),
  site_id: z.string().uuid().nullish(),
  offered_salary: z.coerce.number().nullish(),
  duty_hours: z.string().nullish(),
  shift_type: z.string().nullish(),
  start_date: z.coerce.date().nullish(),
  terms_summary: z.string().nullish(),
});

const updateSchema = z
  .object({
    offered_salary: z.coerce.number().nullish(),
    duty_hours: z.string().nullish(),
    shift_type: z.string().nullish(),
    start_date: z.coerce.date().nullish(),
    terms_summary: z.string().nullish(),
    status: z.string(),
  })
  .partial();

/** GET /employer/job-offers */
export async function index(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const rows = await prisma.jobOffer.findMany({
    where: { employerUserId: req.user!.id, ...(companyId ? { companyId } : {}) },
    include: {
      job: { select: { id: true, title: true, salaryAmount: true, shiftType: true, dutyHours: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const shaped = snakeKeys(rows) as Array<Record<string, unknown> & { guard_user_id?: string }>;
  return res.json(await attachGuardProfiles(shaped));
}

/** POST /employer/job-offers */
export async function store(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const created = await prisma.jobOffer.create({
    data: { ...toPrismaData(data), employerUserId: req.user!.id, status: 'sent' } as never,
  });
  return res.status(201).json(snakeKeys(created));
}

/** PATCH /employer/job-offers/:jobOffer */
export async function update(req: Request, res: Response) {
  const row = await prisma.jobOffer.findUnique({ where: { id: req.params.jobOffer } });
  if (!row) throw new HttpError(404, 'Not found.');
  if (row.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = updateSchema.parse(req.body);
  const updated = await prisma.jobOffer.update({
    where: { id: row.id },
    data: toPrismaData(data) as never,
  });
  return res.json(snakeKeys(updated));
}
