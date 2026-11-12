import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { serializeOut } from '../utils/serialize';
import { calculateSalaryStructure, normalizeSalaryPaymentFrequency } from '../services/salaryStructureService';
import { assessAndSnapshotJobMinimumWage, compareQualifyingWage, resolveMinimumWage } from '../services/minimumWageService';

const dateValue = z.coerce.date();
const optionalText = (max = 500) => z.string().trim().max(max).nullish().transform(value => value || null);
const amount = z.union([z.string(), z.number()]).transform((raw, context) => {
  try {
    const value = new Prisma.Decimal(raw);
    if (!value.isFinite() || value.isNegative() || value.greaterThan('999999999999.99')) throw new Error();
    return value.toFixed(2);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid non-negative amount.' });
    return z.NEVER;
  }
});

const rateSchema = z.object({
  state_ut_code: z.string().trim().min(2).max(20).transform(value => value.toUpperCase()),
  district_code: optionalText(100), zone_code: optionalText(100), employment_category_code: optionalText(150),
  occupation_code: optionalText(150), skill_category_code: optionalText(100),
  effective_from: dateValue, effective_to: dateValue.nullish(), wage_unit: z.enum(['MONTHLY', 'DAILY', 'HOURLY', 'WEEKLY']),
  basic_wage: amount, variable_dearness_allowance: amount.default('0'), other_mandatory_wage_components: amount.default('0'),
  total_notified_minimum_wage: amount, qualifying_component_codes: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  applicability_conditions: z.record(z.unknown()).nullish(), conversion_basis: z.record(z.unknown()).nullish(),
}).superRefine((row, context) => {
  const total = new Prisma.Decimal(row.basic_wage).add(row.variable_dearness_allowance).add(row.other_mandatory_wage_components);
  if (!total.equals(row.total_notified_minimum_wage)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['total_notified_minimum_wage'], message: 'Total minimum wage must equal Basic + VDA + other mandatory components.' });
  if (row.effective_to && row.effective_to < row.effective_from) context.addIssue({ code: z.ZodIssueCode.custom, path: ['effective_to'], message: 'Rate end date must not be before its start date.' });
});

const notificationSchema = z.object({
  jurisdiction_id: z.string().uuid(), notification_number: z.string().trim().min(1).max(180),
  notification_title: z.string().trim().min(1).max(500), issuing_authority: z.string().trim().min(1).max(300),
  publication_date: dateValue, effective_from: dateValue, effective_to: dateValue.nullish(),
  notification_type: z.enum(['original', 'amendment', 'revision', 'corrigendum']).default('original'),
  amendment_of_id: z.string().uuid().nullish(), source_url: optionalText(1000), source_document_path: optionalText(1000),
  source_document_hash: optionalText(128), next_review_at: dateValue.nullish(), remarks: optionalText(10000),
  rates: z.array(rateSchema).min(1).max(1000),
}).superRefine((row, context) => {
  if (!row.source_url && !row.source_document_path) context.addIssue({ code: z.ZodIssueCode.custom, path: ['source_url'], message: 'Add an official source URL or stored source document reference.' });
  if (row.effective_to && row.effective_to < row.effective_from) context.addIssue({ code: z.ZodIssueCode.custom, path: ['effective_to'], message: 'Notification end date must not be before its start date.' });
  if (row.notification_type === 'amendment' && !row.amendment_of_id) context.addIssue({ code: z.ZodIssueCode.custom, path: ['amendment_of_id'], message: 'Select the notification being amended.' });
  row.rates.forEach((rate, index) => {
    if (rate.effective_from < row.effective_from) context.addIssue({ code: z.ZodIssueCode.custom, path: ['rates', index, 'effective_from'], message: 'A rate cannot start before its notification.' });
    if (row.effective_to && (!rate.effective_to || rate.effective_to > row.effective_to)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['rates', index, 'effective_to'], message: 'A rate must end within the notification period.' });
  });
});

