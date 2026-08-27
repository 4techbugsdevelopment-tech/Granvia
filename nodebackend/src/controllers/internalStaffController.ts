import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { hashPassword } from '../utils/password';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';

const staffSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  email: z.string().trim().email(),
  mobile: z.string().trim().min(8).max(20).nullish(),
  password: z.string().min(8).nullish(),
  role: z.enum(['operations', 'finance']),
  employer_user_id: z.string().uuid().nullish(),
  company_id: z.string().uuid().nullish(),
  site_id: z.string().uuid().nullish(),
  job_id: z.string().uuid().nullish(),
});

async function validateOperationsScope(data: z.infer<typeof staffSchema>, forcedEmployerId?: string) {
  if (data.role !== 'operations') return null;
  const employerId = forcedEmployerId ?? data.employer_user_id;
  if (!employerId) throw new HttpError(422, 'Employer scope is required for an Operations user.');
  const employer = await prisma.user.findFirst({ where: { id: employerId, role: 'employer' } });
  if (!employer) throw new HttpError(422, 'Select a valid Employer.');
  if (data.company_id) {
    const company = await prisma.employerCompany.findFirst({ where: { id: data.company_id, employerUserId: employerId } });
    if (!company) throw new HttpError(422, 'Company does not belong to the selected Employer.');
  }
  if (data.site_id) {
    const site = await prisma.companySite.findFirst({ where: { id: data.site_id, employerUserId: employerId } });
    if (!site) throw new HttpError(422, 'Site does not belong to the selected Employer.');
  }
  if (data.job_id) {
    const job = await prisma.jobPost.findFirst({ where: { id: data.job_id, employerUserId: employerId } });
    if (!job) throw new HttpError(422, 'Job does not belong to the selected Employer.');
  }
  return employerId;
}

async function createStaff(data: z.infer<typeof staffSchema>, forcedEmployerId?: string) {
  if (forcedEmployerId && data.role !== 'operations') throw new HttpError(403, 'Employers can create Operations users only.');
  const employerId = await validateOperationsScope(data, forcedEmployerId);
  const duplicate = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (duplicate) throw new HttpError(422, 'The email has already been taken.');
  const temporaryPassword = data.password ?? crypto.randomBytes(9).toString('base64url');
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: data.full_name,
        email: data.email.toLowerCase(),
        mobile: data.mobile ?? null,
        password: await hashPassword(temporaryPassword),
        role: data.role,
        profileType: data.role,
        accountStatus: 'active',
        emailVerifiedAt: new Date(),
      },
    });
    if (data.role === 'operations' && employerId) {
      await tx.operationsAssignment.create({
        data: {
          operationsUserId: created.id,
          employerUserId: employerId,
          companyId: data.company_id ?? null,
          siteId: data.site_id ?? null,
          jobId: data.job_id ?? null,
          permissions: JSON.stringify(['applications', 'hiring', 'attendance', 'agreements']),
        },
      });
    }
    return created;
  });
  return { user, temporaryPassword };
}

export async function adminIndex(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    where: { role: { in: ['operations', 'finance'] } },
    orderBy: { createdAt: 'desc' },
  });
  const assignments = await prisma.operationsAssignment.findMany({
    where: { operationsUserId: { in: users.map((user) => user.id) } },
  });
  return res.json({ users: snakeKeys(users.map(({ password: _password, ...user }) => user)), assignments: snakeKeys(assignments) });
}

export async function adminStore(req: Request, res: Response) {
  const result = await createStaff(staffSchema.parse(req.body));
  const { password: _password, ...safeUser } = result.user;
  return res.status(201).json({ user: snakeKeys(safeUser), temporary_password: result.temporaryPassword });
}

export async function employerIndex(req: Request, res: Response) {
  const assignments = await prisma.operationsAssignment.findMany({
    where: { employerUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: assignments.map((assignment) => assignment.operationsUserId) }, role: 'operations' },
  });
  return res.json({ users: snakeKeys(users.map(({ password: _password, ...user }) => user)), assignments: snakeKeys(assignments) });
}

export async function employerStore(req: Request, res: Response) {
  const data = staffSchema.omit({ role: true, employer_user_id: true }).extend({
    role: z.literal('operations').default('operations'),
  }).parse(req.body);
  const result = await createStaff({ ...data, employer_user_id: req.user!.id }, req.user!.id);
  const { password: _password, ...safeUser } = result.user;
  return res.status(201).json({ user: snakeKeys(safeUser), temporary_password: result.temporaryPassword });
}
