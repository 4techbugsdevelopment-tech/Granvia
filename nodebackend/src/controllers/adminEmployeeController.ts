import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { hashPassword } from '../utils/password';
import { humanNameSchema, indianMobileSchema, normalizedEmailSchema, strongPasswordSchema } from '../utils/validation';
import { companyDepartmentsForPermissions, GRANVIA_EMPLOYEE_MODULE_CATALOG, GRANVIA_EMPLOYEE_PERMISSIONS, parseAdminPermissions } from '../utils/adminEmployeeAccess';

const roleSchema = z.object({
  name: z.string().trim().min(2).max(150), description: z.string().trim().max(2000).nullable().optional(),
  permissions: z.array(z.enum(GRANVIA_EMPLOYEE_PERMISSIONS)).min(1, 'Select at least one module.'), status: z.enum(['active', 'inactive']),
});
const employeeSchema = z.object({
  full_name: humanNameSchema('Full name'), email: normalizedEmailSchema,
  mobile: indianMobileSchema, role_id: z.string().uuid(),
  account_status: z.enum(['active', 'inactive', 'blocked']), password: strongPasswordSchema,
  employer_ids: z.array(z.string().uuid()).max(500).optional(),
  company_ids: z.array(z.string().uuid()).max(1000).optional(),
});
const ownerId = (req: Request) => req.delegatedAdminOwnerId ?? req.user!.id;
const withinPermissionCeiling = (req: Request, permissions: readonly string[]) => !req.delegatedAdminPermissions || permissions.every(permission => req.delegatedAdminPermissions!.includes(permission));
function assertPermissionCeiling(req: Request, permissions: readonly string[]) {
  if (!withinPermissionCeiling(req, permissions)) throw new HttpError(403, 'You cannot assign modules outside your own Granvia employee access.');
}
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
  const employee = await prisma.adminEmployee.findFirst({ where: { id: req.params.employee, ownerUserId: ownerId(req) }, include: { role: true } });
  if (!employee) throw new HttpError(404, 'Employee not found.');
  if (!withinPermissionCeiling(req, parseAdminPermissions(employee.role.permissions))) throw new HttpError(403, 'You cannot manage an employee with broader access than your own.');
  return employee;
}
export async function roles(req: Request, res: Response) {
  const rows = await prisma.adminEmployeeRole.findMany({ where: { ownerUserId: ownerId(req) }, orderBy: { name: 'asc' } });
  return res.json(rows.map(roleOut).filter(role => withinPermissionCeiling(req, role.permissions)));
}
export async function roleModules(req: Request, res: Response) {
  return res.json(GRANVIA_EMPLOYEE_MODULE_CATALOG.filter(module => !req.delegatedAdminPermissions || req.delegatedAdminPermissions.includes(module.key)));
}
export async function saveRole(req: Request, res: Response) {
  const data = roleSchema.parse(req.body);
  assertPermissionCeiling(req, data.permissions);
  if (req.params.role) {
    const current = await ownedRole(req.params.role, ownerId(req));
    assertPermissionCeiling(req, parseAdminPermissions(current.permissions));
  }
  try {
    const payload = { ...data, permissions: JSON.stringify([...new Set(data.permissions)]) };
    const role = req.params.role
      ? await prisma.adminEmployeeRole.update({ where: { id: req.params.role }, data: payload })
      : await prisma.adminEmployeeRole.create({ data: { ...payload, ownerUserId: ownerId(req) } });
    return res.status(req.params.role ? 200 : 201).json(roleOut(role));
  } catch (error) { conflict(error); }
}
export async function deleteRole(req: Request, res: Response) {
  const current = await ownedRole(req.params.role, ownerId(req));
  assertPermissionCeiling(req, parseAdminPermissions(current.permissions));
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
    where: { ownerUserId: ownerId(req) }, include: { role: true, companyAssignments: { select: { companyId: true } }, companyScopeAssignments: { select: { companyId: true } }, employerAssignments: { select: { employerUserId: true } }, user: { select: { fullName: true, email: true, mobile: true, accountStatus: true } } }, orderBy: { createdAt: 'desc' },
  });
  const inheritedEmployerIds = [...new Set(rows.flatMap(row => row.employerAssignments.map(item => item.employerUserId)))];
  const inheritedCompanies = inheritedEmployerIds.length ? await prisma.employerCompany.findMany({ where: { employerUserId: { in: inheritedEmployerIds }, accountStatus: 'active' }, select: { id: true, employerUserId: true } }) : [];
  res.set('Cache-Control', 'no-store');
  return res.json(rows.map(row => ({ id: row.id, full_name: row.user.fullName, email: row.user.email, mobile: row.user.mobile, account_status: row.user.accountStatus, role_id: row.roleId, role_name: row.role.name, role_status: row.role.status, permissions: parseAdminPermissions(row.role.permissions), employer_ids: row.employerAssignments.map(item => item.employerUserId), company_ids: [...new Set([...(row.companyScopeAssignments ?? []).map(item => item.companyId), ...(row.companyAssignments ?? []).map(item => item.companyId), ...inheritedCompanies.filter(company => row.employerAssignments.some(item => item.employerUserId === company.employerUserId)).map(company => company.id)])] })).filter(row => withinPermissionCeiling(req, row.permissions)));
}
export async function saveEmployee(req: Request, res: Response) {
  const existing = req.params.employee ? await ownedEmployee(req) : null;
  const data = (existing ? employeeSchema.omit({ password: true }).extend({ password: strongPasswordSchema.optional() }) : employeeSchema).parse(req.body);
  const selectedRole = await ownedRole(data.role_id, ownerId(req), true);
  const employerIds = [...new Set(data.employer_ids ?? [])];
  const companyIds = [...new Set(data.company_ids ?? [])];
  const replaceEmployerAssignments = data.employer_ids !== undefined;
  const replaceCompanyAssignments = data.company_ids !== undefined;
  if (employerIds.length) {
    const activeEmployers = await prisma.user.count({ where: { id: { in: employerIds }, role: 'employer', accountStatus: 'active' } });
    if (activeEmployers !== employerIds.length) throw new HttpError(422, 'Select only active employers.');
  }
  if (companyIds.length) {
    const activeCompanies = await prisma.employerCompany.count({ where: { id: { in: companyIds }, accountStatus: 'active' } });
    if (activeCompanies !== companyIds.length) throw new HttpError(422, 'Select only active companies.');
  }
  const rolePermissions = parseAdminPermissions(selectedRole.permissions);
  assertPermissionCeiling(req, rolePermissions);
  const departments = companyDepartmentsForPermissions(rolePermissions);
  if ((employerIds.length || companyIds.length) && !departments.length) throw new HttpError(422, 'Company assignments require at least one company work module in the selected role.');
  const duplicate = await prisma.user.findFirst({ where: { OR: [{ email: data.email }, { mobile: data.mobile }], ...(existing ? { NOT: { id: existing.userId } } : {}) } });
  if (duplicate) throw new HttpError(422, 'The email or mobile is already in use.');
  const password = data.password ? await hashPassword(data.password) : undefined;
  try {
    await prisma.$transaction(async tx => {
      const userData = { fullName: data.full_name, email: data.email, mobile: data.mobile, accountStatus: data.account_status, ...(password ? { password } : {}) };
      if (existing) {
        await tx.user.update({ where: { id: existing.userId }, data: userData });
        await tx.adminEmployee.update({ where: { id: existing.id }, data: { roleId: data.role_id } });
        if (replaceEmployerAssignments || replaceCompanyAssignments) {
          // The checkbox list becomes authoritative after the first edited save;
          // remove old per-company grants so an unchecked employer is revoked.
          await tx.adminCompanyAssignment.deleteMany({ where: { employeeId: existing.id } });
          await tx.adminEmployeeCompanyAssignment.deleteMany({ where: { employeeId: existing.id } });
          await tx.adminEmployerAssignment.deleteMany({ where: { employeeId: existing.id } });
          if (replaceCompanyAssignments && companyIds.length) await tx.adminEmployeeCompanyAssignment.createMany({ data: companyIds.map(companyId => ({ employeeId: existing.id, companyId })) });
          else if (employerIds.length) await tx.adminEmployerAssignment.createMany({ data: employerIds.map(employerUserId => ({ employeeId: existing.id, employerUserId })) });
        }
        if (password || data.account_status !== 'active') await tx.personalAccessToken.deleteMany({ where: { tokenableId: existing.userId } });
      } else {
        const user = await tx.user.create({ data: { ...userData, password: password!, role: 'admin_employee', profileType: 'admin_employee', emailVerifiedAt: new Date() } });
        const employee = await tx.adminEmployee.create({ data: { userId: user.id, ownerUserId: ownerId(req), roleId: data.role_id } });
        if (companyIds.length) await tx.adminEmployeeCompanyAssignment.createMany({ data: companyIds.map(companyId => ({ employeeId: employee.id, companyId })) });
        else if (employerIds.length) await tx.adminEmployerAssignment.createMany({ data: employerIds.map(employerUserId => ({ employeeId: employee.id, employerUserId })) });
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
    await tx.adminEmployeeCompanyAssignment.deleteMany({ where: { employeeId: employee.id } });
    await tx.adminEmployerAssignment.deleteMany({ where: { employeeId: employee.id } });
    await tx.adminEmployee.delete({ where: { id: employee.id } });
    await tx.user.delete({ where: { id: employee.userId } });
  });
  return res.json({ message: 'Employee deleted.' });
}
