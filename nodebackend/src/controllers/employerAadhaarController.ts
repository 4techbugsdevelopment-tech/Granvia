import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { hashPassword, verifyPassword } from '../utils/password';
import { snakeKeys } from '../utils/serialize';
import { sendAadhaarOtp, mailConfigured } from '../services/mailService';

function auditFromRequest(req: Request, kind: string, details?: Record<string, unknown>) {
  return {
    kind,
    sourceUrl: req.get('referer')?.trim() || req.get('origin')?.trim() || undefined,
    requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    origin: req.get('origin')?.trim() || undefined,
    referer: req.get('referer')?.trim() || undefined,
    environment: process.env.NODE_ENV ?? 'unknown',
    details,
  };
}

// Port of App\Http\Controllers\AadhaarVerificationController (employer email-OTP).

const aadhaarSchema = z.object({
  aadhaar_number: z.string().regex(/^\d{12}$/, 'The aadhaar number format is invalid.'),
});
const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'The otp format is invalid.'),
});

async function employerProfileOrFail(userId: string) {
  const profile = await prisma.employerProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(404, 'Employer profile not found.');
  return profile;
}

/** GET /employer/aadhaar */
export async function status(req: Request, res: Response) {
  const profile = await employerProfileOrFail(req.user!.id);
  return res.json({
    aadhaar_api_enabled: false,
    is_aadhaar_verified: profile.isAadhaarVerified,
    aadhaar_verification_status: profile.aadhaarVerificationStatus,
    aadhaar_verified_at: profile.aadhaarVerifiedAt ?? null,
    aadhaar_last_four: profile.aadhaarLastFour ?? null,
  });
}

/** POST /employer/aadhaar/verify-instant */
export async function instantVerify(req: Request, res: Response) {
  const { aadhaar_number } = aadhaarSchema.parse(req.body);
  const userId = req.user!.id;
  const lastFour = aadhaar_number.slice(-4);
  const now = new Date();

  await prisma.$transaction([
    prisma.employerAadhaarVerification.create({
      data: {
        employerUserId: userId,
        aadhaarNumberHash: crypto.createHash('sha256').update(aadhaar_number).digest('hex'),
        aadhaarLastFour: lastFour,
        verificationStatus: 'verified',
        otpVerifiedAt: now,
        providerName: 'mock_instant',
      },
    }),
    prisma.employerProfile.updateMany({
      where: { userId },
      data: {
        isAadhaarVerified: true,
        aadhaarVerificationStatus: 'verified',
        aadhaarVerifiedAt: now,
        aadhaarLastFour: lastFour,
      },
    }),
  ]);

  const profile = await prisma.employerProfile.findUnique({ where: { userId } });
  return res.json(snakeKeys(profile));
}

/** POST /employer/aadhaar/send-otp */
export async function sendOtp(req: Request, res: Response) {
  const { aadhaar_number } = aadhaarSchema.parse(req.body);
  const user = req.user!;
  const otp = String(crypto.randomInt(100000, 1000000));
  const lastFour = aadhaar_number.slice(-4);

  const record = await prisma.employerAadhaarVerification.create({
    data: {
      employerUserId: user.id,
      aadhaarNumberHash: crypto.createHash('sha256').update(aadhaar_number).digest('hex'),
      aadhaarLastFour: lastFour,
      verificationStatus: 'otp_sent',
      otpHash: await hashPassword(otp),
      otpSentTo: user.email,
      otpChannel: 'email',
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      providerName: 'email_otp',
    },
  });

  await prisma.employerProfile.updateMany({
    where: { userId: user.id },
    data: {
      aadhaarVerificationStatus: 'otp_sent',
      aadhaarLastFour: lastFour,
      isAadhaarVerified: false,
    },
  });

  await sendAadhaarOtp(user.email, otp, auditFromRequest(req, 'employer_aadhaar_otp', { employer_user_id: user.id }));

  return res.json({
    sent_to: user.email,
    verification_id: record.id,
    ...(mailConfigured ? {} : { dev_otp: otp }),
  });
}

/** POST /employer/aadhaar/verify-otp */
export async function verifyOtp(req: Request, res: Response) {
  const { otp } = otpSchema.parse(req.body);
  const user = req.user!;

  const record = await prisma.employerAadhaarVerification.findFirst({
    where: { employerUserId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || record.verificationStatus !== 'otp_sent') {
    throw new HttpError(422, 'No OTP request found. Please request a new OTP.');
  }
  if (record.otpExpiresAt && record.otpExpiresAt.getTime() < Date.now()) {
    throw new HttpError(422, 'OTP has expired. Please request a new one.');
  }
  if (!record.otpHash || !(await verifyPassword(otp, record.otpHash))) {
    await prisma.employerAadhaarVerification.update({
      where: { id: record.id },
      data: { otpAttempts: { increment: 1 } },
    });
    throw new HttpError(422, 'Invalid OTP.');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.employerAadhaarVerification.update({
      where: { id: record.id },
      data: { verificationStatus: 'verified', otpVerifiedAt: now },
    }),
    prisma.employerProfile.updateMany({
      where: { userId: user.id },
      data: { isAadhaarVerified: true, aadhaarVerificationStatus: 'verified', aadhaarVerifiedAt: now },
    }),
  ]);

  const profile = await prisma.employerProfile.findUnique({ where: { userId: user.id } });
  return res.json(snakeKeys(profile));
}
