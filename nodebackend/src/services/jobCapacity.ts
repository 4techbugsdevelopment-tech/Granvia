import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/http';

export const FILLED_APPLICATION_STATUSES = ['hired', 'accepted', 'joined', 'leave_requested'] as const;

type FilledStatus = typeof FILLED_APPLICATION_STATUSES[number];
type JobCapacityTx = Prisma.TransactionClient;

function isFilledStatus(status: string): status is FilledStatus {
  return (FILLED_APPLICATION_STATUSES as readonly string[]).includes(status);
}

export async function enforceJobCapacityForApplication(
  tx: JobCapacityTx,
  application: { id: string; jobId: string; status: string },
  nextStatus: string,
) {
  if (!isFilledStatus(nextStatus)) return;

  const wasAlreadyFilled = isFilledStatus(application.status);
  if (application.status === nextStatus) {
    throw new HttpError(422, `This application is already marked ${nextStatus.replaceAll('_', ' ')}.`);
  }
  const job = await tx.jobPost.findUnique({
    where: { id: application.jobId },
    select: { id: true, status: true, guardsRequired: true },
  });
  if (!job) throw new HttpError(422, 'Job was not found for this application.');

  if (job.status === 'closed' && !wasAlreadyFilled) {
    throw new HttpError(422, 'This job is closed and cannot accept further hiring.');
  }

  const required = Math.max(1, Number(job.guardsRequired ?? 1));
  const filledOthers = await tx.jobApplication.count({
    where: {
      jobId: job.id,
      id: { not: application.id },
      status: { in: [...FILLED_APPLICATION_STATUSES] },
    },
  });
  const filledAfterThisChange = filledOthers + 1;

  if (filledAfterThisChange > required) {
    throw new HttpError(422, `This job already has ${required} filled position${required === 1 ? '' : 's'}.`);
  }

  if (filledAfterThisChange === required && job.status !== 'closed') {
    await tx.jobPost.update({
      where: { id: job.id },
      data: { status: 'closed', rejectionReason: null },
    });
  }
}
