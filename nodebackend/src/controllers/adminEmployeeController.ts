import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { hashPassword } from '../utils/password';
import { humanNameSchema, indianMobileSchema, normalizedEmailSchema, strongPasswordSchema } from '../utils/validation';
import { ADMIN_EMPLOYEE_MODULES, parseAdminPermissions } from '../utils/adminEmployeeAccess';

const roleSchema = z.object({
  name: z.string().trim().min(2).max(150), description: z.string().trim().max(2000).nullable().optional(),
  permissions: z.array(z.enum(ADMIN_EMPLOYEE_MODULES)), status: z.enum(['active', 'inactive']),
});
const employeeSchema = z.object({
  full_name: humanNameSchema('Full name'), email: normalizedEmailSchema,
  mobile: indianMobileSchema, role_id: z.string().uuid(),
  account_status: z.enum(['active', 'inactive', 'blocked']), password: strongPasswordSchema,
  employer_ids: z.array(z.string().uuid()).max(500).optional(),
});
const ownerId = (req: Request) => req.user!.id;
const roleOut = (role: { permissions: string } & Record<string, any>) => ({ ...role, permissions: parseAdminPermissions(role.permissions) });
function conflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new HttpError(422, 'This name, email, or mobile is already in use.');
  throw error;
}
async function ownedRole(id: string, ownerUserId: string, active = false) {
  const role = await prisma.adminEmployeeRole.findFirst({ where: { id, ownerUserId, ...(active ? { status: 'active' } : {}) } });
  if (!role) throw new HttpError(422, 'Select an available Super Admin role.');
  return role;
}
async function ownedEmployee(req: Request) {
  const employee = await prisma.adminEmployee.findFirst({ where: { id: req.params.employee, ownerUserId: ownerId(req) } });
  if (!employee) throw new HttpError(404, 'Employee not found.');
  return employee;
}
export async function roles(req: Request, res: Response) {
  const rows = await prisma.adminEmployeeRole.findMany({ where: { ownerUserId: ownerId(req) }, orderBy: { name: 'asc' } });
  return res.json(rows.map(roleOut));
}
export async function saveRole(req: Request, res: Response) {
  const data = roleSchema.parse(req.body);
  if (data.permissions.some(p => p.startsWith('Company ')) && data.permissions.some(p => !p.startsWith('Company '))) {
    throw new HttpError(422, 'Company department roles must use only Company permissions. Create a separate role for platform-wide administration.');
  }
  if (req.params.role) await ownedRole(req.params.role, ownerId(req));
  try {
    const payload = { ...data, permissions: JSON.stringify([...new Set(data.permissions)]) };
    const role = req.params.role
      ? await prisma.adminEmployeeRole.update({ where: { id: req.params.role }, data: payload })
      : await prisma.adminEmployeeRole.create({ data: { ...payload, ownerUserId: ownerId(req) } });
    return res.status(req.params.role ? 200 : 201).json(roleOut(role));
  } catch (error) { conflict(error); }
}
export async function deleteRole(req: Request, res: Response) {
  await ownedRole(req.params.role, ownerId(req));
  if (await prisma.adminEmployee.count({ where: { roleId: req.params.role } })) throw new HttpError(422, 'Reassign employees before deleting this role.');
  try { await prisma.adminEmployeeRole.delete({ where: { id: req.params.role } }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw new HttpError(422, 'Reassign employees before deleting this role.');
    throw error;
  }
  return res.json({ message: 'Role deleted.' });
}
export async function employees(req: Request, res: Response) {
  const rows = await prisma.adminEmployee.findMany({
    where: { ownerUserId: ownerId(req) }, include: { role: true, employerAssignments: { select: { employerUserId: true } }, user: { select: { fullName: true, email: true, mobile: true, accountStatus: true } } }, orderBy: { createdAt: 'desc' },
  });
  res.set('Cache-Control', 'no-store');
  return res.json(rows.map(row => ({ id: row.id, full_name: row.user.fullName, email: row.user.email, mobile: row.user.mobile, account_status: row.user.accountStatus, role_id: row.roleId, role_name: row.role.name, role_status: row.role.status, permissions: parseAdminPermissions(row.role.permissions), employer_ids: row.employerAssignments.map(item => item.employerUserId) })));
}
export async function saveEmployee(req: Request, res: Response) {
  const existing = req.params.employee ? await ownedEmployee(req) : null;
  const data = (existing ? employeeSchema.omit({ password: true }).extend({ password: strongPasswordSchema.optional() }) : employeeSchema).parse(req.body);
  await ownedRole(data.role_id, ownerId(req), true);
  const employerIds = [...new Set(data.employer_ids ?? [])];
  const replaceEmployerAssignments = data.employer_ids !== undefined;
  if (employerIds.length) {
    const activeEmployers = await prisma.user.count({ where: { id: { in: employerIds }, role: 'employer', accountStatus: 'active' } });
    if (activeEmployers !== employerIds.length) throw new HttpError(422, 'Select only active employers.');
  }
  const duplicate = await prisma.user.findFirst({ where: { OR: [{ email: data.email }, { mobile: data.mobile }], ...(existing ? { NOT: { id: existing.userId } } : {}) } });
  if (duplicate) throw new HttpError(422, 'The email or mobile is already in use.');
  const password = data.password ? await hashPassword(data.password) : undefined;
  try {
    await prisma.$transaction(async tx => {
      const userData = { fullName: data.full_name, email: data.email, mobile: data.mobile, accountStatus: data.account_status, ...(password ? { password } : {}) };
      if (existing) {
        await tx.user.update({ where: { id: existing.userId }, data: userData });
        await tx.adminEmployee.update({ where: { id: existing.id }, data: { roleId: data.role_id } });
        if (replaceEmployerAssignments) {
          // The checkbox list becomes authoritative after the first edited save;
          // remove old per-company grants so an unchecked employer is revoked.
          await tx.adminCompanyAssignment.deleteMany({ where: { employeeId: existing.id } });
          await tx.adminEmployerAssignment.deleteMany({ where: { employeeId: existing.id } });
          if (employerIds.length) await tx.adminEmployerAssignment.createMany({ data: employerIds.map(employerUserId => ({ employeeId: existing.id, employerUserId })) });
        }
        if (password || data.account_status !== 'active') await tx.personalAccessToken.deleteMany({ where: { tokenableId: existing.userId } });
      } else {
        const user = await tx.user.create({ data: { ...userData, password: password!, role: 'admin_employee', profileType: 'admin_employee', emailVerifiedAt: new Date() } });
        const employee = await tx.adminEmployee.create({ data: { userId: user.id, ownerUserId: ownerId(req), roleId: data.role_id } });
        if (employerIds.length) await tx.adminEmployerAssignment.createMany({ data: employerIds.map(employerUserId => ({ employeeId: employee.id, employerUserId })) });
      }
    });
  } catch (error) { conflict(error); }
  return res.status(existing ? 200 : 201).json({ message: existing ? 'Employee updated.' : 'Employee created.' });
}
export async function deleteEmployee(req: Request, res: Response) {
  const employee = await ownedEmployee(req);
  await prisma.$transaction(async tx => {
    await tx.personalAccessToken.deleteMany({ where: { tokenableId: employee.userId } });
    await tx.adminCompanyAssignment.deleteMany({ where: { employeeId: employee.id } });
    await tx.adminEmployerAssignment.deleteMany({ where: { employeeId: employee.id } });
    await tx.adminEmployee.delete({ where: { id: employee.id } });
    await tx.user.delete({ where: { id: employee.userId } });
  });
  return res.json({ message: 'Employee deleted.' });
}
