import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { hashPassword } from '../utils/password';
import { snakeKeys, serializeOut } from '../utils/serialize';
import { serializeUserRow } from '../serializers/userSerializer';
import { env } from '../config/env';
import { sendEmployerWelcome } from '../services/mailService';
import { urlFor } from '../utils/fileStorage';

// Port of App\Http\Controllers\Admin\EmployerController.

const emptyOptional = (schema: z.ZodString) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  schema.optional().nullable(),
);

const employerSchema = z.object({
  contact_person_name: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'The mobile format is invalid.'),
  email: z.string().email(),
  password: z.string().min(6).nullish(),
  city: z.string(),
  state: z.string(),
  pincode: z.string().regex(/^\d{6}$/, 'The pincode format is invalid.'),
  designation: z.string().nullish(),
  company_name: z.string().nullish(),
  company_address: z.string().nullish(),
  business_type: z.string().nullish(),
  gst_number: emptyOptional(z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, 'Enter a valid 15-character GST number.')),
  pan_number: emptyOptional(z.string().regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, 'Enter a valid PAN number (for example, ABCDE1234F).')),
  website: z.string().nullish(),
  account_status: z.enum(['active', 'inactive', 'blocked', 'pending']).nullish(),
});

const companyDocumentStatusSchema = z.object({
  status: z.enum(['verified', 'rejected', 'pending']),
  admin_remarks: z.string().nullish(),
});

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

