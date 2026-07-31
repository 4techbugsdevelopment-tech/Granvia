import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { env } from '../config/env';
import { hashPassword, verifyPassword } from '../utils/password';
import { issueToken, revokeToken } from '../utils/token';
import { HttpError } from '../utils/http';
import { signedVerifyUrl, verifyEmailSignature, emailHash } from '../utils/signing';
import { sendVerificationEmail, sendEmployerWelcome } from '../services/mailService';
import { meResponse } from '../serializers/userSerializer';

const frontend = () => env.frontendUrl.replace(/\/$/, '');

const ROLES = ['super_admin', 'employer', 'guard', 'sub_admin', 'sales_executive'] as const;

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

// --- handlers --------------------------------------------------------------

export async function registerEmployer(req: Request, res: Response) {
  const data = registerEmployerSchema.parse(req.body);
  await assertEmailAvailable(data.email);

  const user = await prisma.$transaction(async (tx) => {
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

  await sendVerificationEmail(user.email, data.contact_person_name, signedVerifyUrl(user.id, emailHash(user.email)));

  return res.status(201).json({
    message:
      'Registration submitted. Please verify your email address using the link sent to your inbox.',
    user: { id: user.id, email: user.email },
  });
}

export async function registerGuard(req: Request, res: Response) {
  const data = registerGuardSchema.parse(req.body);
  await assertEmailAvailable(data.email);

  const user = await prisma.$transaction(async (tx) => {
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

  await sendVerificationEmail(user.email, data.full_name, signedVerifyUrl(user.id, emailHash(user.email)));

  return res.status(201).json({
    message:
      'Registration submitted. Please verify your email address using the link sent to your inbox.',
    user: { id: user.id, email: user.email },
  });
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

  const token = await issueToken(user.id);
  const { employerProfile, guardProfile } = await loadProfiles(user.id, user.role);

  return res.json({
    token,
    ...meResponse(user as unknown as Record<string, unknown>, employerProfile, guardProfile),
  });
}

export async function logout(req: Request, res: Response) {
  if (req.bearerToken) {
    await revokeToken(req.bearerToken);
  }
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
      await sendVerificationEmail(user.email, user.fullName, signedVerifyUrl(user.id, emailHash(user.email)));
    }
  }
  // Do not reveal whether the account exists (matches Laravel).
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
      await sendEmployerWelcome(user.email, user.fullName, null, `${frontend()}/employer`);
    }
  }

  return res.redirect(`${frontend()}/email-verified`);
}
