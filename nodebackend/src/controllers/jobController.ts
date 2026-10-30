import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, serializeOut, toPrismaData, parseJsonField } from '../utils/serialize';
import { moneySchema } from '../utils/validation';
import { salaryStructureInclude, salaryStructureInputSchema, saveJobSalaryStructure } from '../services/salaryStructureService';

const OUT_JSON = ['required_skills', 'language_requirements'];

/** serializeOut + parse the nested full `site.address` json when present. */
function serializeJobsWithSite(jobs: unknown) {
  const rows = serializeOut(jobs, OUT_JSON) as Array<Record<string, unknown>>;
  for (const r of rows) {
    const site = r.site as Record<string, unknown> | null;
    if (site && typeof site.address === 'string') site.address = parseJsonField(site.address);
  }
  return rows;
}

// Employer-facing methods of App\Http\Controllers\JobController.
// (active/pending/all/approve/reject belong to shared/admin routes.)

const JSON_FIELDS = ['required_skills', 'language_requirements'];

const jobFields = {
  site_id: z.string().uuid().nullish(),
  category: z.string().nullish(),
  guard_type: z.string().trim().min(1, 'Select an associate type.'),
  guards_required: z.coerce.number().int().min(1).nullish(),
  gender_preference: z.string().nullish(),
  experience_required: z.string().nullish(),
  qualification_required: z.string().nullish(),
  salary_amount: moneySchema('Salary amount').nullish(),
  salary_structure: salaryStructureInputSchema.optional(),
  payment_type: z.string().nullish(),
  duty_hours: z.string().nullish(),
  shift_type: z.string().nullish(),
  start_date: z.coerce.date().nullish(),
  end_date: z.coerce.date().nullish(),
  required_skills: z.array(z.any()).nullish(),
  language_requirements: z.array(z.any()).nullish(),
  police_verification_required: z.boolean().nullish(),
  uniform_required: z.boolean().nullish(),
  food_facility: z.boolean().nullish(),
  accommodation_facility: z.boolean().nullish(),
  description: z.string().nullish(),
  special_instructions: z.string().nullish(),
  status: z.string().nullish(),
};

const createSchema = z.object({ company_id: z.string().uuid(), title: z.string(), ...jobFields }).superRefine((data, context) => {
  if (data.salary_amount == null && data.salary_structure == null) context.addIssue({ code: z.ZodIssueCode.custom, path: ['salary_structure'], message: 'Enter a salary structure.' });
  if (data.salary_structure != null && data.payment_type !== 'Monthly') context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_type'], message: 'Salary structures use monthly amounts; select Monthly payment type.' });
});
const updateSchema = z.object({ company_id: z.string().uuid(), title: z.string(), ...jobFields }).partial();

const companySelect = { company: { select: { id: true, companyName: true } } };
const siteSelect = { site: { select: { id: true, siteName: true, city: true, state: true } } };
const employerJobInclude = { ...companySelect, ...siteSelect, ...salaryStructureInclude };
const MIN_EMPLOYER_DEPOSIT_BALANCE = 10000;

async function assertActiveAssociateType(code: string) {
  const row = await prisma.associateType.findFirst({ where: { code, status: 'active' }, select: { id: true } });
  if (!row) throw new HttpError(422, 'Select a valid associate type.');
}

