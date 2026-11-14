import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { companyModulesForDepartment, parseAdminPermissions, type GranviaEmployeePermission } from '../utils/adminEmployeeAccess';
import { assignedCompany, companyEmployee, COMPANY_DEPARTMENTS, effectiveDepartments, requireCompanyModule } from '../services/adminCompanyAccess';
import * as application from './applicationController';
import * as attendance from './attendanceController';
import * as site from './siteController';
import * as job from './jobController';
import * as companyController from './companyController';

const departments = z.enum(['hr', 'sales', 'operations', 'accounts']);
const adminOwnerId = (req: Request) => req.delegatedAdminOwnerId ?? req.user!.id;
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
  const rows = await prisma.adminCompanyAssignment.findMany({ where: { employee: { ownerUserId: adminOwnerId(req) } }, include: { company: { select: { companyName: true, employerUserId: true } }, employee: { select: { user: { select: { fullName: true } }, role: { select: { name: true, permissions: true } } } } }, orderBy: { createdAt: 'desc' } });
  return res.json(rows.filter(row => !req.delegatedAdminPermissions || parseAdminPermissions(row.employee.role.permissions).every(permission => req.delegatedAdminPermissions!.includes(permission))));
}
export async function options(_req: Request, res: Response) {
  const companies = await prisma.employerCompany.findMany({ select: { id: true, companyName: true, employerUserId: true, accountStatus: true }, orderBy: { companyName: 'asc' } });
  const employers = await prisma.user.findMany({ where: { role: 'employer', accountStatus: 'active' }, select: { id: true, fullName: true, email: true }, orderBy: { fullName: 'asc' } });
  return res.json({ companies, employers, departments: COMPANY_DEPARTMENTS });
}
export async function assign(req: Request, res: Response) {
  const data = z.object({ employee_id: z.string().uuid(), company_id: z.string().uuid(), department: departments }).parse(req.body);
  const ownerUserId = adminOwnerId(req);
  const employee = await prisma.adminEmployee.findFirst({ where: { id: data.employee_id, ownerUserId }, include: { role: true, user: { select: { accountStatus: true } } } });
  const targetPermissions = employee ? parseAdminPermissions(employee.role.permissions) : [];
  if (!employee) throw new HttpError(422, 'Select an active employee whose role allows this company department.');
  if (req.delegatedAdminPermissions && !targetPermissions.every(permission => req.delegatedAdminPermissions!.includes(permission))) throw new HttpError(403, 'You cannot allocate a company to an employee with broader access than your own.');
  if (employee.user.accountStatus !== 'active' || employee.role.ownerUserId !== ownerUserId || employee.role.status !== 'active' || !effectiveDepartments(targetPermissions, [data.department]).length) throw new HttpError(422, 'Select an active employee whose role allows this company department.');
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
  if (req.delegatedAdminPermissions) {
    const assignment = await prisma.adminCompanyAssignment.findFirst({ where: { id: req.params.assignment, employee: { ownerUserId: adminOwnerId(req) } }, include: { employee: { include: { role: true } } } });
    if (!assignment) throw new HttpError(404, 'Assignment not found.');
    if (!parseAdminPermissions(assignment.employee.role.permissions).every(permission => req.delegatedAdminPermissions!.includes(permission))) throw new HttpError(403, 'You cannot change an employee with broader access than your own.');
  }
  const result = await prisma.adminCompanyAssignment.deleteMany({ where: { id: req.params.assignment, employee: { ownerUserId: adminOwnerId(req) } } });
  if (!result.count) throw new HttpError(404, 'Assignment not found.');
  return res.json({ message: 'Company department access removed.' });
}
export async function mine(req: Request, res: Response) {
  const employee = await companyEmployee(req);
  const permissions = employee.permissions;
  const departments = effectiveDepartments(permissions, Object.keys(COMPANY_DEPARTMENTS));
  if (employee.kind === 'employer_employee') {
    const company = await prisma.employerCompany.findFirst({
      where: { id: employee.companyId, employerUserId: employee.employerUserId, accountStatus: 'active' },
      select: { id: true, companyName: true, employerUserId: true },
    });
    if (!company) return res.json([]);
    return res.json(departments.map(department => ({
      id: `${employee.id}:${company.id}:${department}`,
      employeeId: employee.id,
      companyId: company.id,
      department,
      createdAt: null,
      company,
    })));
  }
  const [legacyRows, companyAssignments, employerAssignments] = await Promise.all([
    prisma.adminCompanyAssignment.findMany({ where: { employeeId: employee.id, company: { accountStatus: 'active' } }, include: { company: { select: { id: true, companyName: true, employerUserId: true } } }, orderBy: { company: { companyName: 'asc' } } }),
    prisma.adminEmployeeCompanyAssignment.findMany({ where: { employeeId: employee.id, company: { accountStatus: 'active' } }, include: { company: { select: { id: true, companyName: true, employerUserId: true } } }, orderBy: { company: { companyName: 'asc' } } }),
    prisma.adminEmployerAssignment.findMany({ where: { employeeId: employee.id }, select: { employerUserId: true } }),
  ]);
  const companies = employerAssignments.length ? await prisma.employerCompany.findMany({ where: { employerUserId: { in: employerAssignments.map(row => row.employerUserId) }, accountStatus: 'active' }, select: { id: true, companyName: true, employerUserId: true }, orderBy: { companyName: 'asc' } }) : [];
  const rows = [
    ...legacyRows.filter(row => effectiveDepartments(permissions, [row.department]).length),
    ...companyAssignments.flatMap(row => departments.map(department => ({ id: `${employee.id}:${row.company.id}:${department}`, employeeId: employee.id, companyId: row.company.id, department, createdAt: row.createdAt, company: row.company }))),
    ...companies.flatMap(company => departments.map(department => ({ id: `${employee.id}:${company.id}:${department}`, employeeId: employee.id, companyId: company.id, department, createdAt: null, company }))),
  ];
  return res.json([...new Map(rows.map(row => [`${row.companyId}:${row.department}`, row])).values()]);
}
export async function workspace(req: Request, res: Response) {
  const { company, employee } = await assignedCompany(req);
  const where = { companyId: company.id, employerUserId: company.employerUserId };
  const base = { id: company.id, companyName: company.companyName };
  const departmentModules = companyModulesForDepartment(req.params.department);
  const requestedModule = typeof req.query?.module === 'string' ? req.query.module : null;
  if (requestedModule && !departmentModules.includes(requestedModule as GranviaEmployeePermission)) throw new HttpError(422, 'Select a valid company module.');
  const modules = requestedModule
    ? [requestedModule as GranviaEmployeePermission]
    : departmentModules.filter(module => employee.permissions.includes(module));
  modules.forEach(module => requireCompanyModule(employee.permissions, module));
  switch (req.params.department) {
    case 'hr': {
      const body: Record<string, unknown> = { company: base };
      if (modules.includes('company.jobs')) {
        body.jobs = await prisma.jobPost.findMany({ where, include: { site: { select: { id: true, siteName: true } } }, orderBy: { createdAt: 'desc' } });
        body.sites = await prisma.companySite.findMany({ where, select: { id: true, siteName: true, status: true }, orderBy: { siteName: 'asc' } });
        body.associateTypes = await prisma.associateType.findMany({ where: { status: 'active' }, select: { code: true, name: true }, orderBy: { name: 'asc' } });
      }
      if (modules.includes('company.associates')) body.applications = await associateNames(await prisma.jobApplication.findMany({
        where: { ...where, job: where },
        select: { id: true, status: true, appliedAt: true, notes: true, guardUserId: true, job: { select: { title: true } } },
        orderBy: { appliedAt: 'desc' },
      }));
      return res.json(body);
    }
    case 'operations': {
      const body: Record<string, unknown> = { company: base };
      if (modules.includes('company.sites')) body.sites = await prisma.companySite.findMany({ where, orderBy: { createdAt: 'desc' } });
      if (modules.includes('company.attendance')) body.attendance = await associateNames(await prisma.attendanceRecord.findMany({
        where, select: { id: true, guardUserId: true, attendanceDate: true, status: true, totalHours: true, employerRemarks: true }, orderBy: { attendanceDate: 'desc' },
      }));
      return res.json(body);
    }
    case 'sales':
      requireCompanyModule(employee.permissions, 'company.profile');
      return res.json({ company: {
        ...base, businessType: company.businessType, registrationType: company.registrationType, gstNumber: company.gstNumber,
        panNumber: company.panNumber, companyEmail: company.companyEmail, companyPhone: company.companyPhone, website: company.website,
        description: company.description, registeredAddress: company.registeredAddress, city: company.city, state: company.state, pincode: company.pincode,
      } });
    case 'accounts': {
      const body: Record<string, unknown> = { company: { ...base, billingAddress: company.billingAddress, gstNumber: company.gstNumber } };
      if (modules.includes('company.invoices')) body.invoices = await prisma.invoice.findMany({ where, select: { id: true, invoiceNumber: true, totalAmount: true, paymentStatus: true, invoiceDate: true, dueDate: true }, orderBy: { invoiceDate: 'desc' } });
      return res.json(body);
    }
  }
}

