import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { hashPassword } from '../utils/password';
import { parseJsonField, snakeKeys } from '../utils/serialize';
import { generateStrongPassword, strongPasswordSchema } from '../utils/validation';

async function activeRole(roleId?: string | null, roleName?: string | null) {
  if (roleId) {
    const byId = await prisma.role.findUnique({ where: { id: roleId } });
    if (!byId || byId.status !== 'active') throw new HttpError(422, 'The selected role is not available.');
    return byId;
  }

  const name = String(roleName ?? '').trim();
  if (!name) throw new HttpError(422, 'The selected role is required.');
  const byName = await prisma.role.findFirst({ where: { name, status: 'active' } });
  if (!byName) throw new HttpError(422, 'The selected role is not available.');
  return byName;
}

async function uniqueEmailMobile(email?: string, mobile?: string, ignoreId?: string) {
  if (email) {
    const where = ignoreId ? { email, NOT: { id: ignoreId } } : { email };
    const found = await prisma.user.findFirst({ where });
    if (found) throw new HttpError(422, 'The email has already been taken.');
  }
  if (mobile) {
    const where = ignoreId ? { mobile, NOT: { id: ignoreId } } : { mobile };
    const found = await prisma.user.findFirst({ where });
    if (found) throw new HttpError(422, 'The mobile has already been taken.');
  }
}

const staffSchema = z.object({
  name: z.string().min(2),
  role_id: z.string().uuid(),
  role: z.string().min(2).nullish(),
  company_id: z.string().uuid(),
  email: z.string().email(),
  mobile: z.string().min(10),
  password: strongPasswordSchema.nullish(),
  status: z.enum(['Active', 'Inactive']).nullish(),
});

function shapeStaff(row: Record<string, any>) {
  const permissions = parseJsonField(row.roleMaster?.permissions ?? row.permissions ?? '[]');
  return {
    ...row,
    role: row.roleMaster?.name ?? row.role,
    role_id: row.roleId ?? row.roleMaster?.id ?? null,
    user_id: row.userId ?? null,
    employer_user_id: row.employerUserId ?? null,
    company_id: row.companyId ?? null,
    company_name: row.company?.companyName ?? null,
    login_status: row.user?.accountStatus ?? null,
    permissions: Array.isArray(permissions) ? permissions : [],
  };
}

function companyPermissions(role: { permissions: string | null }) {
  const parsed = parseJsonField(role.permissions ?? '[]');
  return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string' && value.startsWith('Company ')) : [];
}

async function assignedEmployerCompany(employerUserId: string, companyId: string) {
  const company = await prisma.employerCompany.findFirst({ where: { id: companyId, employerUserId, accountStatus: 'active' } });
  if (!company) throw new HttpError(422, 'Select one of your active companies.');
  return company;
}

