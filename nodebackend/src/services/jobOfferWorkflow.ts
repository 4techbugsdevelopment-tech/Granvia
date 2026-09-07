export const HIRED_APPLICATION_STATUSES = ['selected', 'offer_sent', 'accepted', 'joined'] as const;

export type OfferDecision = 'accepted' | 'declined';

export interface JobOfferSnapshot {
  id: string;
  jobId: string | null;
  guardUserId: string;
  employerUserId: string | null;
  companyId: string | null;
  siteId: string | null;
  offeredSalary: unknown;
  dutyHours: string | null;
  shiftType: string | null;
  startDate: Date | null;
  termsSummary: string | null;
  jobTitle?: string | null;
}

export interface OfferAcceptancePlan {
  offerStatus: OfferDecision;
  applicationStatus: 'accepted' | null;
  agreement: {
    title: string;
    status: 'pending';
    employerConfirmationStatus: 'pending';
    guardConfirmationStatus: 'pending';
    platformConfirmationStatus: 'pending';
    terms: {
      salary: unknown;
      duty_hours: string | null;
      shift_type: string | null;
      start_date: string | null;
      summary: string | null;
    };
  } | null;
  notification: {
    title: string;
    message: string;
    type: 'job_offer';
  };
}

export function canRespondToOffer(currentStatus: string): boolean {
  return currentStatus.toLowerCase() === 'sent';
}

export function buildOfferDecisionPlan(offer: JobOfferSnapshot, decision: OfferDecision): OfferAcceptancePlan {
  const jobTitle = offer.jobTitle?.trim() || 'the job';
  const accepted = decision === 'accepted';

  return {
    offerStatus: decision,
    applicationStatus: accepted ? 'accepted' : null,
    agreement: accepted
      ? {
          title: offer.jobTitle ? `Job Agreement - ${offer.jobTitle}` : 'Job Agreement',
          status: 'pending',
          employerConfirmationStatus: 'pending',
          guardConfirmationStatus: 'pending',
          platformConfirmationStatus: 'pending',
          terms: {
            salary: offer.offeredSalary,
            duty_hours: offer.dutyHours,
            shift_type: offer.shiftType,
            start_date: offer.startDate ? offer.startDate.toISOString() : null,
            summary: offer.termsSummary,
          },
        }
      : null,
    notification: {
      title: accepted ? 'Offer accepted' : 'Offer declined',
      message: accepted
        ? `The Associate has accepted the offer for ${jobTitle}.`
        : `The Associate has declined the offer for ${jobTitle}.`,
      type: 'job_offer',
    },
  };
}
