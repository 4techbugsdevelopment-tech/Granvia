import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, parseJsonField } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';
import { deliverHiringDocumentsForApplication, notifyUnverifiedHiredApplication } from '../services/hiringDocumentDelivery';

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

  const existing = await prisma.jobApplication.findFirst({ where: { jobId: job.id, guardUserId: req.user!.id } });
  if (existing) throw new HttpError(409, 'You have already applied for this job.');

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

  const associate = await prisma.guardProfile.findUnique({
    where: { userId: req.user!.id },
    select: { fullName: true, verificationStatus: true },
  });
  const associateName = associate?.fullName?.trim() || 'Associate Partner';
  const isVerified = associate?.verificationStatus === 'verified';

  const operationsScopes = await prisma.operationsAssignment.findMany({
    where: {
      employerUserId: job.employerUserId,
      status: 'active',
      AND: [
        { OR: [{ companyId: null }, { companyId: job.companyId }] },
        { OR: [{ siteId: null }, { siteId: job.siteId }] },
        { OR: [{ jobId: null }, { jobId: job.id }] },
      ],
    },
    select: { operationsUserId: true },
  });
  const superAdmins = await prisma.user.findMany({
    where: { role: 'super_admin', accountStatus: 'active' },
    select: { id: true },
  });
  // Application creation succeeds independently of notification delivery. A failed
  // notification must not turn a completed application into a misleading 500.
  try {
    const recipients = [...new Set([
      job.employerUserId,
      ...superAdmins.map((admin) => admin.id),
      ...operationsScopes.map((scope) => scope.operationsUserId),
    ].filter((userId): userId is string => Boolean(userId)))];
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          title: 'New application',
          message: `${associateName} applied for ${job.title}.`,
          type: 'application',
        })),
      });
    }

    if (!isVerified) {
      const verificationRecipients = [...new Set([
        job.employerUserId,
        ...superAdmins.map((admin) => admin.id),
      ].filter((userId): userId is string => Boolean(userId)))];
      if (verificationRecipients.length) {
        await prisma.notification.createMany({
          data: verificationRecipients.map((userId) => ({
            userId,
            title: 'Unverified associate application',
            message: `${associateName} is not verified and has applied for ${job.title}. Please review the associate profile before proceeding.`,
            type: 'associate_verification',
          })),
        });
      }
      await prisma.notification.create({
        data: {
          userId: req.user!.id,
          title: 'Complete verification to continue',
          message: `You applied for ${job.title}. Complete your profile verification for further processing.`,
          type: 'associate_verification',
        },
      });
    }
  } catch (error) {
    // Keep the successful application response even if an ancillary notification fails.
    console.warn('Application notification delivery failed', error);
  }

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
  status: z.enum(['applied', 'shortlisted', 'selected', 'scheduled', 'hired', 'not_hired', 'rejected', 'offer_sent', 'accepted', 'joined']),
  remarks: z.string().nullish(),
});

const schedulingSchema = z.object({ remarks: z.string().trim().min(1).max(4000) });

async function applicationWithScope(applicationId: string, user: NonNullable<Request['user']>, admin = false) {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: { job: { select: { id: true, title: true, employerUserId: true } } },
  });
  if (!application) throw new HttpError(404, 'Application not found.');
  if (!admin && (user.role !== 'employer' || application.employerUserId !== user.id)) throw new HttpError(403, 'Forbidden.');
  return application;
}

async function notifyApplicationParties(application: { guardUserId: string; employerUserId: string | null; job: { title: string } }, title: string, message: string, type = 'application') {
  const recipients = [...new Set([application.guardUserId, application.employerUserId].filter(Boolean) as string[])];
  if (recipients.length) await prisma.notification.createMany({ data: recipients.map(userId => ({ userId, title, message, type })) });
}

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
  const application = await applicationWithScope(req.params.application, req.user!);

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

  if (data.status === 'hired' || data.status === 'not_hired') {
    const profile = await prisma.guardProfile.findUnique({ where: { userId: application.guardUserId }, select: { fullName: true, verificationStatus: true } });
    const name = profile?.fullName || 'Associate Partner';
    await notifyApplicationParties(
      application,
      data.status === 'hired' ? 'Associate hired' : 'Interview outcome updated',
      data.status === 'hired'
        ? `${name} has been hired for ${application.job.title}. Verification status: ${profile?.verificationStatus ?? 'pending'}.`
        : `${name} was not selected for ${application.job.title}.`,
      data.status === 'hired' ? 'hiring_verification' : 'application',
    );
    if (data.status === 'hired') {
      await notifyUnverifiedHiredApplication(application.id);
      await deliverHiringDocumentsForApplication(application.id);
    }
  } else if (data.status !== 'applied') {
    await notifyApplicationParties(application, 'Application updated', `Your application for ${application.job.title} is now ${data.status.replaceAll('_', ' ')}.${data.remarks ? ` Remarks: ${data.remarks}` : ''}`);
  }

  return res.json(snakeKeys(updated));
}

