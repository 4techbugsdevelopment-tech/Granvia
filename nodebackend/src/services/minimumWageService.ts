import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/http';

export const MINIMUM_WAGE_RESOLVER_VERSION = '1.0.0';

export type MinimumWageResolutionStatus =
  | 'VERIFIED'
  | 'REVIEW_REQUIRED'
  | 'NOT_AVAILABLE'
  | 'CONFLICT_DETECTED'
  | 'STALE_DATA'
  | 'INVALID_LOCATION'
  | 'INVALID_CLASSIFICATION';

export type MinimumWageResolutionInput = {
  stateCode?: string | null;
  stateName?: string | null;
  districtCode?: string | null;
  zoneCode?: string | null;
  jobRoleCode?: string | null;
  employmentCategoryCode?: string | null;
  occupationCode?: string | null;
  skillCategoryCode?: string | null;
  appropriateGovernment?: 'STATE' | 'CENTRAL' | null;
  effectiveDate: Date;
  wageUnit: 'MONTHLY' | 'DAILY' | 'HOURLY' | 'WEEKLY';
};

type ResolutionDb = Pick<Prisma.TransactionClient,
  'minimumWageJurisdiction' | 'minimumWageRate' | 'jobRoleSkillMapping'>;

const norm = (value: unknown) => String(value ?? '').trim().toLocaleUpperCase('en-IN');
const same = (left: unknown, right: unknown) => norm(left) === norm(right);
const dateOnly = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const money = (value: Prisma.Decimal | string | number) => new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

function unresolved(status: Exclude<MinimumWageResolutionStatus, 'VERIFIED'>, reason: string, input: MinimumWageResolutionInput, extra: Record<string, unknown> = {}) {
  return {
    status,
    reason,
    applicableRate: null,
    notification: null,
    resolution: {
      jurisdiction: null,
      districtCode: input.districtCode ?? null,
      zoneCode: input.zoneCode ?? null,
      employmentCategoryCode: input.employmentCategoryCode ?? null,
      occupationCode: input.occupationCode ?? null,
      skillCategoryCode: input.skillCategoryCode ?? null,
    },
    resolverVersion: MINIMUM_WAGE_RESOLVER_VERSION,
    ...extra,
  };
}

function matchDimension(rateValue: string | null, inputValue: string | null | undefined) {
  return rateValue == null || (!!inputValue && same(rateValue, inputValue));
}