/** GET /employer/staff */
export async function listStaff(req: Request, res: Response) {
  const rows = await prisma.staffMember.findMany({
    where: { subAdminUserId: req.user!.id },
    include: { roleMaster: true, company: true, user: { select: { accountStatus: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(shapeStaffList(rows));
}

/** POST /employer/staff */
export async function storeStaff(req: Request, res: Response) {
  const data = staffSchema.parse(req.body);
  const role = await activeRole(data.role_id, data.role);
  if (!companyPermissions(role).length) throw new HttpError(422, 'Select a role with at least one Company department permission.');
  await assignedEmployerCompany(req.user!.id, data.company_id);
  await uniqueEmailMobile(data.email, data.mobile);
  const temporaryPassword = data.password ?? generateStrongPassword(12);
  const created = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: {
      fullName: data.name, email: data.email.trim().toLowerCase(), mobile: data.mobile.trim(),
      password: await hashPassword(temporaryPassword), role: 'employer_employee', profileType: 'employer_employee',
      accountStatus: data.status === 'Inactive' ? 'inactive' : 'active', emailVerifiedAt: new Date(),
    } });
    return tx.staffMember.create({ data: {
      name: data.name, email: data.email.trim().toLowerCase(), mobile: data.mobile.trim(), status: data.status ?? 'Active',
      role: role.name, roleId: role.id, subAdminUserId: req.user!.id, employerUserId: req.user!.id,
      companyId: data.company_id, userId: user.id,
    } });
  });
  const withRole = await prisma.staffMember.findUnique({ where: { id: created.id }, include: { roleMaster: true, company: true, user: { select: { accountStatus: true } } } });
  return res.status(201).json({ staff: shapeStaff(withRole as unknown as Record<string, any>), temporary_password: temporaryPassword });
}

/** PATCH /employer/staff/:staff */
export async function updateStaff(req: Request, res: Response) {
  const member = await prisma.staffMember.findUnique({ where: { id: req.params.staff } });
  if (!member) throw new HttpError(404, 'Not found.');
  if (member.subAdminUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = staffSchema.partial().parse(req.body);
  const role = data.role_id || data.role ? await activeRole(data.role_id ?? null, data.role ?? null) : null;
  if (role && !companyPermissions(role).length) throw new HttpError(422, 'Select a role with at least one Company department permission.');
  const companyId = data.company_id ?? member.companyId;
  if (!companyId) throw new HttpError(422, 'Select a company.');
  await assignedEmployerCompany(req.user!.id, companyId);
  if (data.email || data.mobile) await uniqueEmailMobile(data.email, data.mobile, member.userId ?? undefined);
  const generatedPassword = !member.userId ? data.password ?? generateStrongPassword(12) : null;
  const updated = await prisma.$transaction(async tx => {
    let userId = member.userId;
    if (!userId) {
      if (!data.email || !data.mobile) throw new HttpError(422, 'Email and mobile are required to activate this legacy staff record.');
      const user = await tx.user.create({ data: {
        fullName: data.name ?? member.name, email: data.email.trim().toLowerCase(), mobile: data.mobile.trim(),
        password: await hashPassword(generatedPassword!), role: 'employer_employee', profileType: 'employer_employee',
        accountStatus: (data.status ?? member.status) === 'Inactive' ? 'inactive' : 'active', emailVerifiedAt: new Date(),
      } });
      userId = user.id;
    } else {
      const userData: Record<string, unknown> = {};
      if (data.name !== undefined) userData.fullName = data.name;
      if (data.email !== undefined) userData.email = data.email.trim().toLowerCase();
      if (data.mobile !== undefined) userData.mobile = data.mobile.trim();
      if (data.status !== undefined) userData.accountStatus = data.status === 'Active' ? 'active' : 'inactive';
      if (data.password) userData.password = await hashPassword(data.password);
      if (Object.keys(userData).length) await tx.user.update({ where: { id: userId }, data: userData });
      if (data.password || data.status === 'Inactive') await tx.personalAccessToken.deleteMany({ where: { tokenableId: userId } });
    }
    return tx.staffMember.update({ where: { id: member.id }, data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
      ...(data.mobile !== undefined ? { mobile: data.mobile.trim() } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(role ? { role: role.name, roleId: role.id } : {}),
      employerUserId: req.user!.id, companyId, userId,
    } });
  });
  const withRole = await prisma.staffMember.findUnique({ where: { id: updated.id }, include: { roleMaster: true, company: true, user: { select: { accountStatus: true } } } });
  return res.json({ staff: shapeStaff(withRole as unknown as Record<string, any>), temporary_password: generatedPassword });
}

/** DELETE /employer/staff/:staff */
export async function destroyStaff(req: Request, res: Response) {
  const member = await prisma.staffMember.findUnique({ where: { id: req.params.staff } });
  if (!member) throw new HttpError(404, 'Not found.');
  if (member.subAdminUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');
  await prisma.$transaction(async tx => {
    await tx.staffMember.update({ where: { id: member.id }, data: { status: 'Inactive' } });
    if (member.userId) {
      await tx.personalAccessToken.deleteMany({ where: { tokenableId: member.userId } });
      await tx.user.update({ where: { id: member.userId }, data: { accountStatus: 'inactive' } });
    }
  });
  return res.json({ message: 'Staff access archived and login revoked.' });
}

const subAdminSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().nullish(),
  password: strongPasswordSchema.nullish(),
  branch_name: z.string().nullish(),
  status: z.enum(['active', 'inactive']).nullish(),
});

/** GET /employer/subadmins */
export async function listSubAdmins(req: Request, res: Response) {
  const rows = await prisma.user.findMany({
    where: { role: 'sub_admin', subAdminProfile: { employerUserId: req.user!.id } },
    include: { subAdminProfile: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(
    rows.map((row) => ({
      id: row.id,
      full_name: row.fullName,
      email: row.email,
      mobile: row.mobile,
      account_status: row.accountStatus,
      branch_name: row.subAdminProfile?.branchName ?? '',
      contact_email: row.subAdminProfile?.contactEmail ?? row.email,
      phone: row.subAdminProfile?.phone ?? row.mobile,
      employer_user_id: row.subAdminProfile?.employerUserId ?? null,
    }))
  );
}

/** POST /employer/subadmins */
export async function storeSubAdmin(req: Request, res: Response) {
  const data = subAdminSchema.parse(req.body);
  await uniqueEmailMobile(data.email, data.mobile ?? undefined);

  const tempPassword = data.password ?? generateStrongPassword(12);
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: data.full_name,
        email: data.email.trim().toLowerCase(),
        mobile: data.mobile?.trim() || null,
        password: await hashPassword(tempPassword),
        role: 'sub_admin',
        profileType: 'sub_admin',
        accountStatus: data.status ?? 'active',
        emailVerifiedAt: new Date(),
      },
    });

    await tx.subAdminProfile.create({
      data: {
        userId: user.id,
        employerUserId: req.user!.id,
        branchName: data.branch_name?.trim() || `${data.full_name} Team`,
        contactEmail: data.email.trim().toLowerCase(),
        phone: data.mobile?.trim() || null,
      },
    });

    return user;
  });

  return res.status(201).json({
    sub_admin: snakeKeys(created),
    temporary_password: tempPassword,
  });
}