const resolveSchema = z.object({
  state_code: optionalText(20), state: optionalText(150), district_code: optionalText(100), zone_code: optionalText(100),
  job_role_code: optionalText(150), employment_category_code: optionalText(150), occupation_code: optionalText(150),
  skill_category_code: optionalText(100), appropriate_government: z.enum(['STATE', 'CENTRAL']).nullish(),
  effective_date: dateValue, wage_unit: z.enum(['MONTHLY', 'DAILY', 'HOURLY', 'WEEKLY']),
  salary_structure: z.unknown().optional(), payment_type: z.enum(['Monthly', 'Daily']).optional(),
});

const mapRateData = (rate: z.infer<typeof rateSchema>, jurisdictionId: string) => ({
  jurisdictionId, stateUtCode: rate.state_ut_code, districtCode: rate.district_code, zoneCode: rate.zone_code,
  employmentCategoryCode: rate.employment_category_code, occupationCode: rate.occupation_code, skillCategoryCode: rate.skill_category_code,
  effectiveFrom: rate.effective_from, effectiveTo: rate.effective_to, wageUnit: rate.wage_unit,
  basicWage: rate.basic_wage, variableDearnessAllowance: rate.variable_dearness_allowance,
  otherMandatoryWageComponents: rate.other_mandatory_wage_components, totalNotifiedMinimumWage: rate.total_notified_minimum_wage,
  qualifyingComponentCodes: JSON.stringify([...new Set(rate.qualifying_component_codes.map(code => code.toUpperCase()))]),
  applicabilityConditions: rate.applicability_conditions ? JSON.stringify(rate.applicability_conditions) : null,
  conversionBasis: rate.conversion_basis ? JSON.stringify(rate.conversion_basis) : null, approvalStatus: 'draft',
});

export async function jurisdictions(_req: Request, res: Response) {
  const rows = await prisma.minimumWageJurisdiction.findMany({ orderBy: [{ jurisdictionType: 'asc' }, { jurisdictionName: 'asc' }] });
  return res.json(serializeOut(rows));
}

export async function coverage(_req: Request, res: Response) {
  const rows = await prisma.minimumWageCoverage.findMany({ include: { jurisdiction: true }, orderBy: { stateUtName: 'asc' } });
  return res.json(serializeOut(rows));
}

export async function notifications(_req: Request, res: Response) {
  const rows = await prisma.minimumWageNotification.findMany({
    include: { jurisdiction: true, rates: { orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }] } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });
  return res.json(serializeOut(rows, ['qualifying_component_codes', 'applicability_conditions', 'conversion_basis']));
}

export async function storeNotification(req: Request, res: Response) {
  const data = notificationSchema.parse(req.body);
  const duplicate = await prisma.minimumWageNotification.findFirst({ where: {
    jurisdictionId: data.jurisdiction_id,
    OR: [{ notificationNumber: data.notification_number }, ...(data.source_document_hash ? [{ sourceDocumentHash: data.source_document_hash }] : [])],
  } });
  if (duplicate) throw new HttpError(409, 'This notification number or source document was already imported.');
  const jurisdiction = await prisma.minimumWageJurisdiction.findFirst({ where: { id: data.jurisdiction_id, status: 'active' } });
  if (!jurisdiction) throw new HttpError(422, 'Select an active minimum-wage jurisdiction.');
  if (data.amendment_of_id) {
    const amended = await prisma.minimumWageNotification.findUnique({ where: { id: data.amendment_of_id } });
    if (!amended || amended.jurisdictionId !== jurisdiction.id) throw new HttpError(422, 'The amended notification must belong to the same jurisdiction.');
  }
  if (data.rates.some(rate => jurisdiction.stateUtCode && !sameCode(rate.state_ut_code, jurisdiction.stateUtCode))) throw new HttpError(422, 'Every rate must use the selected jurisdiction state/UT code.');
  const created = await prisma.$transaction(async tx => {
    const row = await tx.minimumWageNotification.create({ data: {
      jurisdictionId: data.jurisdiction_id, notificationNumber: data.notification_number, notificationTitle: data.notification_title,
      issuingAuthority: data.issuing_authority, publicationDate: data.publication_date, effectiveFrom: data.effective_from,
      effectiveTo: data.effective_to, notificationType: data.notification_type, amendmentOfId: data.amendment_of_id,
      sourceUrl: data.source_url, sourceDocumentPath: data.source_document_path, sourceDocumentHash: data.source_document_hash,
      verificationStatus: 'under_review', workflowStage: 'validated', nextReviewAt: data.next_review_at, remarks: data.remarks,
      createdByUserId: req.user!.id,
    } });
    await tx.minimumWageRate.createMany({ data: data.rates.map(rate => ({ notificationId: row.id, ...mapRateData(rate, data.jurisdiction_id) })) });
    await tx.minimumWageComplianceAudit.create({ data: { actorUserId: req.user!.id, action: 'notification_imported', entityType: 'notification', entityId: row.id, notificationId: row.id, newValues: JSON.stringify({ notification_number: data.notification_number, rate_count: data.rates.length }), sourceReference: data.source_url ?? data.source_document_path } });
    await tx.minimumWageCoverage.updateMany({ where: { jurisdictionId: jurisdiction.id, coverageStatus: 'NOT_STARTED' }, data: { coverageStatus: 'UNDER_REVIEW', updatedByUserId: req.user!.id } });
    return tx.minimumWageNotification.findUniqueOrThrow({ where: { id: row.id }, include: { jurisdiction: true, rates: true } });
  });
  return res.status(201).json(serializeOut(created));
}

