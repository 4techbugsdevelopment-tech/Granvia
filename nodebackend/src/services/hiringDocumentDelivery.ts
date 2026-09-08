import { prisma } from '../prisma';

export const HIRING_DOCUMENT_TYPES = {
  offerLetter: 'hiring_offer_letter',
  employmentAgreement: 'hiring_employment_agreement',
  verificationRequired: 'hiring_verification_required',
  associateUnverified: 'hiring_associate_unverified',
  associateVerified: 'hiring_associate_verified',
} as const;

async function createNotificationOnce(notification: { userId: string; type: string; title: string; message: string }) {
  const exists = await prisma.notification.findFirst({
    where: { userId: notification.userId, type: notification.type },
    select: { id: true },
  });
  if (!exists) await prisma.notification.create({ data: notification });
}

async function employerNotificationRecipients(employerUserId: string): Promise<string[]> {
  const superAdmins = await prisma.user.findMany({
    where: { role: 'super_admin', accountStatus: 'active' },
    select: { id: true },
  });
  return [...new Set([employerUserId, ...superAdmins.map((admin) => admin.id)])];
}

/** Notify both sides when hiring is complete but profile verification is missing. */
export async function notifyUnverifiedHiredApplication(applicationId: string): Promise<void> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: { job: { select: { title: true } } },
  });
  if (!application || application.status !== 'hired') return;

  const profile = await prisma.guardProfile.findUnique({
    where: { userId: application.guardUserId },
    select: { fullName: true, verificationStatus: true },
  });
  if (profile?.verificationStatus === 'verified') return;

  const key = application.id;
  const associateName = profile?.fullName?.trim() || 'Associate Partner';
  await createNotificationOnce({
    userId: application.guardUserId,
    type: `${HIRING_DOCUMENT_TYPES.verificationRequired}:${key}`,
    title: 'Complete verification to continue',
    message: `You have been hired for ${application.job.title}, but your profile is not verified. Please complete your verification to continue.`,
  });
  if (application.employerUserId) {
    const recipients = await employerNotificationRecipients(application.employerUserId);
    for (const userId of recipients) await createNotificationOnce({
      userId,
      type: `${HIRING_DOCUMENT_TYPES.associateUnverified}:${key}`,
      title: 'Hired associate is not verified',
      message: `${associateName} has been hired for ${application.job.title}, but the associate is not verified yet.`,
    });
  }
}

/** Notify the employer once a hired associate completes profile verification. */
export async function notifyEmployerOfVerifiedAssociate(applicationId: string): Promise<void> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: { job: { select: { title: true } } },
  });
  if (!application || application.status !== 'hired' || !application.employerUserId) return;

  const profile = await prisma.guardProfile.findUnique({
    where: { userId: application.guardUserId },
    select: { fullName: true, verificationStatus: true },
  });
  if (profile?.verificationStatus !== 'verified') return;

  const recipients = await employerNotificationRecipients(application.employerUserId);
  for (const userId of recipients) await createNotificationOnce({
    userId,
    type: `${HIRING_DOCUMENT_TYPES.associateVerified}:${application.id}`,
    title: 'Hired associate verified',
    message: `${profile.fullName?.trim() || 'Associate Partner'} has completed verification for ${application.job.title}.`,
  });
}

/** Notify both sides once a hired associate's profile is fully verified. */
export async function deliverHiringDocumentsForApplication(applicationId: string): Promise<void> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: {
      job: { select: { title: true } },
    },
  });

  if (!application || application.status !== 'hired') return;
  const guardProfile = await prisma.guardProfile.findUnique({
    where: { userId: application.guardUserId },
    select: { fullName: true, verificationStatus: true },
  });
  if (guardProfile?.verificationStatus !== 'verified') return;

  const jobTitle = application.job.title;
  const associateName = guardProfile.fullName?.trim() || 'Associate Partner';
  await createNotificationOnce({
    userId: application.guardUserId,
    type: `${HIRING_DOCUMENT_TYPES.offerLetter}:${application.id}`,
    title: 'Your offer letter is ready',
    message: `You have been hired for ${jobTitle}. You have received your offer letter. Click here to download your offer letter.`,
  });
  if (application.employerUserId) {
    const recipients = await employerNotificationRecipients(application.employerUserId);
    for (const userId of recipients) await createNotificationOnce({
      userId,
      type: `${HIRING_DOCUMENT_TYPES.employmentAgreement}:${application.id}`,
      title: 'Employment agreement is ready',
      message: `The employment agreement for ${associateName} (${jobTitle}) is ready. Click here to download the employment agreement.`,
    });
  }
}

export async function deliverHiringDocumentsForVerifiedAssociate(guardUserId: string): Promise<void> {
  const applications = await prisma.jobApplication.findMany({
    where: { guardUserId, status: 'hired' },
    select: { id: true },
  });
  for (const application of applications) {
    await notifyEmployerOfVerifiedAssociate(application.id);
    await deliverHiringDocumentsForApplication(application.id);
  }
}
