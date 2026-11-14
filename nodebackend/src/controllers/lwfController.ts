import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { policySnapshot, resolveEffectiveLwfSetting, resolveLwfPolicy } from '../services/lwfService';

const amount = z.union([z.string(), z.number()]).transform((raw, context) => {
  try {
    const value = new Prisma.Decimal(raw);
    if (!value.isFinite() || value.isNegative() || value.greaterThan('9999999999.99')) throw new Error();
    return value.toFixed(2);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid non-negative LWF amount.' });
    return z.NEVER;
  }
});

const settingSchema = z.object({
  employee_amount: amount,
  employer_amount: amount,
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().trim().max(500).nullish(),
}).strict();

const policySchema = z.object({
  state_id: z.string().uuid(),
  establishment_type: z.string().trim().min(1).max(120).nullish(),
  employee_amount: amount,
  employer_amount: amount,
  frequency: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly', 'custom']),
  schedule_months: z.array(z.coerce.number().int().min(1).max(12)).max(12).default([]),
  effective_from: z.coerce.date(),
  effective_to: z.coerce.date().nullish(),
  eligibility_min_gross: amount.nullish(),
  eligibility_max_gross: amount.nullish(),
  eligible_employee_categories: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  exemption_codes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  status: z.enum(['draft', 'active']).default('draft'),
  legal_reference: z.string().trim().max(1000).nullish(),
  notes: z.string().trim().max(4000).nullish(),
}).strict().superRefine((data, context) => {
  const months = [...new Set(data.schedule_months)];
  const required = data.frequency === 'quarterly' ? 4 : data.frequency === 'half_yearly' ? 2 : data.frequency === 'yearly' ? 1 : null;
  if (data.frequency !== 'monthly' && months.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['schedule_months'], message: 'Select at least one contribution month.' });
  if (required && months.length !== required) context.addIssue({ code: z.ZodIssueCode.custom, path: ['schedule_months'], message: `${data.frequency.replace('_', ' ')} policies require exactly ${required} contribution month${required === 1 ? '' : 's'}.` });
  if (data.effective_to && data.effective_to < data.effective_from) context.addIssue({ code: z.ZodIssueCode.custom, path: ['effective_to'], message: 'Effective-to date cannot be before effective-from date.' });
  if (data.eligibility_min_gross && data.eligibility_max_gross && new Prisma.Decimal(data.eligibility_min_gross).greaterThan(data.eligibility_max_gross)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['eligibility_max_gross'], message: 'Maximum eligible gross must be at least the minimum.' });
  if (data.status === 'active' && !data.legal_reference) context.addIssue({ code: z.ZodIssueCode.custom, path: ['legal_reference'], message: 'A verified legal or compliance reference is required before activation.' });
});

function normalizedPolicyData(data: z.infer<typeof policySchema>) {
  return {
    stateId: data.state_id,
    establishmentType: data.establishment_type || null,
    employeeAmount: new Prisma.Decimal(data.employee_amount), employerAmount: new Prisma.Decimal(data.employer_amount),
    frequency: data.frequency, scheduleMonths: JSON.stringify(data.frequency === 'monthly' ? [] : [...new Set(data.schedule_months)].sort((a, b) => a - b)),
    effectiveFrom: data.effective_from, effectiveTo: data.effective_to ?? null,
    eligibilityMinGross: data.eligibility_min_gross ? new Prisma.Decimal(data.eligibility_min_gross) : null,
    eligibilityMaxGross: data.eligibility_max_gross ? new Prisma.Decimal(data.eligibility_max_gross) : null,
    eligibleEmployeeCategories: JSON.stringify([...new Set(data.eligible_employee_categories)]),
    exemptionCodes: JSON.stringify([...new Set(data.exemption_codes)]),
    status: data.status, legalReference: data.legal_reference || null, notes: data.notes || null,
  };
}

async function assertNoPolicyOverlap(tx: Prisma.TransactionClient, candidate: ReturnType<typeof normalizedPolicyData>, excludeId?: string) {
  const rows = await tx.lwfPolicyVersion.findMany({ where: { stateId: candidate.stateId, status: { in: ['draft', 'active'] }, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  const establishment = candidate.establishmentType?.trim().toLocaleLowerCase('en-IN') ?? null;
  const end = candidate.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const overlaps = rows.some(row => {
    const rowEstablishment = row.establishmentType?.trim().toLocaleLowerCase('en-IN') ?? null;
    return rowEstablishment === establishment && row.effectiveFrom.getTime() <= end && (row.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY) >= candidate.effectiveFrom.getTime();
  });
  if (overlaps) throw new HttpError(409, 'An LWF policy already covers this state, establishment and effective-date range. Close or supersede that version first.');
}

async function assertPersistedSuperAdmin(req: Request) {
  if (req.delegatedAdminPermissions?.includes('platform.lwf')) return;
  const actor = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true, accountStatus: true } });
  if (!actor || actor.role !== 'super_admin' || actor.accountStatus !== 'active') throw new HttpError(403, 'Only an active Super Admin can manage the standard LWF rates.');
}