/** GET /employer/jobs */
export async function mine(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const jobs = await prisma.jobPost.findMany({
    where: { employerUserId: req.user!.id, ...(companyId ? { companyId } : {}) },
    include: employerJobInclude,
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(jobs, OUT_JSON));
}

/** POST /employer/jobs */
export async function store(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  await assertActiveAssociateType(data.guard_type);
  const wallet = await prisma.employerWallet.findUnique({ where: { employerUserId: req.user!.id } });
  if (!wallet || Number(wallet.depositBalance) < MIN_EMPLOYER_DEPOSIT_BALANCE) {
    throw new HttpError(422, `Please deposit at least INR ${MIN_EMPLOYER_DEPOSIT_BALANCE.toLocaleString('en-IN')} in your wallet before posting a job. Super Admin credit cannot be used for this minimum deposit requirement.`);
  }

  const company = await prisma.employerCompany.findFirst({
    where: { id: data.company_id, employerUserId: req.user!.id },
  });
  if (!company) {
    throw new HttpError(422, 'Select a valid company from your employer account.');
  }

  if (data.site_id) {
    const site = await prisma.companySite.findUnique({ where: { id: data.site_id } });
    if (!site || site.companyId !== company.id || site.employerUserId !== req.user!.id) {
      throw new HttpError(422, 'Site does not belong to the selected company.');
    }
  }

  const { salary_structure, ...jobData } = data;
  const job = await prisma.$transaction(async tx => {
    const created = await tx.jobPost.create({ data: {
      ...toPrismaData(jobData, JSON_FIELDS), employerUserId: req.user!.id,
      status: data.status === 'draft' ? 'draft' : 'active',
    } as never });
    if (salary_structure) {
      const calculated = await saveJobSalaryStructure(tx, created.id, req.user!.id, req.adminEmployerAccess?.actor_id ?? req.user!.id, salary_structure);
      await tx.jobPost.update({ where: { id: created.id }, data: { salaryAmount: calculated.gross_monthly } });
    }
    return tx.jobPost.findUniqueOrThrow({ where: { id: created.id }, include: employerJobInclude });
  });
  return res.status(201).json(serializeOut(job, OUT_JSON));
}

/** PATCH /employer/jobs/:job */
export async function update(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job }, include: { salaryStructure: { select: { id: true } } } });
  if (!job) throw new HttpError(404, 'Not found.');
  if (job.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = updateSchema.parse(req.body);
  if (data.guard_type !== undefined) await assertActiveAssociateType(data.guard_type);
  if (data.salary_structure && (data.payment_type ?? job.paymentType) !== 'Monthly') throw new HttpError(422, 'Salary structures use monthly amounts; select Monthly payment type.');
  if (job.salaryStructure && data.payment_type !== undefined && data.payment_type !== 'Monthly') throw new HttpError(422, 'A structured salary must use Monthly payment type.');
  const { salary_structure, salary_amount, ...jobData } = data;
  if (job.salaryStructure && salary_amount != null && !new Prisma.Decimal(salary_amount).equals(job.salaryAmount ?? 0)) throw new HttpError(422, 'This job uses a salary structure. Update the structure instead of the legacy salary amount.');
  const updated = await prisma.$transaction(async tx => {
    let grossSalary: string | undefined;
    if (salary_structure) grossSalary = (await saveJobSalaryStructure(tx, job.id, job.employerUserId, req.adminEmployerAccess?.actor_id ?? req.user!.id, salary_structure)).gross_monthly;
    await tx.jobPost.update({ where: { id: job.id }, data: { ...toPrismaData(jobData, JSON_FIELDS), ...(grossSalary ? { salaryAmount: grossSalary } : !job.salaryStructure && salary_amount != null ? { salaryAmount: salary_amount } : {}) } as never });
    return tx.jobPost.findUniqueOrThrow({ where: { id: job.id }, include: employerJobInclude });
  });
  return res.json(serializeOut(updated, OUT_JSON));
}

