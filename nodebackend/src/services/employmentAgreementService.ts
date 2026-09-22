import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';

function agreementNumber(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return `AGR-${s}`;
}

export function buildEmploymentAgreementData(application: {
  jobId: string;
  guardUserId: string;
  employerUserId: string | null;
  siteId: string | null;
  job: {
    title: string;
    salaryAmount?: unknown;
    dutyHours?: string | null;
    shiftType?: string | null;
    startDate?: Date | null;
  };
}) {
  return {
    jobId: application.jobId,
    guardUserId: application.guardUserId,
    employerUserId: application.employerUserId,
    siteId: application.siteId,
    agreementNumber: agreementNumber(),
    title: application.job.title ? `Job Agreement - ${application.job.title}` : 'Job Agreement',
    terms: JSON.stringify({
      salary: application.job.salaryAmount ?? null,
      duty_hours: application.job.dutyHours ?? null,
      shift_type: application.job.shiftType ?? null,
      start_date: application.job.startDate ? application.job.startDate.toISOString() : null,
    }),
    effectiveFrom: application.job.startDate ?? null,
    status: 'pending',
    employerConfirmationStatus: 'pending',
    guardConfirmationStatus: 'pending',
    platformConfirmationStatus: 'pending',
  };
}

export async function ensureEmploymentAgreementForApplication(
  tx: Prisma.TransactionClient,
  application: Parameters<typeof buildEmploymentAgreementData>[0],
) {
  const existing = await tx.agreement.findFirst({
    where: {
      jobId: application.jobId,
      guardUserId: application.guardUserId,
      employerUserId: application.employerUserId,
    },
    select: { id: true },
  });
  if (existing) return existing;
  return tx.agreement.create({ data: buildEmploymentAgreementData(application) as never });
}

export async function assertEmployerHiredAgreementAccess(userId: string, role: string, applicationId: string) {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: { job: { select: { id: true, title: true, salaryAmount: true, dutyHours: true, shiftType: true, startDate: true } } },
  });
  if (!application || application.status !== 'hired') throw new HttpError(404, 'Employment agreement not found.');
  if (role !== 'super_admin' && application.employerUserId !== userId) throw new HttpError(403, 'Forbidden.');
  await prisma.$transaction(async (tx) => ensureEmploymentAgreementForApplication(tx, application));
}
