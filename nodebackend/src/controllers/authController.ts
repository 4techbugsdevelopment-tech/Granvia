import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { env } from '../config/env';
import { hashPassword, verifyPassword } from '../utils/password';
import { issueToken, revokeToken } from '../utils/token';
import { HttpError } from '../utils/http';
import { signedVerifyUrl, verifyEmailSignature, emailHash } from '../utils/signing';
import { sendVerificationEmail, sendEmployerWelcome, sendSmtpTestEmail, sendNewUserRegistrationAlert } from '../services/mailService';
import { issueOtp, verifyOtp } from '../services/otpService';
import { meResponse } from '../serializers/userSerializer';

const frontend = () => env.frontendUrl.replace(/\/$/, '');

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

const ROLES = ['super_admin', 'employer', 'guard', 'sub_admin', 'sales_executive', 'operations', 'finance'] as const;

// --- validation (mirrors App\Http\Requests\Auth\*) -------------------------

const registerEmployerSchema = z.object({
  contact_person_name: z.string().min(1),
  mobile: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  company_name: z.string().optional(),
  business_type: z.string().optional(),
  company_address: z.string().optional(),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
  website: z.string().optional(),
});

const registerGuardSchema = z.object({
  full_name: z.string().min(1),
  mobile: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  gender: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Optional: when omitted (e.g. the universal mobile app) the account's own
  // role is used. When provided (portal logins) it is enforced as a guard.
  role: z.enum(ROLES).optional(),
});

// --- helpers ---------------------------------------------------------------

async function loadProfiles(userId: string, role: string) {
  const employerProfile =
    role === 'employer'
      ? await prisma.employerProfile.findUnique({ where: { userId } })
      : null;
  const guardProfile =
    role === 'guard' ? await prisma.guardProfile.findUnique({ where: { userId } }) : null;
  return { employerProfile, guardProfile };
}

async function assertEmailAvailable(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(422, 'The email has already been taken.', {
      errors: { email: ['The email has already been taken.'] },
    });
  }
}

async function assertMobileAvailable(mobile: string) {
  const existing = await prisma.user.findFirst({ where: { mobile } });
  if (existing) {
    throw new HttpError(422, 'The mobile has already been taken.', {
      errors: { mobile: ['The mobile has already been taken.'] },
    });
  }
}

function uniqueViolationToHttpError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  if (code !== 'P2002') return null;

  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  if (fields.some((field) => field.includes('mobile'))) {
    return new HttpError(422, 'The mobile has already been taken.', {
      errors: { mobile: ['The mobile has already been taken.'] },
    });
  }
  if (fields.some((field) => field.includes('email'))) {
    return new HttpError(422, 'The email has already been taken.', {
      errors: { email: ['The email has already been taken.'] },
    });
  }

  return new HttpError(422, 'The given data conflicts with an existing record.');
}

// --- handlers --------------------------------------------------------------

export async function registerEmployer(req: Request, res: Response) {
  const data = registerEmployerSchema.parse(req.body);
  await assertEmailAvailable(data.email);
  await assertMobileAvailable(data.mobile);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: data.contact_person_name,
          email: data.email,
          mobile: data.mobile,
          password: await hashPassword(data.password),
          role: 'employer',
          profileType: 'employer',
          accountStatus: 'active',
        },
      });

      await tx.employerProfile.create({
        data: {
          userId: created.id,
          contactPersonName: data.contact_person_name,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          profileStatus: 'incomplete',
          verificationStatus: 'pending',
          createdFrom: 'app',
        },
      });

      if (data.company_name) {
        await tx.employerCompany.create({
          data: {
            employerUserId: created.id,
            companyName: data.company_name,
            businessType: data.business_type ?? null,
            gstNumber: data.gst_number ?? null,
            panNumber: data.pan_number ?? null,
            website: data.website ?? null,
            registeredAddress: data.company_address ?? null,
            city: data.city,
            state: data.state,
            pincode: data.pincode,
            verificationStatus: 'pending',
            accountStatus: 'active',
          },
        });
      }

      return created;
    });
  } catch (err) {
    const mapped = uniqueViolationToHttpError(err);
    if (mapped) throw mapped;
    throw err;
  }

  const otpAudit = auditFromRequest(req, 'signup_verification_employer', {
    registration_role: 'employer',
  });
  const otp = await issueOtp({ email: user.email, purpose: 'signup_verification', userId: user.id, audit: otpAudit });
  const alertAudit = auditFromRequest(req, 'admin_registration_alert_employer', {
    registration_role: 'employer',
  });
  await sendNewUserRegistrationAlert({
    role: 'employer',
    name: String(user.fullName ?? user.email ?? 'New user'),
    email: String(user.email ?? ''),
    mobile: String(user.mobile ?? ''),
  }, alertAudit);

  return res.status(201).json({
    message: 'Registration submitted. Enter the verification code sent to your email to activate your account.',
    user: { id: user.id, email: user.email },
    ...(otp.dev_otp ? { dev_otp: otp.dev_otp } : {}),
  });
}

