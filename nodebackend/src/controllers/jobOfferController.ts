import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, toPrismaData } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';
import { buildOfferDecisionPlan, canRespondToOffer } from '../services/jobOfferWorkflow';

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

const guardUpdateSchema = z.object({
  status: z.enum(['accepted', 'declined']),
  remarks: z.string().nullish(),
});

function agreementNumber(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return `AGR-${s}`;
}

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

/** GET /guard/job-offers */
export async function guardIndex(req: Request, res: Response) {
  const rows = await prisma.jobOffer.findMany({
    where: { guardUserId: req.user!.id },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          salaryAmount: true,
          shiftType: true,
          dutyHours: true,
          paymentType: true,
          company: { select: { id: true, companyName: true } },
          site: { select: { id: true, siteName: true, city: true, state: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(snakeKeys(rows));
}

/** PATCH /guard/job-offers/:jobOffer */
export async function guardUpdate(req: Request, res: Response) {
  const row = await prisma.jobOffer.findUnique({
    where: { id: req.params.jobOffer },
    include: { job: true },
  });
  if (!row) throw new HttpError(404, 'Not found.');
  if (row.guardUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = guardUpdateSchema.parse(req.body);
  if (!canRespondToOffer(row.status)) {
    throw new HttpError(422, 'This offer can no longer be changed.');
  }

  const application = row.applicationId
    ? await prisma.jobApplication.findUnique({ where: { id: row.applicationId } })
    : null;
  const plan = buildOfferDecisionPlan(
    {
      id: row.id,
      jobId: row.jobId,
      guardUserId: row.guardUserId,
      employerUserId: row.employerUserId,
      companyId: row.companyId,
      siteId: row.siteId,
      offeredSalary: row.offeredSalary,
      dutyHours: row.dutyHours,
      shiftType: row.shiftType,
      startDate: row.startDate,
      termsSummary: row.termsSummary,
      jobTitle: row.job?.title ?? null,
    },
    data.status
  );

  const [updated] = await prisma.$transaction([
    prisma.jobOffer.update({
      where: { id: row.id },
      data: {
        status: plan.offerStatus,
      },
    }),
    ...(plan.applicationStatus && application
      ? [
          prisma.jobApplication.update({
            where: { id: application.id },
            data: {
              status: plan.applicationStatus,
              reviewedAt: new Date(),
              reviewedBy: req.user!.id,
            },
          }),
          prisma.agreement.create({
            data: {
              offerId: row.id,
              jobId: row.jobId,
              guardUserId: row.guardUserId,
              employerUserId: row.employerUserId,
              siteId: row.siteId,
              agreementNumber: agreementNumber(),
              title: plan.agreement!.title,
              terms: JSON.stringify(plan.agreement!.terms),
              status: plan.agreement!.status,
              employerConfirmationStatus: plan.agreement!.employerConfirmationStatus,
              guardConfirmationStatus: plan.agreement!.guardConfirmationStatus,
              platformConfirmationStatus: plan.agreement!.platformConfirmationStatus,
            } as never,
          }),
        ]
      : []),
    prisma.notification.create({
      data: {
        userId: row.employerUserId ?? req.user!.id,
        ...plan.notification,
      },
    }),
  ]);

  if (plan.applicationStatus && application) {
    await prisma.applicationStatusLog.create({
      data: {
        applicationId: application.id,
        changedBy: req.user!.id,
        oldStatus: application.status,
        newStatus: plan.applicationStatus,
        remarks: data.remarks ?? 'Associate accepted the job offer.',
      },
    });
  }

  return res.json(snakeKeys(updated));
}
