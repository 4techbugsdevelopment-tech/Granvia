import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildOfferDecisionPlan, canRespondToOffer, HIRED_APPLICATION_STATUSES } from '../src/services/jobOfferWorkflow';

test('hired application statuses remain synchronized for downstream attendance and reports', () => {
  assert.deepEqual(HIRED_APPLICATION_STATUSES, ['selected', 'offer_sent', 'accepted', 'joined']);
  assert.equal(HIRED_APPLICATION_STATUSES.includes('accepted'), true);
  assert.equal(HIRED_APPLICATION_STATUSES.includes('joined'), true);
});

test('offer can only be accepted while the status is sent', () => {
  assert.equal(canRespondToOffer('sent'), true);
  assert.equal(canRespondToOffer('Sent'), true);
  assert.equal(canRespondToOffer('accepted'), false);
  assert.equal(canRespondToOffer('declined'), false);
});

test('accepting an offer produces a synchronized offer, application, agreement, and notification plan', () => {
  const plan = buildOfferDecisionPlan(
    {
      id: 'offer-1',
      jobId: 'job-1',
      guardUserId: 'guard-1',
      employerUserId: 'employer-1',
      companyId: 'company-1',
      siteId: 'site-1',
      offeredSalary: 25000,
      dutyHours: '8 hours',
      shiftType: 'Day',
      startDate: new Date('2026-08-31T00:00:00Z'),
      termsSummary: 'Day shift at the main site.',
      jobTitle: 'Security Associate',
    },
    'accepted'
  );

  assert.equal(plan.offerStatus, 'accepted');
  assert.equal(plan.applicationStatus, 'accepted');
  assert.equal(plan.agreement?.title, 'Job Agreement - Security Associate');
  assert.equal(plan.agreement?.status, 'pending');
  assert.equal(plan.agreement?.terms.salary, 25000);
  assert.equal(plan.agreement?.terms.start_date, '2026-08-31T00:00:00.000Z');
  assert.equal(plan.notification.title, 'Offer accepted');
  assert.match(plan.notification.message, /Security Associate/);
});

test('declining an offer does not create an agreement plan', () => {
  const plan = buildOfferDecisionPlan(
    {
      id: 'offer-2',
      jobId: 'job-2',
      guardUserId: 'guard-2',
      employerUserId: 'employer-2',
      companyId: 'company-2',
      siteId: 'site-2',
      offeredSalary: 18000,
      dutyHours: '12 hours',
      shiftType: 'Night',
      startDate: null,
      termsSummary: 'Night shift coverage.',
      jobTitle: 'Night Guard',
    },
    'declined'
  );

  assert.equal(plan.offerStatus, 'declined');
  assert.equal(plan.applicationStatus, null);
  assert.equal(plan.agreement, null);
  assert.equal(plan.notification.title, 'Offer declined');
  assert.match(plan.notification.message, /Night Guard/);
});
