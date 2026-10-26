import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { parseAdminPermissions } from '../utils/adminEmployeeAccess';
import { assignedCompany, companyEmployee, COMPANY_DEPARTMENTS, effectiveDepartments } from '../services/adminCompanyAccess';
import * as application from './applicationController';
import * as attendance from './attendanceController';
import * as site from './siteController';
import * as companyController from './companyController';

const departments = z.enum(['hr', 'sales', 'operations', 'accounts']);
async function associateNames<T extends { guardUserId: string }>(rows: T[]) {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(row => row.guardUserId))];
  const names = new Map<string, string>();
  for (let start = 0; start < ids.length; start += 500) {
    const users = await prisma.user.findMany({ where: { id: { in: ids.slice(start, start + 500) }, role: 'guard' }, select: { id: true, fullName: true } });
    users.forEach(user => names.set(user.id, user.fullName));
  }
  return rows.map(row => ({ ...row, associateName: names.get(row.guardUserId) || 'Associate' }));
}
export async function assignments(req: Request, res: Response) {
  return res.json(await prisma.adminCompanyAssignment.findMany({ where: { employee: { ownerUserId: req.user!.id } }, include: { company: { select: { companyName: true, employerUserId: true } }, employee: { select: { user: { select: { fullName: true } }, role: { select: { name: true, permissions: true } } } } }, orderBy: { createdAt: 'desc' } }));
}
export async function options(_req: Request, res: Response) {
  const companies = await prisma.employerCompany.findMany({ select: { id: true, companyName: true, employerUserId: true, accountStatus: true }, orderBy: { companyName: 'asc' } });
  const employers = await prisma.user.findMany({ where: { role: 'employer' }, select: { id: true, fullName: true, email: true } });
  return res.json({ companies, employers, departments: COMPANY_DEPARTMENTS });
}
export async function assign(req: Request, res: Response) {
  const data = z.object({ employee_id: z.string().uuid(), company_id: z.string().uuid(), department: departments }).parse(req.body);
  const employee = await prisma.adminEmployee.findFirst({ where: { id: data.employee_id, ownerUserId: req.user!.id }, include: { role: true, user: { select: { accountStatus: true } } } });
  if (!employee || employee.user.accountStatus !== 'active' || employee.role.ownerUserId !== req.user!.id || employee.role.status !== 'active' || !effectiveDepartments(parseAdminPermissions(employee.role.permissions), [data.department]).length) throw new HttpError(422, 'Select an active employee whose role allows this company department.');
  const company = await prisma.employerCompany.findUnique({ where: { id: data.company_id } });
  const employer = company && await prisma.user.findUnique({ where: { id: company.employerUserId } });
  if (!company || company.accountStatus !== 'active' || !employer || employer.role !== 'employer' || employer.accountStatus !== 'active') throw new HttpError(422, 'Select an active employer company.');
  const key = { employeeId: employee.id, companyId: company.id, department: data.department };
  // Upsert makes repeated assignment of the same company/department harmless.
  try {
    const row = await prisma.adminCompanyAssignment.upsert({ where: { employeeId_companyId_department: key }, create: key, update: {} });
    return res.status(201).json(row);
  } catch (error) {
    if ((error as any)?.code === 'P2002') return res.json(await prisma.adminCompanyAssignment.findUnique({ where: { employeeId_companyId_department: key } }));
    throw error;
  }
}
export async function unassign(req: Request, res: Response) {
  const result = await prisma.adminCompanyAssignment.deleteMany({ where: { id: req.params.assignment, employee: { ownerUserId: req.user!.id } } });
  if (!result.count) throw new HttpError(404, 'Assignment not found.');
  return res.json({ message: 'Company department access removed.' });
}
export async function mine(req: Request, res: Response) {
  const employee = await companyEmployee(req);
  const rows = await prisma.adminCompanyAssignment.findMany({ where: { employeeId: employee.id, company: { accountStatus: 'active' } }, include: { company: { select: { id: true, companyName: true } } }, orderBy: { company: { companyName: 'asc' } } });
  return res.json(rows.filter(row => effectiveDepartments(parseAdminPermissions(employee.role.permissions), [row.department]).length));
}
export async function workspace(req: Request, res: Response) {
  const { company } = await assignedCompany(req);
  const where = { companyId: company.id, employerUserId: company.employerUserId };
  const base = { id: company.id, companyName: company.companyName };
  switch (req.params.department) {
    case 'hr': return res.json({
      company: base,
      jobs: await prisma.jobPost.findMany({ where, select: { id: true, title: true, status: true }, orderBy: { createdAt: 'desc' } }),
      applications: await associateNames(await prisma.jobApplication.findMany({
        where: { ...where, job: where },
        select: { id: true, status: true, appliedAt: true, notes: true, guardUserId: true, job: { select: { title: true } } },
        orderBy: { appliedAt: 'desc' },
      })),
    });
    case 'operations': return res.json({
      company: base,
      sites: await prisma.companySite.findMany({ where, select: { id: true, siteName: true, address: true, status: true, contactPerson: true, contactMobile: true, notes: true } }),
      attendance: await associateNames(await prisma.attendanceRecord.findMany({
        where, select: { id: true, guardUserId: true, attendanceDate: true, status: true, totalHours: true, employerRemarks: true }, orderBy: { attendanceDate: 'desc' },
      })),
    });
    case 'sales': return res.json({ company: { ...base, companyEmail: company.companyEmail, companyPhone: company.companyPhone, website: company.website, description: company.description } });
    case 'accounts': return res.json({ company: { ...base, billingAddress: company.billingAddress, gstNumber: company.gstNumber }, invoices: await prisma.invoice.findMany({ where, select: { id: true, invoiceNumber: true, totalAmount: true, paymentStatus: true, invoiceDate: true, dueDate: true }, orderBy: { invoiceDate: 'desc' } }) });
  }
}
export async function action(req: Request, res: Response) {
  const { company, employer } = await assignedCompany(req);
  const where = { id: req.params.record, companyId: company.id, employerUserId: employer.id };
  const department = req.params.department;
  const resource = req.params.resource;
  let handler: ((req: Request, res: Response) => Promise<unknown>) | undefined;
  if (department === 'hr' && resource === 'applications') {
    req.body = z.object({ status: z.enum(['shortlisted', 'rejected', 'hired']), remarks: z.string().trim().max(4000).optional() }).strict().parse(req.body);
    if (!await prisma.jobApplication.findFirst({ where: { ...where, job: { companyId: company.id, employerUserId: employer.id } } })) throw new HttpError(404, 'Application not found in this company.');
    req.params.application = req.params.record; handler = application.updateStatus;
  } else if (department === 'operations' && resource === 'attendance') {
    if (!await prisma.attendanceRecord.findFirst({ where })) throw new HttpError(404, 'Attendance not found in this company.');
    req.params.record = where.id; handler = attendance.updateStatus;
  } else if (department === 'operations' && resource === 'sites') {
    if (!await prisma.companySite.findFirst({ where })) throw new HttpError(404, 'Site not found in this company.');
    req.params.site = where.id; handler = site.update;
  } else if (['sales', 'accounts'].includes(department) && resource === 'company' && where.id === company.id) {
    req.body = (department === 'sales'
      ? z.object({ company_email: z.string().email().nullable().optional(), company_phone: z.string().max(30).nullable().optional(), website: z.string().max(500).nullable().optional(), description: z.string().max(4000).nullable().optional() }).strict()
      : z.object({ billing_address: z.string().trim().max(2000).optional() }).strict()).parse(req.body);
    handler = companyController.update;
  }
  if (!handler) throw new HttpError(403, 'This action is unavailable for this department.');
  const actorId = req.user!.id;
  req.managedCompanyActorId = actorId;
  res.once('finish', () => console.info('[managed-company-action]', JSON.stringify({ actorId, employerId: employer.id, companyId: company.id, department, resource, recordId: where.id, status: res.statusCode })));
  req.user = employer; // Reuse employer business rules only after assignment + record authorization.
  return handler(req, res);
}