function sameCode(left: unknown, right: unknown) { return String(left ?? '').trim().toUpperCase() === String(right ?? '').trim().toUpperCase(); }

export async function approveNotification(req: Request, res: Response) {
  const id = z.string().uuid().parse(req.params.notification);
  const row = await prisma.minimumWageNotification.findUnique({ where: { id }, include: { rates: true, jurisdiction: true } });
  if (!row) throw new HttpError(404, 'Minimum-wage notification not found.');
  if (!['draft', 'under_review'].includes(row.verificationStatus)) throw new HttpError(409, 'Only a draft or under-review notification can be approved.');
  if (!row.sourceUrl && !row.sourceDocumentPath) throw new HttpError(422, 'An official source URL or document is required before approval.');
  if (!row.rates.length) throw new HttpError(422, 'Add at least one wage rate before approval.');
  for (const rate of row.rates) {
    let codes: unknown;
    try { codes = JSON.parse(rate.qualifyingComponentCodes); } catch { codes = null; }
    if (!Array.isArray(codes) || !codes.length) throw new HttpError(422, `Rate ${rate.id} must name at least one legally qualifying salary component.`);
    const conflicts = await prisma.minimumWageRate.findMany({ where: {
      id: { not: rate.id }, jurisdictionId: rate.jurisdictionId, stateUtCode: rate.stateUtCode, wageUnit: rate.wageUnit, approvalStatus: 'approved',
      districtCode: rate.districtCode, zoneCode: rate.zoneCode, employmentCategoryCode: rate.employmentCategoryCode,
      occupationCode: rate.occupationCode, skillCategoryCode: rate.skillCategoryCode,
      effectiveFrom: { lte: rate.effectiveTo ?? new Date('9999-12-31') }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: rate.effectiveFrom } }],
    } });
    if (conflicts.length) throw new HttpError(409, `Rate ${rate.id} overlaps an already approved rate for the same classification. Close or supersede the earlier period first.`, { conflicting_rate_ids: conflicts.map(item => item.id) });
  }
  const now = new Date();
  const approved = await prisma.$transaction(async tx => {
    await tx.minimumWageRate.updateMany({ where: { notificationId: id }, data: { approvalStatus: 'approved' } });
    const updated = await tx.minimumWageNotification.update({ where: { id }, data: { verificationStatus: 'approved', workflowStage: 'published', verifiedByUserId: req.user!.id, verifiedAt: now, approvedByUserId: req.user!.id, approvedAt: now, lastVerifiedAt: now } });
    const count = await tx.minimumWageNotification.count({ where: { jurisdictionId: row.jurisdictionId, verificationStatus: 'approved', workflowStage: 'published' } });
    await tx.minimumWageCoverage.updateMany({ where: { jurisdictionId: row.jurisdictionId }, data: { coverageStatus: 'PARTIALLY_VERIFIED', verifiedNotificationCount: count, lastVerifiedAt: now, updatedByUserId: req.user!.id } });
    await tx.minimumWageComplianceAudit.create({ data: { actorUserId: req.user!.id, action: 'notification_approved', entityType: 'notification', entityId: id, notificationId: id, previousValues: JSON.stringify({ verification_status: row.verificationStatus }), newValues: JSON.stringify({ verification_status: 'approved', rate_count: row.rates.length }), sourceReference: row.sourceUrl ?? row.sourceDocumentPath } });
    return updated;
  });
  return res.json(serializeOut(approved));
}