/** DELETE /employer/jobs/:job */
export async function destroy(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');
  if (job.employerUserId !== req.user!.id && req.user!.role !== 'super_admin') {
    throw new HttpError(403, 'Forbidden.');
  }
  const applications = await prisma.jobApplication.findMany({ where: { jobId: job.id }, select: { id: true } });
  const applicationIds = applications.map((application) => application.id);
  await prisma.$transaction([
    ...(applicationIds.length ? [prisma.applicationStatusLog.deleteMany({ where: { applicationId: { in: applicationIds } } })] : []),
    prisma.interviewRequest.deleteMany({ where: { jobId: job.id } }),
    prisma.jobOffer.deleteMany({ where: { jobId: job.id } }),
    prisma.agreement.deleteMany({ where: { jobId: job.id } }),
    prisma.attendanceRecord.deleteMany({ where: { jobId: job.id } }),
    prisma.payment.deleteMany({ where: { jobId: job.id } }),
    prisma.jobApplication.deleteMany({ where: { jobId: job.id } }),
    prisma.jobPost.delete({ where: { id: job.id } }),
  ]);
  return res.json({ message: 'Job deleted successfully.' });
}

// --- public / admin -------------------------------------------------------

const companyName = { company: { select: { id: true, companyName: true } } };
const siteBrief = { site: { select: { id: true, siteName: true, city: true, state: true } } };

