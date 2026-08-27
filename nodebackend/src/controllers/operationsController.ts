import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';

async function assignments(userId: string) {
  return prisma.operationsAssignment.findMany({ where: { operationsUserId: userId, status: 'active' } });
}

function applicationScope(rows: Awaited<ReturnType<typeof assignments>>) {
  return rows.map((scope) => ({
    employerUserId: scope.employerUserId,
    ...(scope.companyId ? { companyId: scope.companyId } : {}),
    ...(scope.siteId ? { siteId: scope.siteId } : {}),
    ...(scope.jobId ? { jobId: scope.jobId } : {}),
  }));
}

export async function dashboard(req: Request, res: Response) {
  const scopes = await assignments(req.user!.id);
  const OR = applicationScope(scopes);
  if (!OR.length) return res.json({ assigned_scopes: 0, total_applications: 0, new_applications: 0, interviews: 0, onboarding: 0 });
  const [total, fresh, interviews, onboarding] = await Promise.all([
    prisma.jobApplication.count({ where: { OR } }),
    prisma.jobApplication.count({ where: { OR, status: { in: ['pending', 'applied'] } } }),
    prisma.jobApplication.count({ where: { OR, status: { in: ['shortlisted', 'interview_requested', 'interview'] } } }),
    prisma.jobApplication.count({ where: { OR, status: { in: ['selected', 'offer_sent', 'accepted', 'joined'] } } }),
  ]);
  return res.json({ assigned_scopes: scopes.length, total_applications: total, new_applications: fresh, interviews, onboarding });
}

export async function applications(req: Request, res: Response) {
  const scopes = await assignments(req.user!.id);
  const OR = applicationScope(scopes);
  if (!OR.length) return res.json([]);
  const rows = await prisma.jobApplication.findMany({
    where: {
      OR,
      ...(typeof req.query.status === 'string' ? { status: req.query.status } : {}),
      ...(typeof req.query.job_id === 'string' ? { jobId: req.query.job_id } : {}),
    },
    include: { job: { include: { company: true, site: true } } },
    orderBy: { appliedAt: 'desc' },
  });
  return res.json(await attachGuardProfiles(snakeKeys(rows) as Array<Record<string, unknown> & { guard_user_id?: string }>));
}

const statusSchema = z.object({
  status: z.enum(['under_review', 'contacted', 'shortlisted', 'interview_requested', 'interview_completed', 'selected', 'rejected', 'onboarding', 'accepted', 'joined']),
  remarks: z.string().trim().max(2000).nullish(),
  expected_updated_at: z.coerce.date().nullish(),
});

export async function updateApplication(req: Request, res: Response) {
  const data = statusSchema.parse(req.body);
  if (data.status === 'rejected' && !data.remarks) throw new HttpError(422, 'A rejection reason is required.');
  const scopes = await assignments(req.user!.id);
  const OR = applicationScope(scopes);
  const application = OR.length
    ? await prisma.jobApplication.findFirst({ where: { id: req.params.application, OR } })
    : null;
  if (!application) throw new HttpError(404, 'Application not found in your Operations scope.');
  if (data.expected_updated_at && application.updatedAt.getTime() !== data.expected_updated_at.getTime()) {
    throw new HttpError(409, 'This application was updated by another user. Refresh before changing its status.');
  }
  const [updated] = await prisma.$transaction([
    prisma.jobApplication.update({
      where: { id: application.id },
      data: { status: data.status, notes: data.remarks ?? application.notes, reviewedAt: new Date(), reviewedBy: req.user!.id },
    }),
    prisma.applicationStatusLog.create({
      data: { applicationId: application.id, changedBy: req.user!.id, oldStatus: application.status, newStatus: data.status, remarks: data.remarks ?? null },
    }),
  ]);
  await prisma.notification.create({
    data: { userId: application.guardUserId, title: 'Application updated', message: `Your application status is now ${data.status.replaceAll('_', ' ')}.`, type: 'application' },
  });
  return res.json(snakeKeys(updated));
}