export async function registerGuard(req: Request, res: Response) {
  const data = registerGuardSchema.parse(req.body);
  await assertEmailAvailable(data.email);
  await assertMobileAvailable(data.mobile);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: data.full_name,
          email: data.email,
          mobile: data.mobile,
          password: await hashPassword(data.password),
          role: 'guard',
          profileType: 'guard',
          accountStatus: 'active',
        },
      });

      await tx.guardProfile.create({
        data: {
          userId: created.id,
          fullName: data.full_name,
          mobile: data.mobile,
          gender: data.gender ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          pincode: data.pincode ?? null,
          verificationStatus: 'pending',
        },
      });

      return created;
    });
  } catch (err) {
    const mapped = uniqueViolationToHttpError(err);
    if (mapped) throw mapped;
    throw err;
  }

  const otpAudit = auditFromRequest(req, 'signup_verification_guard', {
    registration_role: 'guard',
  });
  const otp = await issueOtp({ email: user.email, purpose: 'signup_verification', userId: user.id, audit: otpAudit });
  const alertAudit = auditFromRequest(req, 'admin_registration_alert_guard', {
    registration_role: 'guard',
  });
  await sendNewUserRegistrationAlert({
    role: 'guard',
    name: String(user.fullName ?? user.email ?? 'New user'),
    email: String(user.email ?? ''),
    mobile: String(user.mobile ?? ''),
  }, alertAudit);

  return res.status(201).json({
    message: 'Registration submitted. Enter the verification code sent to your email to activate your account.',
    user: { id: user.id, email: user.email },
    ...(otp.dev_otp ? { dev_otp: otp.dev_otp } : {}),
  });
}

/** POST /auth/email/verify-otp — activate account with the signup code. */
export async function verifyEmailOtp(req: Request, res: Response) {
  const schema = z.object({ email: z.string().email(), otp: z.string().min(4) });
  const { email, otp } = schema.parse(req.body);

  await verifyOtp({ email, purpose: 'signup_verification', otp });

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new HttpError(422, 'Account not found.');

  if (!user.emailVerifiedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    if (user.role === 'employer') {
      await sendEmployerWelcome(user.email, user.fullName, null, `${frontend()}/employer`, auditFromRequest(req, 'email_verification_employer', { user_id: user.id }));
    }
  }

  return res.json({ message: 'Email verified. You can now sign in.' });
}

/** POST /auth/email/resend-otp — reissue the signup verification code. */
export async function resendEmailOtp(req: Request, res: Response) {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  let dev_otp: string | undefined;
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      const otp = await issueOtp({
        email: user.email,
        purpose: 'signup_verification',
        userId: user.id,
        audit: auditFromRequest(req, 'signup_verification_resend', { user_id: user.id }),
      });
      dev_otp = otp.dev_otp;
    }
  }
  // Do not reveal whether the account exists.
  return res.json({ message: 'If an account needs verification, a code has been sent.', ...(dev_otp ? { dev_otp } : {}) });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await verifyPassword(data.password, user.password))) {
    throw new HttpError(422, 'Invalid credentials.');
  }

  if (data.role && user.role !== data.role) {
    throw new HttpError(403, 'This account is not registered for this portal.');
  }

  if (user.accountStatus === 'blocked' || user.accountStatus === 'inactive') {
    throw new HttpError(403, `Your account is ${user.accountStatus}. Contact support.`);
  }

  if (env.enforceEmailVerification && !user.emailVerifiedAt) {
    // Do not reissue here (would invalidate the code already sent at signup and
    // is abusable). The client redirects to the verify screen and can resend.
    throw new HttpError(403, 'Please verify your email to continue. Check your inbox for the code.', {
      code: 'email_unverified',
      email: user.email,
    });
  }

  // Second factor: issue a login OTP and defer the token until it is verified.
  if (env.loginOtpEnabled) {
    const otp = await issueOtp({
      email: user.email,
      purpose: 'login_2fa',
      userId: user.id,
      audit: auditFromRequest(req, 'login_2fa', { user_id: user.id }),
    });
    return res.json({ requires_otp: true, email: user.email, ...(otp.dev_otp ? { dev_otp: otp.dev_otp } : {}) });
  }

  const token = await issueToken(user.id);
  const { employerProfile, guardProfile } = await loadProfiles(user.id, user.role);

  return res.json({
    token,
    ...meResponse(user as unknown as Record<string, unknown>, employerProfile, guardProfile),
  });
}