/** PATCH /employer/subadmins/:subAdmin */
export async function updateSubAdmin(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.params.subAdmin }, include: { subAdminProfile: true } });
  if (!user || user.role !== 'sub_admin') throw new HttpError(404, 'Sub admin not found.');
  if (user.subAdminProfile?.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = subAdminSchema.partial().parse(req.body);
  if (data.email || data.mobile) await uniqueEmailMobile(data.email ?? undefined, data.mobile ?? undefined, user.id);

  await prisma.$transaction(async (tx) => {
    const userData: Record<string, unknown> = {};
    if (data.full_name !== undefined) userData.fullName = data.full_name;
    if (data.email !== undefined) userData.email = data.email.trim().toLowerCase();
    if (data.mobile !== undefined) userData.mobile = data.mobile?.trim() || null;
    if (data.status !== undefined) userData.accountStatus = data.status;
    if (Object.keys(userData).length) await tx.user.update({ where: { id: user.id }, data: userData });

    if (user.subAdminProfile) {
      const profileData: Record<string, unknown> = {};
      if (data.branch_name !== undefined) profileData.branchName = data.branch_name?.trim() || `${data.full_name ?? user.fullName} Team`;
      if (data.email !== undefined) profileData.contactEmail = data.email.trim().toLowerCase();
      if (data.mobile !== undefined) profileData.phone = data.mobile?.trim() || null;
      if (Object.keys(profileData).length) await tx.subAdminProfile.update({ where: { id: user.subAdminProfile.id }, data: profileData });
    }
  });

  const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: { subAdminProfile: true } });
  return res.json(
    fresh
      ? {
          id: fresh.id,
          full_name: fresh.fullName,
          email: fresh.email,
          mobile: fresh.mobile,
          account_status: fresh.accountStatus,
          branch_name: fresh.subAdminProfile?.branchName ?? '',
          contact_email: fresh.subAdminProfile?.contactEmail ?? fresh.email,
          phone: fresh.subAdminProfile?.phone ?? fresh.mobile,
          employer_user_id: fresh.subAdminProfile?.employerUserId ?? null,
        }
      : null
  );
}

/** DELETE /employer/subadmins/:subAdmin */
export async function destroySubAdmin(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.params.subAdmin }, include: { subAdminProfile: true } });
  if (!user || user.role !== 'sub_admin') throw new HttpError(404, 'Sub admin not found.');
  if (user.subAdminProfile?.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  await prisma.$transaction(async (tx) => {
    await tx.subAdminProfile.deleteMany({ where: { userId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });

  return res.json({ message: 'Sub admin removed.' });
}

function shapeStaffList(rows: Array<Record<string, any>>) {
  return rows.map(shapeStaff);
}
