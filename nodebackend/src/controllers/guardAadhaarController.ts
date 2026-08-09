import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { hashPassword, verifyPassword } from '../utils/password';
import { serializeGuardProfile } from '../serializers/userSerializer';
import { sendAadhaarOtp } from '../services/mailService';
import { mailConfigured } from '../services/mailService';

// Interim email-OTP flow.
// OTP delivery isn't wired yet, so sendOtp returns dev_otp in development.
// Swap in the client Aadhaar API later without changing routes.

const aadhaarSchema = z.object({
  aadhaar_number: z.string().regex(/^\d{12}$/, 'The aadhaar number format is invalid.'),
});

const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'The otp format is invalid.'),
});

async function guardProfileOrFail(userId: string) {
  const profile = await prisma.guardProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new HttpError(404, 'Associate profile not found.');
  }
  return profile;
}

/** GET /guard/aadhaar */
export async function status(req: Request, res: Response) {
  const profile = await guardProfileOrFail(req.user!.id);

  const latest = await prisma.guardAadhaarVerification.findFirst({
    where: { guardUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    aadhaar_api_enabled: false,
    aadhaar_status: profile.aadhaarStatus,
    aadhaar_last_four: latest?.aadhaarLastFour ?? null,
    verified_at: latest?.otpVerifiedAt ?? null,
  });
}

/** POST /guard/aadhaar/verify-instant */
export async function instantVerify(req: Request, res: Response) {
  const { aadhaar_number } = aadhaarSchema.parse(req.body);
  const userId = req.user!.id;
  const lastFour = aadhaar_number.slice(-4);
  const verifiedAt = new Date();

  await prisma.$transaction([
    prisma.guardAadhaarVerification.create({
      data: {
        guardUserId: userId,
        aadhaarNumberHash: crypto.createHash('sha256').update(aadhaar_number).digest('hex'),
        aadhaarLastFour: lastFour,
        verificationStatus: 'verified',
        otpVerifiedAt: verifiedAt,
        providerName: 'mock_instant',
      },
    }),
    prisma.guardProfile.updateMany({
      where: { userId },
      data: { aadhaarStatus: 'verified' },
    }),
  ]);

  return res.json({
    aadhaar_status: 'verified',
    aadhaar_last_four: lastFour,
    verified_at: verifiedAt.toISOString(),
  });
}

/** POST /guard/aadhaar/send-otp */
export async function sendOtp(req: Request, res: Response) {
  const { aadhaar_number } = aadhaarSchema.parse(req.body);
  const user = req.user!;
  const otp = String(crypto.randomInt(100000, 1000000));
  const lastFour = aadhaar_number.slice(-4);

  const record = await prisma.guardAadhaarVerification.create({
    data: {
      guardUserId: user.id,
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

  await prisma.guardProfile.updateMany({
    where: { userId: user.id },
    data: { aadhaarStatus: 'otp_sent' },
  });

  await sendAadhaarOtp(user.email, otp);

  return res.json({
    sent_to: user.email,
    verification_id: record.id,
    // Only leak the OTP in the response when no real mail server is configured.
    ...(mailConfigured ? {} : { dev_otp: otp }),
  });
}

/** POST /guard/aadhaar/verify-otp */
export async function verifyOtp(req: Request, res: Response) {
  const { otp } = otpSchema.parse(req.body);
  const user = req.user!;

  const record = await prisma.guardAadhaarVerification.findFirst({
    where: { guardUserId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || record.verificationStatus !== 'otp_sent') {
    throw new HttpError(422, 'No OTP request found. Please request a new OTP.');
  }

  if (record.otpExpiresAt && record.otpExpiresAt.getTime() < Date.now()) {
    throw new HttpError(422, 'OTP has expired. Please request a new one.');
  }

  if (!record.otpHash || !(await verifyPassword(otp, record.otpHash))) {
    await prisma.guardAadhaarVerification.update({
      where: { id: record.id },
      data: { otpAttempts: { increment: 1 } },
    });
    throw new HttpError(422, 'Invalid OTP.');
  }

  await prisma.$transaction([
    prisma.guardAadhaarVerification.update({
      where: { id: record.id },
      data: { verificationStatus: 'verified', otpVerifiedAt: new Date() },
    }),
    prisma.guardProfile.updateMany({
      where: { userId: user.id },
      data: { aadhaarStatus: 'verified' },
    }),
  ]);

  const profile = await prisma.guardProfile.findUnique({ where: { userId: user.id } });
  return res.json(serializeGuardProfile(profile as unknown as Record<string, unknown>));
}
