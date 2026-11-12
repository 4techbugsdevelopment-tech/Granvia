import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { compareQualifyingWage, resolveMinimumWage } from '../src/services/minimumWageService';

const jurisdiction = { id: 'j1', jurisdictionType: 'union_territory', stateUtCode: 'DL', appropriateGovernment: 'STATE', jurisdictionName: 'Delhi', status: 'active' };
const notification = { id: 'n1', notificationNumber: 'DL/TEST/1', notificationTitle: 'Verified test notification', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, sourceUrl: 'https://example.gov.in/notice', lastVerifiedAt: new Date('2026-01-01'), nextReviewAt: new Date('2027-01-01'), verificationStatus: 'approved', workflowStage: 'published' };
const rate = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1', notificationId: 'n1', jurisdictionId: 'j1', stateUtCode: 'DL', districtCode: null, zoneCode: null,
  employmentCategoryCode: null, occupationCode: null, skillCategoryCode: null, effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
  wageUnit: 'MONTHLY', basicWage: new Prisma.Decimal(17000), variableDearnessAllowance: new Prisma.Decimal(1000),
  otherMandatoryWageComponents: new Prisma.Decimal(0), totalNotifiedMinimumWage: new Prisma.Decimal(18000), currency: 'INR',
  qualifyingComponentCodes: JSON.stringify(['BASIC_SALARY', 'DA']), applicabilityConditions: null, conversionBasis: null,
  approvalStatus: 'approved', notification, jurisdiction, ...overrides,
});
const db = (rates: any[], jurisdictions = [jurisdiction], mappings: any[] = []) => ({
  minimumWageJurisdiction: { findMany: async () => jurisdictions }, minimumWageRate: { findMany: async () => rates },
  jobRoleSkillMapping: { findMany: async () => mappings },
}) as any;
const input = { stateName: 'Delhi', effectiveDate: new Date('2026-11-10'), wageUnit: 'MONTHLY' as const, appropriateGovernment: 'STATE' as const };

test('resolves one approved effective rate without guessing a higher or lower rate', async () => {
  const result = await resolveMinimumWage(db([rate()]), input);
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.applicableRate?.amount, '18000.00');
  assert.equal(result.notification?.number, 'DL/TEST/1');
});

test('requires a classification when approved candidate rates depend on it', async () => {
  const result = await resolveMinimumWage(db([rate({ skillCategoryCode: 'SKILLED' })]), input);
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.match(result.reason, /skill category/i);
});

test('returns conflict instead of selecting among equal approved matches', async () => {
  const result = await resolveMinimumWage(db([rate(), rate({ id: 'r2', notificationId: 'n2', notification: { ...notification, id: 'n2', notificationNumber: 'DL/TEST/2' } })]), input);
  assert.equal(result.status, 'CONFLICT_DETECTED');
});

test('returns stale data after the notification review date', async () => {
  const result = await resolveMinimumWage(db([rate({ notification: { ...notification, nextReviewAt: new Date('2026-01-02') } })]), input);
  assert.equal(result.status, 'STALE_DATA');
});

test('compares only the qualifying earning components named by the approved rule', async () => {
  const result = await resolveMinimumWage(db([rate()]), input);
  const comparison = compareQualifyingWage(result, [
    { code: 'BASIC_SALARY', name: 'Basic', category: 'earning', monthlyAmount: '16000', enabled: true },
    { code: 'DA', name: 'DA', category: 'earning', monthlyAmount: '1000', enabled: true },
    { code: 'HRA', name: 'HRA', category: 'earning', monthlyAmount: '5000', enabled: true },
  ]);
  assert.equal(comparison.qualifyingWage, '17000.00');
  assert.equal(comparison.shortfall, '1000.00');
  assert.equal(comparison.complianceStatus, 'NON_COMPLIANT');
});

test('does not convert a monthly rate into a daily rate', async () => {
  const result = await resolveMinimumWage(db([]), { ...input, wageUnit: 'DAILY' });
  assert.equal(result.status, 'NOT_AVAILABLE');
});