/** GET /admin/lwf-master */
export async function master(req: Request, res: Response) {
  await assertPersistedSuperAdmin(req);
  const row = await prisma.lwfMasterSetting.findUnique({ where: { scopeKey: 'STANDARD' } });
  return res.json({ setting: snakeKeys(row) });
}

/** GET /admin/lwf-effective/:employer -- preview the policy that will apply to an employer. */
export async function adminEffective(req: Request, res: Response) {
  const employer = await prisma.user.findUnique({ where: { id: req.params.employer }, select: { role: true } });
  if (!employer || employer.role !== 'employer') throw new HttpError(404, 'Employer account not found.');
  return res.json({ effective: snakeKeys(await resolveEffectiveLwfSetting(prisma, req.params.employer)) });
}

/** POST /admin/lwf-master -- create or replace the platform standard. */
export async function saveMaster(req: Request, res: Response) {
  await assertPersistedSuperAdmin(req);
  const data = settingSchema.parse(req.body);
  const payload = {
    employeeAmount: new Prisma.Decimal(data.employee_amount),
    employerAmount: new Prisma.Decimal(data.employer_amount),
    status: data.status,
    notes: data.notes || null,
    updatedByUserId: req.user!.id,
  };
  const row = await prisma.lwfMasterSetting.upsert({
    where: { scopeKey: 'STANDARD' },
    create: { scopeKey: 'STANDARD', ...payload, createdByUserId: req.user!.id },
    update: payload,
  });
  return res.json({ setting: snakeKeys(row) });
}

/** GET /employer/lwf-setting */
export async function employerSetting(req: Request, res: Response) {
  const [masterRow, override, effective] = await Promise.all([
    prisma.lwfMasterSetting.findUnique({ where: { scopeKey: 'STANDARD' } }),
    prisma.employerLwfSetting.findUnique({ where: { employerUserId: req.user!.id } }),
    resolveEffectiveLwfSetting(prisma, req.user!.id),
  ]);
  return res.json({
    master: snakeKeys(masterRow),
    override: snakeKeys(override),
    effective: snakeKeys(effective),
  });
}

/** POST /employer/lwf-setting -- employer-only override of the platform standard. */
export async function saveEmployerSetting(req: Request, res: Response) {
  const masterRow = await prisma.lwfMasterSetting.findUnique({ where: { scopeKey: 'STANDARD' }, select: { id: true } });
  if (!masterRow) throw new HttpError(422, 'The Super Admin must configure the standard LWF rates before an employer can create an override.');
  const data = settingSchema.parse(req.body);
  const payload = {
    employeeAmount: new Prisma.Decimal(data.employee_amount),
    employerAmount: new Prisma.Decimal(data.employer_amount),
    status: data.status,
    notes: data.notes || null,
  };
  const row = await prisma.employerLwfSetting.upsert({
    where: { employerUserId: req.user!.id },
    create: { employerUserId: req.user!.id, ...payload },
    update: payload,
  });
  return res.json({ override: snakeKeys(row) });
}

/** DELETE /employer/lwf-setting -- revert to the Super Admin standard. */
export async function resetEmployerSetting(req: Request, res: Response) {
  await prisma.employerLwfSetting.deleteMany({ where: { employerUserId: req.user!.id } });
  return res.json({ message: 'Employer LWF override removed. The Super Admin standard now applies.' });
}