export async function resolveMinimumWage(db: ResolutionDb, raw: MinimumWageResolutionInput) {
  const input = { ...raw, effectiveDate: dateOnly(raw.effectiveDate) };
  const stateCode = norm(input.stateCode);
  const stateName = String(input.stateName ?? '').trim();
  if (!stateCode && !stateName) return unresolved('INVALID_LOCATION', 'Select a verified work state or Union Territory.', input);

  const government = input.appropriateGovernment ?? 'STATE';
  const jurisdictions = await db.minimumWageJurisdiction.findMany({ where: { status: 'active' } });
  const locationJurisdiction = jurisdictions.find(row => row.jurisdictionType !== 'central' && ((stateCode && same(row.stateUtCode, stateCode)) || (stateName && same(row.jurisdictionName, stateName))));
  if (!locationJurisdiction) return unresolved('INVALID_LOCATION', 'The work state or Union Territory is not mapped to an active minimum-wage jurisdiction.', input);
  const jurisdiction = government === 'CENTRAL'
    ? jurisdictions.find(row => row.jurisdictionType === 'central' && row.appropriateGovernment === 'CENTRAL')
    : locationJurisdiction;
  if (!jurisdiction) return unresolved('INVALID_LOCATION', 'The selected appropriate-government jurisdiction is not configured.', input);
  const resolvedStateCode = locationJurisdiction.stateUtCode!;

  let employmentCategoryCode = input.employmentCategoryCode ?? null;
  let occupationCode = input.occupationCode ?? null;
  let skillCategoryCode = input.skillCategoryCode ?? null;
  if (input.jobRoleCode && (!skillCategoryCode || !occupationCode)) {
    const mappings = await db.jobRoleSkillMapping.findMany({
      where: {
        jobRoleCode: norm(input.jobRoleCode), mappingStatus: 'approved',
        OR: [{ jurisdictionId: jurisdiction.id }, { jurisdictionId: null }],
      },
      orderBy: [{ jurisdictionId: 'desc' }, { updatedAt: 'desc' }],
    });
    const bestScope = mappings.some(row => row.jurisdictionId === jurisdiction.id)
      ? mappings.filter(row => row.jurisdictionId === jurisdiction.id)
      : mappings.filter(row => row.jurisdictionId == null);
    const signatures = new Set(bestScope.map(row => [row.employmentCategoryCode, row.occupationCode, row.skillCategoryCode].map(norm).join('|')));
    if (signatures.size > 1) return unresolved('INVALID_CLASSIFICATION', 'More than one approved classification mapping applies to this job role.', input, { jurisdiction });
    if (bestScope[0]) {
      employmentCategoryCode ??= bestScope[0].employmentCategoryCode;
      occupationCode ??= bestScope[0].occupationCode;
      skillCategoryCode ??= bestScope[0].skillCategoryCode;
    }
  }

  const baseRates = await db.minimumWageRate.findMany({
    where: {
      jurisdictionId: jurisdiction.id,
      stateUtCode: resolvedStateCode,
      wageUnit: input.wageUnit,
      approvalStatus: 'approved',
      effectiveFrom: { lte: input.effectiveDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveDate } }],
      notification: {
        verificationStatus: 'approved', workflowStage: 'published',
        effectiveFrom: { lte: input.effectiveDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveDate } }],
      },
    },
    include: { notification: true, jurisdiction: true },
  });
  if (!baseRates.length) return unresolved('NOT_AVAILABLE', 'No approved minimum-wage rate is available for this location, date and wage unit.', input, { jurisdiction });

  const requiredDimensions: Array<[string, string | null | undefined, string | null]> = [
    ['district', input.districtCode, baseRates.find(row => row.districtCode)?.districtCode ?? null],
    ['zone', input.zoneCode, baseRates.find(row => row.zoneCode)?.zoneCode ?? null],
    ['employment category', employmentCategoryCode, baseRates.find(row => row.employmentCategoryCode)?.employmentCategoryCode ?? null],
    ['occupation', occupationCode, baseRates.find(row => row.occupationCode)?.occupationCode ?? null],
    ['skill category', skillCategoryCode, baseRates.find(row => row.skillCategoryCode)?.skillCategoryCode ?? null],
  ];
  const missing = requiredDimensions.filter(([, supplied, required]) => required != null && !supplied).map(([label]) => label);
  if (missing.length) return unresolved('REVIEW_REQUIRED', `Select or approve the required ${missing.join(', ')} classification before the wage can be resolved.`, input, { jurisdiction });

  const matches = baseRates.filter(rate =>
    matchDimension(rate.districtCode, input.districtCode)
    && matchDimension(rate.zoneCode, input.zoneCode)
    && matchDimension(rate.employmentCategoryCode, employmentCategoryCode)
    && matchDimension(rate.occupationCode, occupationCode)
    && matchDimension(rate.skillCategoryCode, skillCategoryCode));
  if (!matches.length) return unresolved('NOT_AVAILABLE', 'Approved wage data exists for this jurisdiction, but none matches the selected location and classification.', input, { jurisdiction });

  const specificity = (rate: (typeof matches)[number]) => [rate.districtCode, rate.zoneCode, rate.employmentCategoryCode, rate.occupationCode, rate.skillCategoryCode].filter(Boolean).length;
  const maxSpecificity = Math.max(...matches.map(specificity));
  const best = matches.filter(rate => specificity(rate) === maxSpecificity);
  if (best.length !== 1) return unresolved('CONFLICT_DETECTED', 'More than one equally applicable approved wage rate was found. An administrator must resolve the overlap.', input, { jurisdiction, conflictingRateIds: best.map(row => row.id) });

  const rate = best[0];
  let qualifyingComponentCodes: string[];
  try {
    const parsed: unknown = JSON.parse(rate.qualifyingComponentCodes);
    qualifyingComponentCodes = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
  } catch { qualifyingComponentCodes = []; }
  if (!qualifyingComponentCodes.length) return unresolved('REVIEW_REQUIRED', 'The approved rate has no valid qualifying salary component definition.', input, { jurisdiction, rateId: rate.id, notificationId: rate.notification.id });
  const now = dateOnly(new Date());
  if (rate.notification.nextReviewAt && dateOnly(rate.notification.nextReviewAt) < now) {
    return unresolved('STALE_DATA', 'The applicable notification has passed its review date and must be verified again.', input, { jurisdiction, rateId: rate.id, notificationId: rate.notification.id });
  }
  return {
    status: 'VERIFIED' as const,
    reason: 'approved_effective_rate',
    applicableRate: {
      id: rate.id,
      amount: rate.totalNotifiedMinimumWage.toFixed(2),
      currency: rate.currency,
      unit: rate.wageUnit,
      basic: rate.basicWage.toFixed(2),
      vda: rate.variableDearnessAllowance.toFixed(2),
      otherMandatoryComponents: rate.otherMandatoryWageComponents.toFixed(2),
      qualifyingComponentCodes,
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
    },
    notification: {
      id: rate.notification.id,
      number: rate.notification.notificationNumber,
      title: rate.notification.notificationTitle,
      effectiveFrom: rate.notification.effectiveFrom,
      sourceUrl: rate.notification.sourceUrl,
      lastVerifiedAt: rate.notification.lastVerifiedAt,
    },
    resolution: {
      jurisdiction: { id: jurisdiction.id, name: jurisdiction.jurisdictionName, appropriateGovernment: jurisdiction.appropriateGovernment },
      stateUtCode: rate.stateUtCode,
      districtCode: rate.districtCode,
      zoneCode: rate.zoneCode,
      employmentCategoryCode: rate.employmentCategoryCode,
      occupationCode: rate.occupationCode,
      skillCategoryCode: rate.skillCategoryCode,
    },
    rate,
    resolverVersion: MINIMUM_WAGE_RESOLVER_VERSION,
  };
}