/** GET /jobs (public) — active jobs with full site. */
export async function active(_req: Request, res: Response) {
  const jobs = await prisma.jobPost.findMany({
    where: { status: 'active' },
    include: { ...companyName, site: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeJobsWithSite(jobs));
}

/** GET /guard/jobs — active jobs matching the associate's registered type. */
export async function activeForGuard(req: Request, res: Response) {
  const profileType = req.user!.profileType;
  if (!profileType) {
    throw new HttpError(422, 'Complete your associate type before searching jobs.');
  }

  const jobs = await prisma.jobPost.findMany({
    where: { status: 'active', guardType: profileType },
    include: { ...companyName, site: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeJobsWithSite(jobs));
}

/** GET /admin/jobs/pending */
export async function pending(_req: Request, res: Response) {
  const jobs = await prisma.jobPost.findMany({
    where: { status: 'pending_approval' },
    include: { ...companyName, ...siteBrief, ...salaryStructureInclude },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(jobs, OUT_JSON));
}

/** GET /admin/jobs */
export async function all(_req: Request, res: Response) {
  const jobs = await prisma.jobPost.findMany({
    include: { ...companyName, ...siteBrief, ...salaryStructureInclude },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(jobs, OUT_JSON));
}

/** PATCH /admin/jobs/:job/approve */
export async function approve(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');
  if (!job.guardType) throw new HttpError(422, 'Select an associate type before approving this job.');
  await assertActiveAssociateType(job.guardType);
  const updated = await prisma.jobPost.update({
    where: { id: job.id },
    data: { status: 'active', rejectionReason: null },
  });
  return res.json(serializeOut(updated, OUT_JSON));
}

/** POST /admin/jobs — create a job on behalf of an employer from the manage page. */
export async function adminStore(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  await assertActiveAssociateType(data.guard_type);
  const company = await prisma.employerCompany.findUnique({ where: { id: data.company_id } });
  if (!company) throw new HttpError(422, 'Select a valid employer company.');

  if (data.site_id) {
    const site = await prisma.companySite.findUnique({ where: { id: data.site_id } });
    if (!site || site.companyId !== company.id) {
      throw new HttpError(422, 'Site does not belong to the selected company.');
    }
  }

  const { salary_structure, ...jobData } = data;
  const job = await prisma.$transaction(async tx => {
    const created = await tx.jobPost.create({ data: { ...toPrismaData(jobData, JSON_FIELDS), employerUserId: company.employerUserId, status: data.status ?? 'pending_approval' } as never });
    if (salary_structure) {
      const calculated = await saveJobSalaryStructure(tx, created.id, company.employerUserId, req.user!.id, salary_structure);
      await tx.jobPost.update({ where: { id: created.id }, data: { salaryAmount: calculated.gross_monthly } });
    }
    return tx.jobPost.findUniqueOrThrow({ where: { id: created.id }, include: employerJobInclude });
  });
  return res.status(201).json(serializeOut(job, OUT_JSON));
}

/** PATCH /admin/jobs/:job — edit job details from the admin manage page. */
export async function adminUpdate(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job }, include: { salaryStructure: { select: { id: true } } } });
  if (!job) throw new HttpError(404, 'Not found.');
  const data = updateSchema.parse(req.body);
  if (data.guard_type !== undefined) await assertActiveAssociateType(data.guard_type);
  if (data.salary_structure && (data.payment_type ?? job.paymentType) !== 'Monthly') throw new HttpError(422, 'Salary structures use monthly amounts; select Monthly payment type.');
  if (job.salaryStructure && data.payment_type !== undefined && data.payment_type !== 'Monthly') throw new HttpError(422, 'A structured salary must use Monthly payment type.');
  let employerUserId: string | undefined;

  if (data.company_id || data.site_id) {
    const companyId = data.company_id ?? job.companyId;
    if (!companyId) throw new HttpError(422, 'Select a valid employer company.');
    const company = await prisma.employerCompany.findUnique({ where: { id: companyId } });
    if (!company) throw new HttpError(422, 'Select a valid employer company.');
    if (data.company_id) employerUserId = company.employerUserId;
    if (data.site_id) {
      const site = await prisma.companySite.findUnique({ where: { id: data.site_id } });
      if (!site || site.companyId !== company.id) throw new HttpError(422, 'Site does not belong to the selected company.');
    }
  }

  const { salary_structure, salary_amount, ...jobData } = data;
  if (job.salaryStructure && salary_amount != null && !new Prisma.Decimal(salary_amount).equals(job.salaryAmount ?? 0)) throw new HttpError(422, 'This job uses a salary structure. Update the structure instead of the legacy salary amount.');
  const updated = await prisma.$transaction(async tx => {
    let grossSalary: string | undefined;
    if (salary_structure) grossSalary = (await saveJobSalaryStructure(tx, job.id, employerUserId ?? job.employerUserId, req.user!.id, salary_structure)).gross_monthly;
    await tx.jobPost.update({ where: { id: job.id }, data: { ...toPrismaData(jobData, JSON_FIELDS), ...(employerUserId ? { employerUserId } : {}), ...(grossSalary ? { salaryAmount: grossSalary } : !job.salaryStructure && salary_amount != null ? { salaryAmount: salary_amount } : {}) } as never });
    return tx.jobPost.findUniqueOrThrow({ where: { id: job.id }, include: employerJobInclude });
  });
  return res.json(serializeOut(updated, OUT_JSON));
}

/** PATCH /admin/jobs/:job/reject */
export async function reject(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');
  const reason = z.object({ reason: z.string().nullish() }).parse(req.body).reason ?? '';
  const updated = await prisma.jobPost.update({
    where: { id: job.id },
    data: { status: 'rejected', rejectionReason: reason },
  });
  return res.json(serializeOut(updated, OUT_JSON));
}

/** PATCH /admin/jobs/:job/status — admin-only non-approval status changes. */
export async function adminUpdateStatus(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Not found.');

  const { status } = z.object({
    status: z.enum(['pending_approval', 'closed']),
  }).parse(req.body);

  const updated = await prisma.jobPost.update({
    where: { id: job.id },
    data: { status, rejectionReason: null },
  });
  return res.json(serializeOut(updated, OUT_JSON));
}
/** Minimal company/site choices for Job Management, without Employer records or wallets. */
export async function adminOptions(_req: Request, res: Response) {
  const [companies, sites] = await Promise.all([
    prisma.employerCompany.findMany({ select: { id: true, employerUserId: true, companyName: true }, orderBy: { companyName: 'asc' } }),
    prisma.companySite.findMany({ select: { id: true, companyId: true, siteName: true, city: true }, orderBy: { siteName: 'asc' } }),
  ]);
  return res.json({
    companies: companies.map(row => ({ id: row.id, employerId: row.employerUserId, companyName: row.companyName })),
    sites: sites.map(row => ({ id: row.id, companyId: row.companyId, siteName: row.siteName, city: row.city })),
  });
}