/** GET /admin/lwf-policies */
export async function policies(req: Request, res: Response) {
  await assertPersistedSuperAdmin(req);
  const stateId = typeof req.query.state_id === 'string' ? req.query.state_id : undefined;
  const rows = await prisma.lwfPolicyVersion.findMany({
    where: stateId ? { stateId } : undefined,
    include: { state: true, auditEvents: { orderBy: { createdAt: 'desc' }, take: 25 } },
    orderBy: [{ state: { name: 'asc' } }, { effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
  });
  return res.json(snakeKeys(rows));
}

/** POST /admin/lwf-policies */
export async function createPolicy(req: Request, res: Response) {
  await assertPersistedSuperAdmin(req);
  const data = policySchema.parse(req.body);
  const payload = normalizedPolicyData(data);
  const state = await prisma.stateMaster.findFirst({ where: { id: data.state_id, status: 'active' } });
  if (!state) throw new HttpError(422, 'Select an active State Master record.');
  const row = await prisma.$transaction(async tx => {
    await assertNoPolicyOverlap(tx, payload);
    const latest = await tx.lwfPolicyVersion.findFirst({ where: { stateId: data.state_id }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
    const created = await tx.lwfPolicyVersion.create({ data: { ...payload, versionNumber: (latest?.versionNumber ?? 0) + 1, createdByUserId: req.user!.id, updatedByUserId: req.user!.id, ...(data.status === 'active' ? { activatedByUserId: req.user!.id, activatedAt: new Date() } : {}) } });
    await tx.lwfPolicyAuditEvent.create({ data: { policyVersionId: created.id, actorUserId: req.user!.id, action: data.status === 'active' ? 'created_and_activated' : 'created_draft', snapshot: JSON.stringify(policySnapshot(created, { id: state.id, code: state.code, name: state.name })) } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return res.status(201).json(snakeKeys(row));
}

/** PATCH /admin/lwf-policies/:policy -- draft versions only. */
export async function updatePolicy(req: Request, res: Response) {
  await assertPersistedSuperAdmin(req);
  const existing = await prisma.lwfPolicyVersion.findUnique({ where: { id: req.params.policy } });
  if (!existing) throw new HttpError(404, 'LWF policy version not found.');
  if (existing.status !== 'draft') throw new HttpError(409, 'Activated or historical LWF policy versions are immutable. Create a new version instead.');
  const data = policySchema.parse(req.body);
  const payload = normalizedPolicyData(data);
  const row = await prisma.$transaction(async tx => {
    await assertNoPolicyOverlap(tx, payload, existing.id);
    const updated = await tx.lwfPolicyVersion.update({ where: { id: existing.id }, data: { ...payload, updatedByUserId: req.user!.id, ...(data.status === 'active' ? { activatedByUserId: req.user!.id, activatedAt: new Date() } : {}) } });
    await tx.lwfPolicyAuditEvent.create({ data: { policyVersionId: updated.id, actorUserId: req.user!.id, action: data.status === 'active' ? 'activated' : 'draft_updated', snapshot: JSON.stringify(policySnapshot(updated)) } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return res.json(snakeKeys(row));
}

const closeSchema = z.object({ effective_to: z.coerce.date(), reason: z.string().trim().min(5).max(1000) }).strict();
/** POST /admin/lwf-policies/:policy/close */
export async function closePolicy(req: Request, res: Response) {
  await assertPersistedSuperAdmin(req);
  const data = closeSchema.parse(req.body);
  const existing = await prisma.lwfPolicyVersion.findUnique({ where: { id: req.params.policy } });
  if (!existing) throw new HttpError(404, 'LWF policy version not found.');
  if (existing.status !== 'active') throw new HttpError(409, 'Only an active policy can be closed.');
  if (data.effective_to < existing.effectiveFrom) throw new HttpError(422, 'Closure date cannot be before the policy effective-from date.');
  const row = await prisma.$transaction(async tx => {
    const updated = await tx.lwfPolicyVersion.update({ where: { id: existing.id }, data: { effectiveTo: data.effective_to, status: 'inactive', updatedByUserId: req.user!.id } });
    await tx.lwfPolicyAuditEvent.create({ data: { policyVersionId: updated.id, actorUserId: req.user!.id, action: 'closed', reason: data.reason, snapshot: JSON.stringify(policySnapshot(updated)) } });
    return updated;
  });
  return res.json(snakeKeys(row));
}

const previewSchema = z.object({
  state_id: z.string().uuid().optional(), state: z.string().trim().max(150).optional(), establishment_type: z.string().trim().max(120).optional(),
  effective_date: z.coerce.date().default(() => new Date()), gross_amount: amount.optional(), employee_category: z.string().trim().max(120).optional(), exemption_code: z.string().trim().max(120).optional(),
});

export async function previewPolicy(req: Request, res: Response) {
  const data = previewSchema.parse(req.query);
  const resolution = await resolveLwfPolicy(prisma, { stateId: data.state_id, stateText: data.state, establishmentType: data.establishment_type, effectiveDate: data.effective_date, grossAmount: data.gross_amount, employeeCategory: data.employee_category, exemptionCode: data.exemption_code });
  return res.json(snakeKeys({ ...resolution, policy: resolution.policy ? policySnapshot(resolution.policy, resolution.state) : null }));
}

/** GET /employer/lwf-policies -- read-only policies matching owned establishment states. */
export async function employerPolicies(req: Request, res: Response) {
  const [companies, sites] = await Promise.all([
    prisma.employerCompany.findMany({ where: { employerUserId: req.user!.id }, select: { state: true } }),
    prisma.companySite.findMany({ where: { employerUserId: req.user!.id }, select: { state: true } }),
  ]);
  const texts = new Set([...companies, ...sites].map(row => row.state?.trim().toLocaleLowerCase('en-IN')).filter(Boolean));
  const states = await prisma.stateMaster.findMany({ where: { status: 'active' }, select: { id: true, code: true, name: true } });
  const stateIds = states.filter(state => texts.has(state.name.trim().toLocaleLowerCase('en-IN')) || texts.has(state.code.trim().toLocaleLowerCase('en-IN'))).map(state => state.id);
  const rows = stateIds.length ? await prisma.lwfPolicyVersion.findMany({ where: { stateId: { in: stateIds }, status: 'active' }, include: { state: true }, orderBy: [{ state: { name: 'asc' } }, { effectiveFrom: 'desc' }] }) : [];
  return res.json(snakeKeys(rows));
}
