import { Request } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { companyModulesForDepartment, normalizeGranviaPermissions, parseAdminPermissions, type GranviaEmployeePermission } from '../utils/adminEmployeeAccess';

export const COMPANY_DEPARTMENTS = { hr: 'Company HR', sales: 'Company Sales', operations: 'Company Operations', accounts: 'Company Accounts' } as const;
export type CompanyDepartment = keyof typeof COMPANY_DEPARTMENTS;
export type CompanyEmployeeContext = {
  id: string;
  kind: 'granvia_employee' | 'employer_employee';
  permissions: string[];
  companyId?: string;
  employerUserId?: string;
};
export function effectiveDepartments(permissions: string[], departments: string[]) {
  const normalized = normalizeGranviaPermissions(permissions);
  return departments.filter((d): d is CompanyDepartment => d in COMPANY_DEPARTMENTS && companyModulesForDepartment(d).some(module => normalized.includes(module)));
}
export function requireCompanyModule(permissions: string[], module: GranviaEmployeePermission) {
  if (!normalizeGranviaPermissions(permissions).includes(module)) throw new HttpError(403, 'This company module is not assigned to your role.');
}
export async function companyEmployee(req: Request): Promise<CompanyEmployeeContext> {
  if (!req.user || req.user.accountStatus !== 'active') throw new HttpError(403, 'Active employee access required.');
  if (req.user.role === 'admin_employee') {
    const employee = await prisma.adminEmployee.findUnique({ where: { userId: req.user.id }, include: { role: true } });
    const owner = employee && await prisma.user.findUnique({ where: { id: employee.ownerUserId } });
    if (!employee || employee.role.ownerUserId !== employee.ownerUserId || employee.role.status !== 'active' || !owner || owner.role !== 'super_admin' || owner.accountStatus !== 'active') throw new HttpError(403, 'Your employee role is unavailable.');
    return { id: employee.id, kind: 'granvia_employee', permissions: parseAdminPermissions(employee.role.permissions) };
  }
  if (req.user.role === 'employer_employee') {
    const member = await prisma.staffMember.findUnique({ where: { userId: req.user.id }, include: { roleMaster: true, company: true } });
    const employer = member?.employerUserId ? await prisma.user.findUnique({ where: { id: member.employerUserId } }) : null;
    if (!member || !member.roleMaster || !member.company || member.status !== 'Active' || member.roleMaster.status !== 'active' || !employer || employer.role !== 'employer' || employer.accountStatus !== 'active' || member.company.accountStatus !== 'active' || member.company.employerUserId !== employer.id) {
      throw new HttpError(403, 'Your company employee role is unavailable.');
    }
    return { id: member.id, kind: 'employer_employee', permissions: parseAdminPermissions(member.roleMaster.permissions), companyId: member.company.id, employerUserId: employer.id };
  }
  throw new HttpError(403, 'Employee company access required.');
}
export async function assignedCompany(req: Request) {
  const employee = await companyEmployee(req);
  const department = req.params.department;
  if (!effectiveDepartments(employee.permissions, [department]).length) throw new HttpError(403, 'Department permission required.');
  if (employee.kind === 'employer_employee') {
    if (employee.companyId !== req.params.company) throw new HttpError(403, 'This company is not assigned to you.');
    const company = await prisma.employerCompany.findFirst({ where: { id: employee.companyId, employerUserId: employee.employerUserId, accountStatus: 'active' } });
    const employer = employee.employerUserId ? await prisma.user.findUnique({ where: { id: employee.employerUserId } }) : null;
    if (!company || !employer || employer.role !== 'employer' || employer.accountStatus !== 'active') throw new HttpError(403, 'Company or employer is not active.');
    return { employee, company, employer };
  }
  const legacyAssignment = await prisma.adminCompanyAssignment.findFirst({ where: { employeeId: employee.id, companyId: req.params.company, department }, include: { company: true } });
  const company = legacyAssignment?.company ?? await prisma.employerCompany.findUnique({ where: { id: req.params.company } });
  if (!company) throw new HttpError(403, 'This company department is not assigned to you.');
  const companyAssignment = legacyAssignment ? null : await prisma.adminEmployeeCompanyAssignment.findUnique({ where: { employeeId_companyId: { employeeId: employee.id, companyId: company.id } } });
  const employerAssignment = legacyAssignment || companyAssignment ? null : await prisma.adminEmployerAssignment.findUnique({ where: { employeeId_employerUserId: { employeeId: employee.id, employerUserId: company.employerUserId } } });
  if (!legacyAssignment && !companyAssignment && !employerAssignment) throw new HttpError(403, 'This company is not assigned to you.');
  const employer = await prisma.user.findUnique({ where: { id: company.employerUserId } });
  if (!employer || employer.role !== 'employer' || employer.accountStatus !== 'active' || company.accountStatus !== 'active') throw new HttpError(403, 'Company or employer is not active.');
  return { employee, company, employer };
}

export async function companyStorage<T>(work: () => Promise<T>) {
  if (!(prisma as any).adminCompanyAssignment?.findMany || !(prisma as any).adminEmployerAssignment?.findMany || !(prisma as any).adminEmployeeCompanyAssignment?.findMany) throw new HttpError(503, 'Company assignments require a rebuilt backend and the company-access migrations through 20261113120000_company_employee_access.');
  try { return await work(); } catch (error) {
    if (['P2021', 'P2022'].includes((error as any)?.code)) throw new HttpError(503, 'Apply the 20261026120000_admin_company_assignments and 20261030120000_admin_employer_assignments migrations and restart the backend.');
    throw error;
  }
}