export function compareQualifyingWage(
  resolution: Awaited<ReturnType<typeof resolveMinimumWage>>,
  components: Array<{ code: string; name?: string; category: string; monthlyAmount: Prisma.Decimal | string | number; enabled: boolean }>,
) {
  if (resolution.status !== 'VERIFIED' || !resolution.applicableRate) {
    return { complianceStatus: 'REVIEW_REQUIRED' as const, qualifyingWage: null, shortfall: null, components: [] };
  }
  const codes = new Set(resolution.applicableRate.qualifyingComponentCodes.map(norm));
  if (!codes.size) return { complianceStatus: 'REVIEW_REQUIRED' as const, qualifyingWage: null, shortfall: null, components: [], reason: 'The approved rate does not define qualifying wage components.' };
  const included = components.filter(component => component.enabled && component.category === 'earning' && codes.has(norm(component.code)));
  const qualifying = money(included.reduce((sum, component) => sum.add(component.monthlyAmount), new Prisma.Decimal(0)));
  const floor = money(resolution.applicableRate.amount);
  const shortfall = floor.greaterThan(qualifying) ? floor.sub(qualifying).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : new Prisma.Decimal(0);
  return {
    complianceStatus: shortfall.isZero() ? 'COMPLIANT' as const : 'NON_COMPLIANT' as const,
    qualifyingWage: qualifying.toFixed(2),
    shortfall: shortfall.toFixed(2),
    components: included.map(component => ({ code: component.code, name: component.name ?? component.code, amount: money(component.monthlyAmount).toFixed(2) })),
  };
}

type JobAssessmentDb = Prisma.TransactionClient;

