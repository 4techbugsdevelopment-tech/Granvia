const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { resolveMinimumWage, compareQualifyingWage } = require('../dist/services/minimumWageService.js');

const jurisdiction = { id: 'j1', jurisdictionType: 'union_territory', stateUtCode: 'DL', appropriateGovernment: 'STATE', jurisdictionName: 'Delhi', status: 'active' };
const notification = { id: 'n1', notificationNumber: 'TEST/1', notificationTitle: 'Test', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, sourceUrl: 'https://example.gov.in', lastVerifiedAt: new Date(), nextReviewAt: new Date('2099-01-01'), verificationStatus: 'approved', workflowStage: 'published' };
const rate = { id: 'r1', notificationId: 'n1', jurisdictionId: 'j1', stateUtCode: 'DL', districtCode: null, zoneCode: null, employmentCategoryCode: null, occupationCode: null, skillCategoryCode: null, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, wageUnit: 'MONTHLY', basicWage: new Prisma.Decimal(17000), variableDearnessAllowance: new Prisma.Decimal(1000), otherMandatoryWageComponents: new Prisma.Decimal(0), totalNotifiedMinimumWage: new Prisma.Decimal(18000), currency: 'INR', qualifyingComponentCodes: '["BASIC_SALARY","DA"]', approvalStatus: 'approved', notification, jurisdiction };
const db = { minimumWageJurisdiction: { findMany: async () => [jurisdiction] }, minimumWageRate: { findMany: async () => [rate] }, jobRoleSkillMapping: { findMany: async () => [] } };

(async () => {
  const result = await resolveMinimumWage(db, { stateName: 'Delhi', effectiveDate: new Date('2026-11-10'), wageUnit: 'MONTHLY', appropriateGovernment: 'STATE' });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.applicableRate.amount, '18000.00');
  const compliant = compareQualifyingWage(result, [
    { code: 'BASIC_SALARY', category: 'earning', monthlyAmount: new Prisma.Decimal(17000), enabled: true },
    { code: 'DA', category: 'earning', monthlyAmount: new Prisma.Decimal(1000), enabled: true },
    { code: 'HRA', category: 'earning', monthlyAmount: new Prisma.Decimal(5000), enabled: true },
  ]);
  assert.equal(compliant.complianceStatus, 'COMPLIANT');
  const short = compareQualifyingWage(result, [{ code: 'BASIC_SALARY', category: 'earning', monthlyAmount: new Prisma.Decimal(15000), enabled: true }]);
  assert.equal(short.complianceStatus, 'NON_COMPLIANT');
  assert.equal(short.shortfall, '3000.00');
  process.stdout.write('minimum-wage compiled smoke: 5 assertions passed\n');
})().catch(error => { console.error(error); process.exitCode = 1; });

