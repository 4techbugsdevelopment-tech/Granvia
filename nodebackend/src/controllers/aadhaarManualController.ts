import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';

// Manual Aadhaar declaration — used while the automated Aadhaar API is disabled.
// Admins declare guards and employers; employers declare associates in their
// own hiring pipeline. Each declaration writes an audit row.

const declSchema = z.object({
  status: z.enum(['verified', 'rejected', 'pending']),
  remarks: z.string().nullish(),
});

async function setGuardAadhaar(guardUserId: string, status: string, provider: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.guardProfile.updateMany({ where: { userId: guardUserId }, data: { aadhaarStatus: status } }),
    prisma.guardAadhaarVerification.create({
      data: {
        guardUserId,
        verificationStatus: status,
        otpVerifiedAt: status === 'verified' ? now : null,
        providerName: provider,
      },
    }),
  ]);
}

/** PATCH /admin/guards/:guard/aadhaar — admin declares an associate's Aadhaar. */
export async function adminDeclareGuard(req: Request, res: Response) {
  const guard = await prisma.user.findUnique({ where: { id: req.params.guard } });
  if (!guard || guard.role !== 'guard') throw new HttpError(404, 'Not an associate account.');

  const data = declSchema.parse(req.body);
  await setGuardAadhaar(guard.id, data.status, 'manual_admin');

  const profile = await prisma.guardProfile.findUnique({ where: { userId: guard.id } });
  return res.json(snakeKeys(profile));
}

/** PATCH /admin/employers/:employer/aadhaar — admin declares an employer's Aadhaar. */
export async function adminDeclareEmployer(req: Request, res: Response) {
  const employer = await prisma.user.findUnique({ where: { id: req.params.employer } });
  if (!employer || employer.role !== 'employer') throw new HttpError(404, 'Not an employer account.');

  const data = declSchema.parse(req.body);
  const now = new Date();
  await prisma.employerProfile.updateMany({
    where: { userId: employer.id },
    data: {
      isAadhaarVerified: data.status === 'verified',
      aadhaarVerificationStatus: data.status,
      aadhaarVerifiedAt: data.status === 'verified' ? now : null,
      ...(data.remarks != null ? { adminRemarks: data.remarks } : {}),
    },
  });

  const profile = await prisma.employerProfile.findUnique({ where: { userId: employer.id } });
  return res.json(snakeKeys(profile));
}

/** PATCH /employer/associates/:guard/aadhaar — employer declares an associate in their pipeline. */
export async function employerDeclareAssociate(req: Request, res: Response) {
  const guardUserId = req.params.guard;

  // Scope: the associate must have applied to (or been hired for) this employer's jobs.
  const rel = await prisma.jobApplication.findFirst({
    where: { employerUserId: req.user!.id, guardUserId },
    select: { id: true },
  });
  if (!rel) throw new HttpError(403, 'This associate is not in your hiring pipeline.');

  const data = declSchema.parse(req.body);
  await setGuardAadhaar(guardUserId, data.status, 'manual_employer');

  const profile = await prisma.guardProfile.findUnique({ where: { userId: guardUserId } });
  return res.json(snakeKeys(profile));
}