export async function assessAndSnapshotJobMinimumWage(db: JobAssessmentDb, jobId: string, actorUserId: string, triggerAction: string) {
  const job = await db.jobPost.findUnique({
    where: { id: jobId },
    include: {
      site: { select: { state: true, city: true } },
      company: { select: { state: true, city: true, businessType: true } },
      salaryStructure: { include: { components: true } },
    },
  });
  if (!job) throw new HttpError(404, 'Job not found while checking minimum wage.');
  const payment = norm(job.paymentType);
  const wageUnit = payment === 'MONTHLY' ? 'MONTHLY' : payment === 'WEEKLY' ? 'WEEKLY' : payment === 'DAILY' ? 'DAILY' : null;
  const effectiveDate = dateOnly(job.startDate ?? new Date());
  const stateName = job.site?.state ?? job.company?.state ?? null;
  const districtCode = job.site?.city ?? job.company?.city ?? null;
  const input: MinimumWageResolutionInput = {
    stateName, districtCode, jobRoleCode: job.guardType, employmentCategoryCode: job.category,
    effectiveDate, wageUnit: wageUnit ?? 'MONTHLY', appropriateGovernment: 'STATE',
  };
  const resolution = wageUnit
    ? await resolveMinimumWage(db, input)
    : unresolved('INVALID_CLASSIFICATION', 'Minimum-wage checking requires a Monthly, Weekly or Daily payment type.', input);
  const comparison = job.salaryStructure
    ? compareQualifyingWage(resolution, job.salaryStructure.components)
    : { complianceStatus: 'REVIEW_REQUIRED' as const, qualifyingWage: null, shortfall: null, components: [], reason: 'A structured salary is required for minimum-wage checking.' };
  const resolutionData = resolution.resolution as Record<string, any>;
  const rate = resolution.status === 'VERIFIED' ? resolution.rate : null;
  const notification = resolution.status === 'VERIFIED' ? resolution.notification : null;
  const policySnapshot = JSON.stringify({
    status: resolution.status, reason: resolution.reason, applicable_rate: resolution.applicableRate,
    notification, resolution: resolution.resolution, resolver_version: resolution.resolverVersion,
  });
  await db.jobMinimumWageSnapshot.updateMany({ where: { jobId, isCurrent: true }, data: { isCurrent: false } });
  const snapshot = await db.jobMinimumWageSnapshot.create({ data: {
    jobId, rateId: rate?.id ?? null, notificationId: notification?.id ?? null,
    stateUtCode: rate?.stateUtCode ?? null, districtCode: resolutionData.districtCode ?? districtCode,
    zoneCode: resolutionData.zoneCode ?? null, employmentCategoryCode: resolutionData.employmentCategoryCode ?? job.category,
    occupationCode: resolutionData.occupationCode ?? null, skillCategoryCode: resolutionData.skillCategoryCode ?? null,
    effectiveDate, wageUnit, appliedWageFloor: resolution.applicableRate?.amount ?? null,
    offeredQualifyingWage: comparison.qualifyingWage, shortfall: comparison.shortfall,
    resolutionStatus: resolution.status, complianceStatus: comparison.complianceStatus,
    resolutionReason: comparison.reason ?? resolution.reason, policySnapshot,
    qualifyingWageSnapshot: JSON.stringify(comparison.components), resolverVersion: MINIMUM_WAGE_RESOLVER_VERSION,
    triggerAction, checkedByUserId: actorUserId,
  } });
  await db.minimumWageComplianceAudit.create({ data: {
    actorUserId, action: 'job_wage_checked', entityType: 'job', entityId: jobId, jobId,
    notificationId: notification?.id ?? null, newValues: JSON.stringify({ snapshot_id: snapshot.id, resolution_status: resolution.status, compliance_status: comparison.complianceStatus }),
    reason: comparison.reason ?? resolution.reason, sourceReference: notification?.sourceUrl ?? null,
  } });
  return { resolution, comparison, snapshot };
}

export function assertMinimumWagePublishable(result: Awaited<ReturnType<typeof assessAndSnapshotJobMinimumWage>>) {
  if (result.resolution.status !== 'VERIFIED') {
    throw new HttpError(422, `Minimum wage review required: ${result.resolution.reason}`, { errors: { minimum_wage: [result.resolution.reason] }, minimum_wage: result.resolution });
  }
  if (result.comparison.complianceStatus !== 'COMPLIANT') {
    const message = result.comparison.shortfall
      ? `The qualifying wage is below the approved minimum by INR ${result.comparison.shortfall}.`
      : 'The salary structure cannot yet be confirmed against the approved minimum wage.';
    throw new HttpError(422, message, { errors: { salary_structure: [message] }, minimum_wage: { resolution: result.resolution, comparison: result.comparison } });
  }
}