async function assertUnique(email?: string, mobile?: string, ignoreId?: string) {
  if (email) {
    const e = await prisma.user.findFirst({ where: { email, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (e) throw new HttpError(422, 'The email has already been taken.', { errors: { email: ['The email has already been taken.'] } });
  }
  if (mobile) {
    const m = await prisma.user.findFirst({ where: { mobile, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (m) throw new HttpError(422, 'The mobile has already been taken.', { errors: { mobile: ['The mobile has already been taken.'] } });
  }
}

/** GET /admin/employers */
export async function index(_req: Request, res: Response) {
  const employers = await prisma.user.findMany({
    where: { role: 'employer' },
    include: { employerProfile: true, employerWallet: true },
    orderBy: { createdAt: 'desc' },
  });
  const employerIds = employers.map((e) => e.id);

  const companies = await prisma.employerCompany.findMany({ where: { employerUserId: { in: employerIds } } });
  const companyIds = companies.map((c) => c.id);

  const [documents, sites, jobs] = await Promise.all([
    prisma.companyDocument.findMany({ where: { companyId: { in: companyIds } }, orderBy: { createdAt: 'desc' } }),
    prisma.companySite.findMany({ where: { companyId: { in: companyIds } } }),
    prisma.jobPost.findMany({
      where: { employerUserId: { in: employerIds } },
      select: { id: true, employerUserId: true, companyId: true },
    }),
  ]);

  return res.json({
    employers: employers.map((e) => serializeUserRow(e as unknown as Record<string, unknown>)),
    companies: snakeKeys(companies),
    documents: documents.map((document) => ({
      ...snakeKeys(document),
      // Admins receive a newly signed link instead of the expired upload-time URL.
      download_url: urlFor('company-documents', document.filePath),
    })),
    sites: serializeOut(sites, ['address']),
    jobs: snakeKeys(jobs),
  });
}

/** POST /admin/employers */
export async function store(req: Request, res: Response) {
  const data = normalizeCodes(employerSchema.parse(req.body));
  await assertUnique(data.email, data.mobile);

  const tempPassword = data.password ?? crypto.randomBytes(9).toString('base64').slice(0, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: data.contact_person_name,
        email: data.email,
        mobile: data.mobile,
        password: await hashPassword(tempPassword),
        role: 'employer',
        profileType: 'employer',
        accountStatus: data.account_status ?? 'active',
        emailVerifiedAt: new Date(),
      },
    });
    await tx.employerProfile.create({
      data: {
        userId: created.id,
        contactPersonName: data.contact_person_name,
        designation: data.designation ?? null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        profileStatus: 'complete',
        verificationStatus: 'pending',
        createdFrom: 'super_admin',
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

  await sendEmployerWelcome(
    user.email,
    data.contact_person_name,
    tempPassword,
    `${env.frontendUrl.replace(/\/$/, '')}/employer`,
    auditFromRequest(req, 'admin_employer_welcome', { employer_user_id: user.id })
  );

  const withProfile = await prisma.user.findUnique({ where: { id: user.id }, include: { employerProfile: true } });
  return res.status(201).json({
    employer: serializeUserRow(withProfile as unknown as Record<string, unknown>),
    temporary_password: tempPassword,
  });
}

/** PATCH /admin/employers/:employer */
export async function update(req: Request, res: Response) {
  const employer = await prisma.user.findUnique({ where: { id: req.params.employer }, include: { employerProfile: true } });
  if (!employer || employer.role !== 'employer') throw new HttpError(404, 'Not an employer account.');

  const data = normalizeCodes(employerSchema.partial().parse(req.body));
  await assertUnique(data.email, data.mobile, employer.id);

  await prisma.$transaction(async (tx) => {
    const userFields: Record<string, unknown> = {};
    if (data.email !== undefined) userFields.email = data.email;
    if (data.mobile !== undefined) userFields.mobile = data.mobile;
    if (data.account_status !== undefined) userFields.accountStatus = data.account_status;
    if (data.contact_person_name !== undefined) userFields.fullName = data.contact_person_name;
    if (Object.keys(userFields).length) await tx.user.update({ where: { id: employer.id }, data: userFields });

    if (employer.employerProfile) {
      const pf: Record<string, unknown> = {};
      if (data.contact_person_name !== undefined) pf.contactPersonName = data.contact_person_name;
      if (data.designation !== undefined) pf.designation = data.designation;
      if (data.city !== undefined) pf.city = data.city;
      if (data.state !== undefined) pf.state = data.state;
      if (data.pincode !== undefined) pf.pincode = data.pincode;
      if (Object.keys(pf).length) await tx.employerProfile.update({ where: { userId: employer.id }, data: pf });
    }

    const company = await tx.employerCompany.findFirst({ where: { employerUserId: employer.id } });
    if (company) {
      const cf: Record<string, unknown> = {};
      if (data.company_name !== undefined) cf.companyName = data.company_name;
      if (data.business_type !== undefined) cf.businessType = data.business_type;
      if (data.gst_number !== undefined) cf.gstNumber = data.gst_number;
      if (data.pan_number !== undefined) cf.panNumber = data.pan_number;
      if (data.website !== undefined) cf.website = data.website;
      if (data.company_address !== undefined) cf.registeredAddress = data.company_address;
      if (data.city !== undefined) cf.city = data.city;
      if (data.state !== undefined) cf.state = data.state;
      if (data.pincode !== undefined) cf.pincode = data.pincode;
      if (Object.keys(cf).length) await tx.employerCompany.update({ where: { id: company.id }, data: cf });
    }
  });

  const fresh = await prisma.user.findUnique({ where: { id: employer.id }, include: { employerProfile: true } });
  return res.json(serializeUserRow(fresh as unknown as Record<string, unknown>));
}

/** DELETE /admin/employers/:employer */
export async function destroy(req: Request, res: Response) {
  const employer = await prisma.user.findUnique({ where: { id: req.params.employer } });
  if (!employer || employer.role !== 'employer') throw new HttpError(404, 'Not an employer account.');

  const [applications, tickets, subAdmins] = await Promise.all([
    prisma.jobApplication.findMany({ where: { employerUserId: employer.id }, select: { id: true } }),
    prisma.supportTicket.findMany({ where: { userId: employer.id }, select: { id: true } }),
    prisma.subAdminProfile.findMany({ where: { employerUserId: employer.id }, select: { userId: true } }),
  ]);
  const applicationIds = applications.map((row) => row.id);
  const ticketIds = tickets.map((row) => row.id);
  const subAdminIds = subAdmins.map((row) => row.userId);

  await prisma.$transaction([
    ...(applicationIds.length ? [prisma.applicationStatusLog.deleteMany({ where: { applicationId: { in: applicationIds } } })] : []),
    prisma.interviewRequest.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.jobOffer.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.agreement.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.attendanceRecord.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.payment.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.jobApplication.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.jobPost.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.companyDocument.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.companySite.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.employerCompany.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.invoice.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.walletTransaction.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.employerAadhaarVerification.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.discount.updateMany({ where: { employerUserId: employer.id }, data: { employerUserId: null } }),
    ...(ticketIds.length ? [prisma.supportTicketMessage.deleteMany({ where: { ticketId: { in: ticketIds } } })] : []),
    prisma.supportTicket.deleteMany({ where: { userId: employer.id } }),
    prisma.notification.deleteMany({ where: { userId: employer.id } }),
    prisma.emailOtp.deleteMany({ where: { userId: employer.id } }),
    prisma.personalAccessToken.deleteMany({ where: { tokenableId: employer.id } }),
    prisma.staffMember.deleteMany({ where: { subAdminUserId: { in: [employer.id, ...subAdminIds] } } }),
    ...(subAdminIds.length ? [
      prisma.guardProfile.updateMany({ where: { subAdminId: { in: subAdminIds } }, data: { subAdminId: null } }),
      prisma.personalAccessToken.deleteMany({ where: { tokenableId: { in: subAdminIds } } }),
      prisma.notification.deleteMany({ where: { userId: { in: subAdminIds } } }),
      prisma.emailOtp.deleteMany({ where: { userId: { in: subAdminIds } } }),
      prisma.subAdminProfile.deleteMany({ where: { userId: { in: subAdminIds } } }),
      prisma.user.deleteMany({ where: { id: { in: subAdminIds } } }),
    ] : []),
    prisma.employerWallet.deleteMany({ where: { employerUserId: employer.id } }),
    prisma.employerProfile.deleteMany({ where: { userId: employer.id } }),
    prisma.user.delete({ where: { id: employer.id } }),
  ]);

  return res.json({ message: 'Employer deleted successfully.' });
}

/** PATCH /admin/company-documents/:document */
export async function updateCompanyDocumentStatus(req: Request, res: Response) {
  const document = await prisma.companyDocument.findUnique({ where: { id: req.params.document } });
  if (!document) throw new HttpError(404, 'Company document not found.');

  const data = companyDocumentStatusSchema.parse(req.body);
  const updated = await prisma.companyDocument.update({
    where: { id: document.id },
    data: {
      verificationStatus: data.status,
      ...(data.admin_remarks !== undefined ? { adminRemarks: data.admin_remarks } : {}),
      ...(data.status === 'rejected' ? { rejectionReason: data.admin_remarks ?? null } : { rejectionReason: null }),
    },
  });

  return res.json({
    ...snakeKeys(updated),
    download_url: urlFor('company-documents', updated.filePath),
  });
}

function normalizeCodes<T extends { gst_number?: string | null; pan_number?: string | null }>(d: T): T {
  if (d.gst_number) d.gst_number = d.gst_number.toUpperCase();
  if (d.pan_number) d.pan_number = d.pan_number.toUpperCase();
  return d;
}