/** GET /admin/jobs/:job/applications */
export async function adminJobApplications(req: Request, res: Response) {
  const rows = await prisma.jobApplication.findMany({
    where: { jobId: req.params.job },
    include: { job: { select: { id: true, title: true, salaryAmount: true, dutyHours: true, shiftType: true, startDate: true } } },
    orderBy: { appliedAt: 'desc' },
  });
  const shaped = snakeKeys(rows) as Array<Record<string, unknown> & { guard_user_id?: string }>;
  return res.json(await attachGuardProfiles(shaped));
}

/** PATCH /admin/applications/:application/status */
export async function adminUpdateStatus(req: Request, res: Response) {
  const application = await applicationWithScope(req.params.application, req.user!, true);
  const data = updateStatusSchema.parse(req.body);
  const oldStatus = application.status;
  const [updated] = await prisma.$transaction([
    prisma.jobApplication.update({ where: { id: application.id }, data: { status: data.status, notes: data.remarks ?? application.notes, reviewedAt: new Date(), reviewedBy: req.user!.id } }),
    prisma.applicationStatusLog.create({ data: { applicationId: application.id, changedBy: req.user!.id, oldStatus, newStatus: data.status, remarks: data.remarks ?? null } }),
  ]);
  if (data.status === 'hired' || data.status === 'not_hired') {
    const profile = await prisma.guardProfile.findUnique({ where: { userId: application.guardUserId }, select: { fullName: true, verificationStatus: true } });
    const name = profile?.fullName || 'Associate Partner';
    await notifyApplicationParties(application, data.status === 'hired' ? 'Associate hired' : 'Interview outcome updated', data.status === 'hired' ? `${name} has been hired for ${application.job.title}. Verification status: ${profile?.verificationStatus ?? 'pending'}.` : `${name} was not selected for ${application.job.title}.`, data.status === 'hired' ? 'hiring_verification' : 'application');
    if (data.status === 'hired') {
      await notifyUnverifiedHiredApplication(application.id);
      await deliverHiringDocumentsForApplication(application.id);
    }
  } else if (data.status !== 'applied') {
    await notifyApplicationParties(application, 'Application updated', `Your application for ${application.job.title} is now ${data.status.replaceAll('_', ' ')}.${data.remarks ? ` Remarks: ${data.remarks}` : ''}`);
  }
  return res.json(snakeKeys(updated));
}

/** POST /employer|admin/applications/:application/schedule-interview */
export async function scheduleInterview(req: Request, res: Response) {
  const admin = req.user!.role === 'super_admin';
  const application = await applicationWithScope(req.params.application, req.user!, admin);
  const data = schedulingSchema.parse(req.body);
  const [updated] = await prisma.$transaction([
    prisma.jobApplication.update({ where: { id: application.id }, data: { status: 'scheduled', notes: data.remarks, reviewedAt: new Date(), reviewedBy: req.user!.id } }),
    prisma.applicationStatusLog.create({ data: { applicationId: application.id, changedBy: req.user!.id, oldStatus: application.status, newStatus: 'scheduled', remarks: data.remarks } }),
    prisma.interviewRequest.create({ data: { applicationId: application.id, jobId: application.jobId, guardUserId: application.guardUserId, employerUserId: application.employerUserId, companyId: application.companyId, requestType: 'Offline Interview', message: data.remarks, status: 'scheduled' } }),
  ]);
  await notifyApplicationParties(application, 'Interview scheduled', `Your interview for ${application.job.title} has been scheduled. Remarks: ${data.remarks}`);
  return res.json(snakeKeys(updated));
}