export async function rejectNotification(req: Request, res: Response) {
  const id = z.string().uuid().parse(req.params.notification);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(1000) }).parse(req.body);
  const row = await prisma.minimumWageNotification.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, 'Minimum-wage notification not found.');
  if (row.verificationStatus === 'approved') throw new HttpError(409, 'Use the auditable revoke action for an approved notification.');
  const updated = await prisma.$transaction(async tx => {
    await tx.minimumWageRate.updateMany({ where: { notificationId: id }, data: { approvalStatus: 'rejected' } });
    const result = await tx.minimumWageNotification.update({ where: { id }, data: { verificationStatus: 'rejected', workflowStage: 'rejected', remarks: reason } });
    await tx.minimumWageComplianceAudit.create({ data: { actorUserId: req.user!.id, action: 'notification_rejected', entityType: 'notification', entityId: id, notificationId: id, reason } });
    return result;
  });
  return res.json(serializeOut(updated));
}

export async function revokeNotification(req: Request, res: Response) {
  const id = z.string().uuid().parse(req.params.notification);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(1000) }).parse(req.body);
  const row = await prisma.minimumWageNotification.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, 'Minimum-wage notification not found.');
  if (row.verificationStatus !== 'approved') throw new HttpError(409, 'Only an approved notification can be revoked.');
  const updated = await prisma.$transaction(async tx => {
    await tx.minimumWageRate.updateMany({ where: { notificationId: id }, data: { approvalStatus: 'revoked' } });
    const result = await tx.minimumWageNotification.update({ where: { id }, data: { verificationStatus: 'revoked', workflowStage: 'revoked', remarks: reason } });
    const count = await tx.minimumWageNotification.count({ where: { jurisdictionId: row.jurisdictionId, verificationStatus: 'approved', workflowStage: 'published' } });
    await tx.minimumWageCoverage.updateMany({ where: { jurisdictionId: row.jurisdictionId }, data: { coverageStatus: count ? 'PARTIALLY_VERIFIED' : 'REQUIRES_UPDATE', verifiedNotificationCount: count, updatedByUserId: req.user!.id } });
    await tx.minimumWageComplianceAudit.create({ data: { actorUserId: req.user!.id, action: 'notification_revoked', entityType: 'notification', entityId: id, notificationId: id, reason, previousValues: JSON.stringify({ verification_status: 'approved' }), newValues: JSON.stringify({ verification_status: 'revoked' }) } });
    return result;
  });
  return res.json(serializeOut(updated));
}

export async function mappings(_req: Request, res: Response) {
  const rows = await prisma.jobRoleSkillMapping.findMany({ include: { jurisdiction: true }, orderBy: [{ jobRoleCode: 'asc' }, { updatedAt: 'desc' }] });
  return res.json(serializeOut(rows));
}

