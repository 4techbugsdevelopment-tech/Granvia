import crypto from 'crypto';
import { prisma } from '../prisma';
import { hashPassword, verifyPassword } from '../utils/password';
import { HttpError } from '../utils/http';
import { sendOtpEmail, mailConfigured } from './mailService';

// Reusable email-OTP core shared by signup verification, password reset,
// login 2FA and cash-payment confirmation. One row per issued code in the
// `email_otps` table; codes are hashed at rest and single-use.

export type OtpPurpose = 'signup_verification' | 'password_reset' | 'login_2fa' | 'cash_payment';

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function sixDigit(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Issues an OTP for (email, purpose[, referenceId]): invalidates any prior
 * unconsumed codes for the same scope, stores a hashed code, emails it, and
 * returns the row id. When SMTP is unconfigured, `dev_otp` is returned so the
 * flow is testable in dev (mirrors the existing guard-Aadhaar behaviour).
 */
export async function issueOtp(params: {
  email: string;
  purpose: OtpPurpose;
  userId?: string | null;
  referenceId?: string | null;
}): Promise<{ id: string; dev_otp?: string }> {
  const email = params.email.trim().toLowerCase();
  const otp = sixDigit();

  // Invalidate previous unconsumed codes for this scope.
  await prisma.emailOtp.updateMany({
    where: { email, purpose: params.purpose, referenceId: params.referenceId ?? null, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const record = await prisma.emailOtp.create({
    data: {
      email,
      userId: params.userId ?? null,
      purpose: params.purpose,
      referenceId: params.referenceId ?? null,
      otpHash: await hashPassword(otp),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });

  await sendOtpEmail(email, otp, params.purpose);

  return { id: record.id, ...(mailConfigured ? {} : { dev_otp: otp }) };
}

/**
 * Verifies an OTP for (email, purpose[, referenceId]). Throws HttpError(422)
 * on missing/expired/invalid/too-many-attempts. On success the code is marked
 * consumed and the row (incl. userId) is returned.
 */
export async function verifyOtp(params: {
  email: string;
  purpose: OtpPurpose;
  otp: string;
  referenceId?: string | null;
}) {
  const email = params.email.trim().toLowerCase();

  const record = await prisma.emailOtp.findFirst({
    where: { email, purpose: params.purpose, referenceId: params.referenceId ?? null, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new HttpError(422, 'No verification code found. Please request a new one.');
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new HttpError(422, 'Verification code has expired. Please request a new one.');
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    throw new HttpError(422, 'Too many attempts. Please request a new code.');
  }
  if (!(await verifyPassword(params.otp, record.otpHash))) {
    await prisma.emailOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(422, 'Invalid verification code.');
  }

  await prisma.emailOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return record;
}
