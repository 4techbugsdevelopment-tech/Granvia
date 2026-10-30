import { Request } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { parseAdminPermissions } from '../utils/adminEmployeeAccess';

export const COMPANY_DEPARTMENTS = { hr: 'Company HR', sales: 'Company Sales', operations: 'Company Operations', accounts: 'Company Accounts' } as const;
export type CompanyDepartment = keyof typeof COMPANY_DEPARTMENTS;
export function effectiveDepartments(permissions: string[], departments: string[]) {
  return departments.filter((d): d is CompanyDepartment => d in COMPANY_DEPARTMENTS && permissions.includes(COMPANY_DEPARTMENTS[d as CompanyDepartment]));
}
export async function companyEmployee(req: Request) {
  if (req.user?.role !== 'admin_employee' || req.user.accountStatus !== 'active') throw new HttpError(403, 'Active Granvia employee access required.');
  const employee = await prisma.adminEmployee.findUnique({ where: { userId: req.user.id }, include: { role: true } });
  const owner = employee && await prisma.user.findUnique({ where: { id: employee.ownerUserId } });
  if (!employee || employee.role.ownerUserId !== employee.ownerUserId || employee.role.status !== 'active' || !owner || owner.role !== 'super_admin' || owner.accountStatus !== 'active') throw new HttpError(403, 'Your employee role is unavailable.');
  return employee;
}
export async function assignedCompany(req: Request) {
  const employee = await companyEmployee(req);
  const department = req.params.department;
  if (!effectiveDepartments(parseAdminPermissions(employee.role.permissions), [department]).length) throw new HttpError(403, 'Department permission required.');
  const legacyAssignment = await prisma.adminCompanyAssignment.findFirst({ where: { employeeId: employee.id, companyId: req.params.company, department }, include: { company: true } });
  const company = legacyAssignment?.company ?? await prisma.employerCompany.findUnique({ where: { id: req.params.company } });
  if (!company) throw new HttpError(403, 'This company department is not assigned to you.');
  const employerAssignment = legacyAssignment ? null : await prisma.adminEmployerAssignment.findUnique({ where: { employeeId_employerUserId: { employeeId: employee.id, employerUserId: company.employerUserId } } });
  if (!legacyAssignment && !employerAssignment) throw new HttpError(403, 'This employer is not assigned to you.');
  const employer = await prisma.user.findUnique({ where: { id: company.employerUserId } });
  if (!employer || employer.role !== 'employer' || employer.accountStatus !== 'active' || company.accountStatus !== 'active') throw new HttpError(403, 'Company or employer is not active.');
  return { employee, company, employer };
}

export async function companyStorage<T>(work: () => Promise<T>) {
  if (!(prisma as any).adminCompanyAssignment?.findMany || !(prisma as any).adminEmployerAssignment?.findMany) throw new HttpError(503, 'Company assignments require a rebuilt backend and the 20261026120000_admin_company_assignments and 20261030120000_admin_employer_assignments migrations.');
  try { return await work(); } catch (error) {
    if (['P2021', 'P2022'].includes((error as any)?.code)) throw new HttpError(503, 'Apply the 20261026120000_admin_company_assignments and 20261030120000_admin_employer_assignments migrations and restart the backend.');
    throw error;
  }
}
