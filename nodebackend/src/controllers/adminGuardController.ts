import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { hashPassword } from '../utils/password';
import { serializeUserRow } from '../serializers/userSerializer';

// Port of App\Http\Controllers\Admin\GuardController.

const guardSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'The mobile format is invalid.'),
  password: z.string().min(8).nullish(),
  gender: z.string().nullish(),
  dob: z.coerce.date().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  pincode: z.string().regex(/^\d{6}$/, 'The pincode format is invalid.').nullish(),
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
  skills: z.array(z.string()).nullish(),
  languages: z.array(z.string()).nullish(),
  experience: z.string().nullish(),
  verification_status: z.enum(['pending', 'verified', 'rejected']).nullish(),
  account_status: z.enum(['active', 'inactive', 'blocked', 'pending']).nullish(),
});

async function assertUnique(email: string | undefined, mobile: string | undefined, ignoreId?: string) {
  if (email) {
    const e = await prisma.user.findFirst({ where: { email, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (e) throw new HttpError(422, 'The email has already been taken.', { errors: { email: ['The email has already been taken.'] } });
  }
  if (mobile) {
    const m = await prisma.user.findFirst({ where: { mobile, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (m) throw new HttpError(422, 'The mobile has already been taken.', { errors: { mobile: ['The mobile has already been taken.'] } });
  }
}

function guardProfileWrite(d: Partial<z.infer<typeof guardSchema>>) {
  const out: Record<string, unknown> = {};
  const pass = (k: keyof typeof d, col: string, json = false) => {
    if (d[k] !== undefined) out[col] = json && d[k] !== null ? JSON.stringify(d[k]) : d[k];
  };
  pass('full_name', 'fullName');
  pass('mobile', 'mobile');
  pass('gender', 'gender');
  pass('dob', 'dob');
  pass('address', 'address');
  pass('city', 'city');
  pass('state', 'state');
  pass('pincode', 'pincode');
  pass('latitude', 'latitude');
  pass('longitude', 'longitude');
  pass('skills', 'skills', true);
  pass('languages', 'languages', true);
  pass('experience', 'experience');
  pass('verification_status', 'verificationStatus');
  return out;
}

/** GET /admin/guards */
export async function index(req: Request, res: Response) {
  const search = req.query.search as string | undefined;
  const accountStatus = req.query.account_status as string | undefined;

  const guards = await prisma.user.findMany({
    where: {
      role: 'guard',
      ...(accountStatus ? { accountStatus } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
              { mobile: { contains: search } },
            ],
          }
        : {}),
    },
    include: { guardProfile: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(guards.map((g) => serializeUserRow(g as unknown as Record<string, unknown>)));
}

/** POST /admin/guards */
export async function store(req: Request, res: Response) {
  const data = guardSchema.parse(req.body);
  await assertUnique(data.email, data.mobile ?? undefined);

  const tempPassword = data.password ?? crypto.randomBytes(9).toString('base64').slice(0, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: data.full_name,
        email: data.email,
        mobile: data.mobile,
        password: await hashPassword(tempPassword),
        role: 'guard',
        profileType: 'guard',
        accountStatus: data.account_status ?? 'active',
        emailVerifiedAt: new Date(),
      },
    });
    await tx.guardProfile.create({
      data: { userId: created.id, ...guardProfileWrite(data), verificationStatus: 'pending' } as never,
    });
    return created;
  });

  const withProfile = await prisma.user.findUnique({ where: { id: user.id }, include: { guardProfile: true } });
  return res.status(201).json({
    user: serializeUserRow(withProfile as unknown as Record<string, unknown>),
    temporary_password: data.password ? null : tempPassword,
  });
}

/** PATCH /admin/guards/:guard */
export async function update(req: Request, res: Response) {
  const guard = await prisma.user.findUnique({ where: { id: req.params.guard } });
  if (!guard || guard.role !== 'guard') throw new HttpError(404, 'Not an associate account.');

  const data = guardSchema.partial().parse(req.body);
  await assertUnique(data.email, data.mobile ?? undefined, guard.id);

  if (data.account_status === 'active') {
    const onboardingAgreement = await prisma.associatePartnerAgreement.findFirst({ where: { associatePartnerId: guard.id, currentKey: guard.id } });
    if (onboardingAgreement && (onboardingAgreement.status !== 'SIGNED' || !onboardingAgreement.productionVerified)) {
      throw new HttpError(409, 'Associate activation requires a production-verified digital agreement.', {
        code: onboardingAgreement.status === 'SANDBOX_SIGNED' ? 'sandbox_signature_not_accepted' : 'agreement_signature_required',
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    const userFields: Record<string, unknown> = {};
    if (data.full_name !== undefined) userFields.fullName = data.full_name;
    if (data.email !== undefined) userFields.email = data.email;
    if (data.mobile !== undefined) userFields.mobile = data.mobile;
    if (data.account_status !== undefined) userFields.accountStatus = data.account_status;
    if (Object.keys(userFields).length) {
      await tx.user.update({ where: { id: guard.id }, data: userFields });
    }

    const profileFields = guardProfileWrite(data);
    if (Object.keys(profileFields).length) {
      await tx.guardProfile.upsert({
        where: { userId: guard.id },
        create: { userId: guard.id, ...profileFields } as never,
        update: profileFields as never,
      });
    }
  });

  const fresh = await prisma.user.findUnique({ where: { id: guard.id }, include: { guardProfile: true } });
  return res.json(serializeUserRow(fresh as unknown as Record<string, unknown>));
}

/** DELETE /admin/guards/:guard */
export async function destroy(req: Request, res: Response) {
  const guard = await prisma.user.findUnique({ where: { id: req.params.guard } });
  if (!guard || guard.role !== 'guard') throw new HttpError(404, 'Not an associate account.');

  const applications = await prisma.jobApplication.findMany({ where: { guardUserId: guard.id }, select: { id: true } });
  const applicationIds = applications.map((application) => application.id);
  const tickets = await prisma.supportTicket.findMany({ where: { userId: guard.id }, select: { id: true } });
  const ticketIds = tickets.map((ticket) => ticket.id);

  await prisma.$transaction([
    ...(applicationIds.length ? [prisma.applicationStatusLog.deleteMany({ where: { applicationId: { in: applicationIds } } })] : []),
    prisma.interviewRequest.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.jobOffer.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.agreement.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.payment.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.attendanceRecord.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.jobApplication.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.guardDocument.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.guardAvailability.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.guardAadhaarVerification.deleteMany({ where: { guardUserId: guard.id } }),
    prisma.associatePartnerAgreementAudit.deleteMany({ where: { associatePartnerId: guard.id } }),
    prisma.associatePartnerAgreement.deleteMany({ where: { associatePartnerId: guard.id } }),
    ...(ticketIds.length ? [prisma.supportTicketMessage.deleteMany({ where: { ticketId: { in: ticketIds } } })] : []),
    prisma.supportTicket.deleteMany({ where: { userId: guard.id } }),
    prisma.notification.deleteMany({ where: { userId: guard.id } }),
    prisma.emailOtp.deleteMany({ where: { userId: guard.id } }),
    prisma.personalAccessToken.deleteMany({ where: { tokenableId: guard.id } }),
    prisma.guardProfile.deleteMany({ where: { userId: guard.id } }),
    prisma.user.delete({ where: { id: guard.id } }),
  ]);

  return res.json({ message: 'Associate deleted successfully.' });
}