/** POST /auth/login/verify-otp — completes a 2FA login and issues the token. */
export async function loginVerifyOtp(req: Request, res: Response) {
  const schema = z.object({
    email: z.string().email(),
    otp: z.string().min(4),
    role: z.enum(ROLES).optional(),
  });
  const data = schema.parse(req.body);

  await verifyOtp({ email: data.email, purpose: 'login_2fa', otp: data.otp });

  const user = await prisma.user.findUnique({ where: { email: data.email.trim().toLowerCase() } });
  if (!user) throw new HttpError(422, 'Account not found.');
  if (data.role && user.role !== data.role) {
    throw new HttpError(403, 'This account is not registered for this portal.');
  }
  if (user.accountStatus === 'blocked' || user.accountStatus === 'inactive') {
    throw new HttpError(403, `Your account is ${user.accountStatus}. Contact support.`);
  }

  const token = await issueToken(user.id);
  const { employerProfile, guardProfile } = await loadProfiles(user.id, user.role);

  return res.json({
    token,
    ...meResponse(user as unknown as Record<string, unknown>, employerProfile, guardProfile),
  });
}

/** POST /auth/password/request-otp — sends a password reset code. */
export async function requestPasswordOtp(req: Request, res: Response) {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  let dev_otp: string | undefined;
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const otp = await issueOtp({
        email: user.email,
        purpose: 'password_reset',
        userId: user.id,
        audit: auditFromRequest(req, 'password_reset', { user_id: user.id }),
      });
      dev_otp = otp.dev_otp;
    }
  }
  // Do not reveal whether the account exists.
  return res.json({ message: 'If an account exists, a reset code has been sent.', ...(dev_otp ? { dev_otp } : {}) });
}

/** POST /auth/password/reset — verifies the code and sets a new password. */
export async function resetPassword(req: Request, res: Response) {
  const schema = z.object({
    email: z.string().email(),
    otp: z.string().min(4),
    password: z.string().min(8),
  });
  const data = schema.parse(req.body);

  const record = await verifyOtp({ email: data.email, purpose: 'password_reset', otp: data.otp });

  const user = await prisma.user.findUnique({ where: { id: record.userId ?? '' } });
  if (!user) throw new HttpError(422, 'Account not found.');

  await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(data.password) } });
  // Revoke all existing sessions so only the new password grants access.
  await prisma.personalAccessToken.deleteMany({ where: { tokenableId: user.id } });

  return res.json({ message: 'Password updated. You can now sign in with your new password.' });
}

/** POST /auth/test-email â€” sends a direct SMTP test mail and returns the provider response. */
export async function testEmail(req: Request, res: Response) {
  const schema = z.object({ email: z.string().email() });
  const { email } = schema.parse(req.body);
  const report = await sendSmtpTestEmail(email.trim().toLowerCase(), auditFromRequest(req, 'smtp_test', { target_email: email.trim().toLowerCase() }));

  return res.status(report.error ? 502 : 200).json({
    ok: !report.error,
    message: report.error
      ? 'SMTP test failed.'
      : 'SMTP test email sent.',
    report,
  });
}

export async function logout(req: Request, res: Response) {
  const authorization = req.header('authorization') ?? '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (token) await revokeToken(token);
  return res.json({ message: 'Logged out.' });
}

export async function me(req: Request, res: Response) {
  const user = req.user!;
  const { employerProfile, guardProfile } = await loadProfiles(user.id, user.role);
  return res.json(
    meResponse(user as unknown as Record<string, unknown>, employerProfile, guardProfile)
  );
}

export async function resendVerification(req: Request, res: Response) {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      await sendVerificationEmail(user.email, user.fullName, signedVerifyUrl(user.id, emailHash(user.email)), auditFromRequest(req, 'email_verification', { user_id: user.id }));
    }
  }
  // Do not reveal whether the account exists.
  return res.json({ message: 'If an account exists, a verification link has been sent.' });
}

/** GET /email/verify/:id/:hash — signed link from the verification email. */
export async function verifyEmail(req: Request, res: Response) {
  const { id, hash } = req.params;
  const expires = Number(req.query.expires);
  const signature = String(req.query.signature ?? '');

  if (!verifyEmailSignature(id, hash, expires, signature)) {
    return res.status(403).send('Invalid or expired verification link.');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || emailHash(user.email) !== hash) {
    return res.status(403).send('Invalid verification link.');
  }

  if (!user.emailVerifiedAt) {
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
    if (user.role === 'employer') {
      await sendEmployerWelcome(user.email, user.fullName, null, `${frontend()}/employer`, auditFromRequest(req, 'email_verification_employer', { user_id: user.id }));
    }
  }

  return res.redirect(`${frontend()}/email-verified`);
}