function delegateToEmployer(
  req: Request,
  res: Response,
  context: Awaited<ReturnType<typeof assignedCompany>>,
  resource: string,
  recordId: string | null,
  handler: (req: Request, res: Response) => Promise<unknown>,
) {
  const actor = req.user!;
  const { employee, company, employer } = context;
  req.managedCompanyActorId = actor.id;
  req.adminEmployerAccess = {
    actor_id: actor.id,
    actor_name: actor.fullName,
    employer_id: employer.id,
    employer_name: employer.fullName,
    employer_status: employer.accountStatus,
  };
  res.once('finish', () => {
    const audit = { actorId: actor.id, actorType: employee.kind, employerId: employer.id, companyId: company.id, department: req.params.department, resource, recordId, method: req.method, status: res.statusCode };
    console.info('[managed-company-action]', JSON.stringify(audit));
    prisma.delegatedCompanyAudit.create({ data: {
      actorUserId: actor.id, actorType: employee.kind, employerUserId: employer.id, companyId: company.id,
      department: req.params.department, resource, recordId, method: req.method, statusCode: res.statusCode,
    } }).catch(error => console.error('[managed-company-audit-failed]', error));
  });
  req.user = employer;
  return handler(req, res);
}

export async function create(req: Request, res: Response) {
  const context = await assignedCompany(req);
  const { company, employer } = context;
  let handler: ((request: Request, response: Response) => Promise<unknown>) | undefined;
  if (req.params.department === 'hr' && req.params.resource === 'jobs') {
    requireCompanyModule(context.employee.permissions, 'company.jobs');
    req.body = { ...req.body, company_id: company.id };
    if (req.body.site_id) {
      const selectedSite = await prisma.companySite.findFirst({ where: { id: req.body.site_id, companyId: company.id, employerUserId: employer.id } });
      if (!selectedSite) throw new HttpError(422, 'Select a site from the assigned company.');
    }
    handler = job.store;
  } else if (req.params.department === 'operations' && req.params.resource === 'sites') {
    requireCompanyModule(context.employee.permissions, 'company.sites');
    req.body = { ...req.body, company_id: company.id };
    handler = site.store;
  }
  if (!handler) throw new HttpError(403, 'Create is unavailable for this department resource.');
  return delegateToEmployer(req, res, context, req.params.resource, null, handler);
}