export async function storeMapping(req: Request, res: Response) {
  const data = z.object({
    jurisdiction_id: z.string().uuid().nullish(), job_role_code: z.string().trim().min(1).max(150),
    employment_category_code: optionalText(150), occupation_code: optionalText(150), skill_category_code: z.string().trim().min(1).max(100),
    legal_reference: z.string().trim().min(5).max(1000), status: z.enum(['draft', 'approved']).default('draft'),
  }).parse(req.body);
  const duplicate = await prisma.jobRoleSkillMapping.findFirst({ where: { jurisdictionId: data.jurisdiction_id, jobRoleCode: data.job_role_code.toUpperCase(), employmentCategoryCode: data.employment_category_code, occupationCode: data.occupation_code } });
  if (duplicate) throw new HttpError(409, 'A mapping already exists for this jurisdiction, role, employment category and occupation.');
  const row = await prisma.jobRoleSkillMapping.create({ data: {
    jurisdictionId: data.jurisdiction_id, jobRoleCode: data.job_role_code.toUpperCase(), employmentCategoryCode: data.employment_category_code,
    occupationCode: data.occupation_code, skillCategoryCode: data.skill_category_code.toUpperCase(), mappingStatus: data.status,
    legalReference: data.legal_reference, createdByUserId: req.user!.id, approvedByUserId: data.status === 'approved' ? req.user!.id : null, approvedAt: data.status === 'approved' ? new Date() : null,
  } });
  await prisma.minimumWageComplianceAudit.create({ data: { actorUserId: req.user!.id, action: 'role_mapping_created', entityType: 'role_mapping', entityId: row.id, newValues: JSON.stringify(data), sourceReference: data.legal_reference } });
  return res.status(201).json(serializeOut(row));
}

export async function resolvePreview(req: Request, res: Response) {
  const data = resolveSchema.parse(req.body);
  const resolution = await resolveMinimumWage(prisma, {
    stateCode: data.state_code, stateName: data.state, districtCode: data.district_code, zoneCode: data.zone_code,
    jobRoleCode: data.job_role_code, employmentCategoryCode: data.employment_category_code, occupationCode: data.occupation_code,
    skillCategoryCode: data.skill_category_code, appropriateGovernment: data.appropriate_government,
    effectiveDate: data.effective_date, wageUnit: data.wage_unit,
  });
  let comparison = null;
  if (data.salary_structure && data.payment_type) {
    const calculated = calculateSalaryStructure(data.salary_structure, [], normalizeSalaryPaymentFrequency(data.payment_type));
    comparison = compareQualifyingWage(resolution, calculated.components.map(component => ({ ...component, monthlyAmount: component.monthly_amount })));
  }
  const { rate: _rate, ...safeResolution } = resolution as typeof resolution & { rate?: unknown };
  return res.json(serializeOut({ ...safeResolution, comparison }));
}

export async function validateJob(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job } });
  if (!job) throw new HttpError(404, 'Job not found.');
  if (req.user!.role === 'employer' && job.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');
  const result = await prisma.$transaction(tx => assessAndSnapshotJobMinimumWage(tx, job.id, req.adminEmployerAccess?.actor_id ?? req.user!.id, 'manual_validation'));
  const { rate: _rate, ...resolution } = result.resolution as typeof result.resolution & { rate?: unknown };
  return res.json(serializeOut({ resolution, comparison: result.comparison, snapshot: result.snapshot }));
}

export async function jobCompliance(req: Request, res: Response) {
  const job = await prisma.jobPost.findUnique({ where: { id: req.params.job }, include: { minimumWageSnapshots: { orderBy: { checkedAt: 'desc' }, take: 50 } } });
  if (!job) throw new HttpError(404, 'Job not found.');
  if (req.user!.role === 'employer' && job.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');
  return res.json(serializeOut(job.minimumWageSnapshots, ['policy_snapshot', 'qualifying_wage_snapshot']));
}

export async function complianceJobs(_req: Request, res: Response) {
  const jobs = await prisma.jobPost.findMany({
    include: { company: { select: { companyName: true } }, site: { select: { siteName: true, city: true, state: true } }, minimumWageSnapshots: { where: { isCurrent: true }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
  });
  return res.json(serializeOut(jobs));
}

export async function audits(_req: Request, res: Response) {
  const rows = await prisma.minimumWageComplianceAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  return res.json(serializeOut(rows, ['previous_values', 'new_values']));
}

