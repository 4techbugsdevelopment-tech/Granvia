import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, parseJsonField } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';

// Guard-facing application controller.
// (employerIndex/updateStatus are wired when the employer/admin routes are ported.)

const applySchema = z.object({
  cover_note: z.string().nullish(),
});

/** POST /guard/jobs/:job/apply */
export async function apply(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) {
    throw new HttpError(404, 'Not found.');
  }

  if (job.status !== 'active') {
    throw new HttpError(422, 'This job is not currently accepting applications.');
  }

  if (!job.companyId || !job.siteId) {
    throw new HttpError(422, 'This job posting is missing company or site information.');
  }

  const data = applySchema.parse(req.body);

  const application = await prisma.jobApplication.create({
    data: {
      jobId: job.id,
      guardUserId: req.user!.id,
      employerUserId: job.employerUserId,
      companyId: job.companyId,
      siteId: job.siteId,
      coverNote: data.cover_note ?? null,
      status: 'applied',
      appliedAt: new Date(),
    },
  });

  return res.status(201).json(snakeKeys(application));
}

/** GET /guard/applications */
export async function mine(req: Request, res: Response) {
  const applications = await prisma.jobApplication.findMany({
    where: { guardUserId: req.user!.id },
    include: {
      job: {
        include: {
          company: { select: { id: true, companyName: true } },
          site: true,
        },
      },
    },
    orderBy: { appliedAt: 'desc' },
  });

  const rows = snakeKeys(applications) as Array<Record<string, any>>;
  for (const application of rows) {
    if (!application.job) continue;
    application.job.required_skills = parseJsonField(application.job.required_skills);
    application.job.language_requirements = parseJsonField(application.job.language_requirements);
  }
  return res.json(rows);
}

/** GET /guard/applications/job-ids */
export async function myAppliedJobIds(req: Request, res: Response) {
  const rows = await prisma.jobApplication.findMany({
    where: { guardUserId: req.user!.id },
    select: { jobId: true },
  });

  return res.json(rows.map((r) => r.jobId));
}

// --- employer/admin-facing ------------------------------------------------

const updateStatusSchema = z.object({
  status: z.string(),
  remarks: z.string().nullish(),
});

/** GET /employer/applications */
export async function employerIndex(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const jobId = req.query.job_id as string | undefined;

  const applications = await prisma.jobApplication.findMany({
    where: {
      employerUserId: req.user!.id,
      ...(companyId ? { companyId } : {}),
      ...(jobId ? { jobId } : {}),
    },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          salaryAmount: true,
          dutyHours: true,
          shiftType: true,
          startDate: true,
        },
      },
    },
    orderBy: { appliedAt: 'desc' },
  });

  const rows = snakeKeys(applications) as Array<Record<string, unknown> & { guard_user_id?: string }>;
  return res.json(await attachGuardProfiles(rows));
}

/** PATCH /employer/applications/:application/status */
export async function updateStatus(req: Request, res: Response) {
  const application = await prisma.jobApplication.findUnique({
    where: { id: req.params.application },
  });
  if (!application) throw new HttpError(404, 'Not found.');

  const data = updateStatusSchema.parse(req.body);
  const oldStatus = application.status;

  const [updated] = await prisma.$transaction([
    prisma.jobApplication.update({
      where: { id: application.id },
      data: {
        status: data.status,
        notes: data.remarks ?? application.notes,
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
      },
    }),
    prisma.applicationStatusLog.create({
      data: {
        applicationId: application.id,
        changedBy: req.user!.id,
        oldStatus,
        newStatus: data.status,
        remarks: data.remarks ?? null,
      },
    }),
  ]);

  return res.json(snakeKeys(updated));
}