export async function operation(req: Request, res: Response) {
  const context = await assignedCompany(req);
  const { company, employer } = context;
  let handler: ((request: Request, response: Response) => Promise<unknown>) | undefined;
  if (req.params.department === 'hr' && req.params.resource === 'applications' && req.params.operation === 'schedule-interview') {
    requireCompanyModule(context.employee.permissions, 'company.associates');
    if (!await prisma.jobApplication.findFirst({ where: { id: req.params.record, companyId: company.id, employerUserId: employer.id, job: { companyId: company.id, employerUserId: employer.id } } })) {
      throw new HttpError(404, 'Application not found in this company.');
    }
    req.body = z.object({ remarks: z.string().trim().min(1).max(4000) }).strict().parse(req.body);
    req.params.application = req.params.record;
    handler = application.scheduleInterview;
  }
  if (!handler) throw new HttpError(403, 'This workflow action is unavailable for this department resource.');
  return delegateToEmployer(req, res, context, req.params.resource, req.params.record, handler);
}

export async function action(req: Request, res: Response) {
  const context = await assignedCompany(req);
  const { company, employer } = context;
  const where = { id: req.params.record, companyId: company.id, employerUserId: employer.id };
  const department = req.params.department;
  const resource = req.params.resource;
  let handler: ((req: Request, res: Response) => Promise<unknown>) | undefined;
  if (department === 'hr' && resource === 'applications') {
    requireCompanyModule(context.employee.permissions, 'company.associates');
    req.body = z.object({ status: z.enum(['applied', 'shortlisted', 'selected', 'scheduled', 'hired', 'not_hired', 'rejected', 'offer_sent', 'accepted', 'joined']), remarks: z.string().trim().max(4000).nullish() }).strict().parse(req.body);
    if (!await prisma.jobApplication.findFirst({ where: { ...where, job: { companyId: company.id, employerUserId: employer.id } } })) throw new HttpError(404, 'Application not found in this company.');
    req.params.application = req.params.record; handler = application.updateStatus;
  } else if (department === 'hr' && resource === 'jobs') {
    requireCompanyModule(context.employee.permissions, 'company.jobs');
    if (!await prisma.jobPost.findFirst({ where })) throw new HttpError(404, 'Job not found in this company.');
    req.body = { ...req.body, company_id: company.id };
    if (req.body.site_id) {
      const selectedSite = await prisma.companySite.findFirst({ where: { id: req.body.site_id, companyId: company.id, employerUserId: employer.id } });
      if (!selectedSite) throw new HttpError(422, 'Select a site from the assigned company.');
    }
    req.params.job = req.params.record; handler = job.update;
  } else if (department === 'operations' && resource === 'attendance') {
    requireCompanyModule(context.employee.permissions, 'company.attendance');
    if (!await prisma.attendanceRecord.findFirst({ where })) throw new HttpError(404, 'Attendance not found in this company.');
    req.params.record = where.id; handler = attendance.updateStatus;
  } else if (department === 'operations' && resource === 'sites') {
    requireCompanyModule(context.employee.permissions, 'company.sites');
    if (!await prisma.companySite.findFirst({ where })) throw new HttpError(404, 'Site not found in this company.');
    req.params.site = where.id; handler = site.update;
  } else if (['sales', 'accounts'].includes(department) && resource === 'company' && where.id === company.id) {
    requireCompanyModule(context.employee.permissions, department === 'sales' ? 'company.profile' : 'company.billing');
    req.body = (department === 'sales'
      ? z.object({
          company_name: z.string().trim().min(2).optional(), business_type: z.string().nullable().optional(), registration_type: z.string().nullable().optional(),
          gst_number: z.string().nullable().optional(), pan_number: z.string().nullable().optional(), company_email: z.string().email().nullable().optional(),
          company_phone: z.string().max(30).nullable().optional(), website: z.string().max(500).nullable().optional(), description: z.string().max(4000).nullable().optional(),
          registered_address: z.string().max(2000).nullable().optional(), city: z.string().nullable().optional(), state: z.string().nullable().optional(), pincode: z.string().nullable().optional(),
        }).strict()
      : z.object({ billing_address: z.string().trim().max(2000).nullable().optional(), gst_number: z.string().nullable().optional() }).strict()).parse(req.body);
    handler = companyController.update;
  }
  if (!handler) throw new HttpError(403, 'This action is unavailable for this department.');
  return delegateToEmployer(req, res, context, resource, where.id, handler);
}

export async function destroy(req: Request, res: Response) {
  const context = await assignedCompany(req);
  const { company, employer } = context;
  const where = { id: req.params.record, companyId: company.id, employerUserId: employer.id };
  let handler: ((request: Request, response: Response) => Promise<unknown>) | undefined;
  if (req.params.department === 'hr' && req.params.resource === 'jobs') {
    requireCompanyModule(context.employee.permissions, 'company.jobs');
    if (!await prisma.jobPost.findFirst({ where })) throw new HttpError(404, 'Job not found in this company.');
    req.params.job = req.params.record; handler = job.destroy;
  } else if (req.params.department === 'operations' && req.params.resource === 'sites') {
    requireCompanyModule(context.employee.permissions, 'company.sites');
    if (!await prisma.companySite.findFirst({ where })) throw new HttpError(404, 'Site not found in this company.');
    req.params.site = req.params.record; handler = site.destroy;
  }
  if (!handler) throw new HttpError(403, 'Delete is unavailable for this department resource.');
  return delegateToEmployer(req, res, context, req.params.resource, where.id, handler);
}
