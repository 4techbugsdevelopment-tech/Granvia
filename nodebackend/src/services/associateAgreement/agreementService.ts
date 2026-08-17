import crypto from 'crypto';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../prisma';
import { absolutePathFor, storeFile } from '../../utils/fileStorage';
import { HttpError } from '../../utils/http';
import { AGREEMENT_EVENTS, AGREEMENT_STATUSES } from './agreementConstants';
import { recordAgreementEvent } from './agreementAuditService';
import { generateAgreementPdf } from './agreementPdfService';

export function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function getOnboardingEligibility(associatePartnerId: string) {
  const [user, profile, documents] = await Promise.all([
    prisma.user.findUnique({ where: { id: associatePartnerId } }),
    prisma.guardProfile.findUnique({ where: { userId: associatePartnerId } }),
    prisma.guardDocument.findMany({ where: { guardUserId: associatePartnerId }, orderBy: { createdAt: 'desc' } }),
  ]);
  if (!user || user.role !== 'guard' || !profile) throw new HttpError(404, 'Associate Partner profile not found.');

  const missingProfileFields: string[] = [];
  const requiredProfile: Array<[string, unknown]> = [
    ['full name', profile.fullName || user.fullName], ['mobile number', profile.mobile || user.mobile],
    ['address', profile.address], ['city', profile.city], ['state', profile.state], ['pincode', profile.pincode],
    ['bank account number', profile.bankAccountNumber], ['bank IFSC', profile.bankIfsc], ['account holder name', profile.accountHolderName],
  ];
  for (const [label, value] of requiredProfile) if (!String(value ?? '').trim()) missingProfileFields.push(label);

  const missingDocuments = env.esign.requiredDocumentTypes.filter((type) =>
    !documents.some((document) => document.documentType === type && document.status === 'verified'),
  );
  const kycComplete = profile.aadhaarStatus === 'verified';
  const eligible = missingProfileFields.length === 0 && missingDocuments.length === 0 && kycComplete;
  return {
    eligible,
    profileComplete: missingProfileFields.length === 0,
    documentsComplete: missingDocuments.length === 0,
    kycComplete,
    missingProfileFields,
    missingDocuments,
    user,
    profile,
  };
}

export async function currentAgreement(associatePartnerId: string) {
  return prisma.associatePartnerAgreement.findFirst({
    where: { associatePartnerId, currentKey: associatePartnerId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function assertStoredHash(path: string | null, expectedHash: string | null): Promise<Buffer> {
  if (!path || !expectedHash) throw new HttpError(409, 'Agreement document is unavailable.', { code: 'agreement_document_missing' });
  let document: Buffer;
  try {
    document = await fs.promises.readFile(absolutePathFor(path));
  } catch {
    throw new HttpError(409, 'Agreement document could not be read.', { code: 'agreement_document_missing' });
  }
  if (sha256(document) !== expectedHash) {
    throw new HttpError(409, 'Agreement integrity verification failed.', { code: 'agreement_hash_mismatch' });
  }
  return document;
}

function agreementNumber(): string {
  const year = new Date().getFullYear();
  return `GRN-AP-${year}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export async function generateAgreement(associatePartnerId: string, request?: { ip?: string; get(name: string): string | undefined }) {
  const existing = await currentAgreement(associatePartnerId);
  if (existing) return { agreement: existing, created: false };

  const eligibility = await getOnboardingEligibility(associatePartnerId);
  if (!eligibility.eligible) {
    throw new HttpError(409, 'Complete profile, KYC and required document verification before generating the agreement.', {
      code: 'onboarding_incomplete',
      eligibility: {
        profile_complete: eligibility.profileComplete,
        documents_complete: eligibility.documentsComplete,
        kyc_complete: eligibility.kycComplete,
        missing_profile_fields: eligibility.missingProfileFields,
        missing_documents: eligibility.missingDocuments,
      },
    });
  }

  const generatedAt = new Date();
  const number = agreementNumber();
  const document = await generateAgreementPdf({
    agreementNumber: number,
    agreementVersion: env.esign.agreementVersion,
    generatedAt,
    partnerName: eligibility.profile.fullName || eligibility.user.fullName,
    partnerReference: associatePartnerId,
    mobile: eligibility.profile.mobile || eligibility.user.mobile || '',
    email: eligibility.user.email,
    address: eligibility.profile.address || '',
    city: eligibility.profile.city || '',
    state: eligibility.profile.state || '',
  });
  const originalDocumentHash = sha256(document);
  const stored = storeFile('agreements', associatePartnerId, {
    originalname: `${number}.pdf`, mimetype: 'application/pdf', size: document.length, buffer: document,
  });

  let agreement;
  try {
    agreement = await prisma.associatePartnerAgreement.create({
      data: {
        associatePartnerId,
        currentKey: associatePartnerId,
        agreementNumber: number,
        agreementVersion: env.esign.agreementVersion,
        templateVersion: env.esign.templateVersion,
        status: AGREEMENT_STATUSES.READY_FOR_SIGNATURE,
        agreementGeneratedAt: generatedAt,
        originalDocumentPath: stored.path,
        originalDocumentHash,
        signerName: eligibility.profile.fullName || eligibility.user.fullName,
        signerReference: associatePartnerId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrent = await currentAgreement(associatePartnerId);
      if (concurrent) return { agreement: concurrent, created: false };
    }
    throw error;
  }

  await Promise.all([
    recordAgreementEvent({ agreementId: agreement.id, associatePartnerId, eventType: AGREEMENT_EVENTS.GENERATED, request, metadata: { document_hash: originalDocumentHash, version: agreement.agreementVersion } }),
    prisma.notification.create({ data: { userId: associatePartnerId, title: 'Agreement ready', message: 'Your Associate Partner Agreement is ready for review and digital signature.', type: 'agreement' } }),
  ]);
  return { agreement, created: true };
}

export function publicAgreement(agreement: Awaited<ReturnType<typeof currentAgreement>>, eligibility: Awaited<ReturnType<typeof getOnboardingEligibility>>) {
  if (!agreement) return { status: AGREEMENT_STATUSES.NOT_GENERATED, agreement: null, eligibility: safeEligibility(eligibility), sandbox_mode: env.esign.sandboxMode };
  return {
    status: agreement.status,
    agreement: {
      id: agreement.id,
      agreement_number: agreement.agreementNumber,
      agreement_version: agreement.agreementVersion,
      template_version: agreement.templateVersion,
      status: agreement.status,
      agreement_generated_at: agreement.agreementGeneratedAt,
      original_document_hash: agreement.originalDocumentHash,
      signed_document_hash: agreement.signedDocumentHash,
      consent_given: agreement.consentGiven,
      consent_given_at: agreement.consentGivenAt,
      esign_provider: agreement.esignProvider,
      esign_transaction_id: agreement.esignTransactionId,
      esign_initiated_at: agreement.esignInitiatedAt,
      esign_completed_at: agreement.esignCompletedAt,
      signature_verified_at: agreement.signatureVerifiedAt,
      production_verified: agreement.productionVerified,
      failure_code: agreement.failureCode,
      failure_reason: agreement.failureReason,
      locked_at: agreement.lockedAt,
    },
    eligibility: safeEligibility(eligibility),
    sandbox_mode: env.esign.sandboxMode,
  };
}

function safeEligibility(value: Awaited<ReturnType<typeof getOnboardingEligibility>>) {
  return {
    eligible: value.eligible,
    profile_complete: value.profileComplete,
    documents_complete: value.documentsComplete,
    kyc_complete: value.kycComplete,
    missing_profile_fields: value.missingProfileFields,
    missing_documents: value.missingDocuments,
  };
}
