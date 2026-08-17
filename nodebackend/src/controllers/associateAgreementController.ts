import crypto from 'crypto';
import fs from 'fs';
import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../prisma';
import { AGREEMENT_EVENTS, AGREEMENT_STATUSES, ACTIVE_TRANSACTION_STATUSES, RETRYABLE_STATUSES } from '../services/associateAgreement/agreementConstants';
import { recordAgreementEvent } from '../services/associateAgreement/agreementAuditService';
import { generateSandboxEvidencePdf } from '../services/associateAgreement/agreementPdfService';
import { assertStoredHash, currentAgreement, generateAgreement, getOnboardingEligibility, publicAgreement, sha256 } from '../services/associateAgreement/agreementService';
import { getEsignProvider } from '../services/esign/esignService';
import { absolutePathFor, storeFile } from '../utils/fileStorage';
import { HttpError } from '../utils/http';

const consentSchema = z.object({ consent: z.literal(true), agreement_id: z.string().uuid() });

export async function show(req: Request, res: Response) {
  const [agreement, eligibility] = await Promise.all([currentAgreement(req.user!.id), getOnboardingEligibility(req.user!.id)]);
  return res.json(publicAgreement(agreement, eligibility));
}

export async function generate(req: Request, res: Response) {
  const result = await generateAgreement(req.user!.id, req);
  const eligibility = await getOnboardingEligibility(req.user!.id);
  return res.status(result.created ? 201 : 200).json(publicAgreement(result.agreement, eligibility));
}

export async function consent(req: Request, res: Response) {
  const input = consentSchema.parse(req.body);
  const agreement = await currentAgreement(req.user!.id);
  if (!agreement || agreement.id !== input.agreement_id) throw new HttpError(404, 'Agreement not found.');
  if (agreement.lockedAt || ![AGREEMENT_STATUSES.READY_FOR_SIGNATURE, AGREEMENT_STATUSES.ESIGN_FAILED, AGREEMENT_STATUSES.ESIGN_CANCELLED, AGREEMENT_STATUSES.EXPIRED].includes(agreement.status as never)) {
    throw new HttpError(409, 'Consent cannot be changed at this agreement stage.');
  }
  await assertStoredHash(agreement.originalDocumentPath, agreement.originalDocumentHash);
  const updated = await prisma.associatePartnerAgreement.update({
    where: { id: agreement.id },
    data: { consentGiven: true, consentGivenAt: new Date(), consentIpAddress: req.ip, consentUserAgent: req.get('user-agent')?.slice(0, 1000) ?? null },
  });
  await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: req.user!.id, eventType: AGREEMENT_EVENTS.CONSENT_ACCEPTED, request: req, metadata: { version: agreement.agreementVersion } });
  const eligibility = await getOnboardingEligibility(req.user!.id);
  return res.json(publicAgreement(updated, eligibility));
}

export async function initiate(req: Request, res: Response) {
  const agreement = await currentAgreement(req.user!.id);
  if (!agreement) throw new HttpError(404, 'Generate the agreement before starting eSign.');
  if (agreement.lockedAt) throw new HttpError(409, 'This agreement is locked and cannot be signed again.');
  const eligibility = await getOnboardingEligibility(req.user!.id);
  if (!eligibility.eligible) throw new HttpError(409, 'Onboarding requirements are no longer complete.', { code: 'onboarding_incomplete' });
  if (!agreement.consentGiven) throw new HttpError(409, 'Review the agreement and provide consent before eSign.', { code: 'consent_required' });

  if (ACTIVE_TRANSACTION_STATUSES.includes(agreement.status) && agreement.esignTransactionId) {
    return res.json({ reused: true, transaction_id: agreement.esignTransactionId, status: agreement.status, sandbox_mode: env.esign.sandboxMode });
  }
  if (!RETRYABLE_STATUSES.includes(agreement.status)) throw new HttpError(409, 'Agreement is not available for eSign initiation.');
  const document = await assertStoredHash(agreement.originalDocumentPath, agreement.originalDocumentHash);
  const correlationToken = crypto.randomBytes(32).toString('hex');
  const correlationHash = sha256(Buffer.from(correlationToken));

  const claimed = await prisma.associatePartnerAgreement.updateMany({
    where: { id: agreement.id, status: { in: RETRYABLE_STATUSES }, lockedAt: null },
    data: { status: AGREEMENT_STATUSES.ESIGN_INITIATED, esignInitiatedAt: new Date(), correlationHash, failureCode: null, failureReason: null },
  });
  if (claimed.count !== 1) {
    const fresh = await currentAgreement(req.user!.id);
    return res.json({ reused: true, transaction_id: fresh?.esignTransactionId, status: fresh?.status, sandbox_mode: env.esign.sandboxMode });
  }

  const provider = getEsignProvider();
  try {
    const transaction = await provider.createSigningTransaction({
      agreementId: agreement.id,
      agreementNumber: agreement.agreementNumber,
      document,
      documentHash: agreement.originalDocumentHash!,
      signerName: agreement.signerName || eligibility.user.fullName,
      signerReference: req.user!.id,
      callbackUrl: env.esign.callbackUrl,
      returnUrl: env.esign.returnUrl,
      correlationToken,
    });
    const updated = await prisma.associatePartnerAgreement.update({
      where: { id: agreement.id },
      data: { status: AGREEMENT_STATUSES.ESIGN_PENDING, esignProvider: provider.name, esignTransactionId: transaction.transactionId, esignRequestId: transaction.requestId, transactionExpiresAt: transaction.expiresAt },
    });
    await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: req.user!.id, eventType: agreement.status === AGREEMENT_STATUSES.READY_FOR_SIGNATURE ? AGREEMENT_EVENTS.ESIGN_INITIATED : AGREEMENT_EVENTS.RETRIED, transactionId: transaction.transactionId, request: req });
    return res.json({ status: updated.status, transaction_id: transaction.transactionId, signing_url: transaction.signingUrl ?? null, sandbox_mode: env.esign.sandboxMode });
  } catch (error) {
    await prisma.associatePartnerAgreement.update({ where: { id: agreement.id }, data: { status: AGREEMENT_STATUSES.ESIGN_FAILED, failureCode: 'provider_initiation_failed', failureReason: error instanceof Error ? error.message.slice(0, 2000) : 'Provider initiation failed.' } });
    await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: req.user!.id, eventType: AGREEMENT_EVENTS.FAILED, request: req, metadata: { stage: 'initiation' } });
    throw error;
  }
}

export async function sandboxComplete(req: Request, res: Response) {
  if (!env.esign.sandboxMode) throw new HttpError(404, 'Not found.');
  const agreement = await currentAgreement(req.user!.id);
  if (!agreement || agreement.status !== AGREEMENT_STATUSES.ESIGN_PENDING || agreement.esignProvider !== 'granvia-sandbox-not-legal') {
    throw new HttpError(409, 'No sandbox eSign transaction is pending.');
  }
  const original = await assertStoredHash(agreement.originalDocumentPath, agreement.originalDocumentHash);
  void original;
  const evidence = await generateSandboxEvidencePdf(agreement.agreementNumber, agreement.originalDocumentHash!);
  const stored = storeFile('agreements', req.user!.id, { originalname: `${agreement.agreementNumber}-SANDBOX.pdf`, mimetype: 'application/pdf', size: evidence.length, buffer: evidence });
  const updated = await prisma.associatePartnerAgreement.update({
    where: { id: agreement.id },
    data: { status: AGREEMENT_STATUSES.SANDBOX_SIGNED, signedDocumentPath: stored.path, signedDocumentHash: sha256(evidence), esignCompletedAt: new Date(), callbackProcessedAt: new Date(), productionVerified: false, lockedAt: new Date() },
  });
  await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: req.user!.id, eventType: AGREEMENT_EVENTS.SIGNED, transactionId: agreement.esignTransactionId, request: req, metadata: { sandbox: true, legally_valid: false } });
  const eligibility = await getOnboardingEligibility(req.user!.id);
  return res.json(publicAgreement(updated, eligibility));
}

export async function callback(req: Request, res: Response) {
  const provider = getEsignProvider();
  const result = await provider.verifyCallback(req.body, req.headers);
  const agreement = await prisma.associatePartnerAgreement.findFirst({ where: { esignTransactionId: result.transactionId } });
  if (!agreement) throw new HttpError(404, 'Unknown eSign transaction.');
  if (agreement.esignProvider !== provider.name) throw new HttpError(400, 'eSign provider correlation failed.', { code: 'esign_provider_mismatch' });
  if (!result.correlationToken || !agreement.correlationHash || sha256(Buffer.from(result.correlationToken)) !== agreement.correlationHash) {
    throw new HttpError(400, 'eSign callback state verification failed.', { code: 'esign_state_mismatch' });
  }
  await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: agreement.associatePartnerId, eventType: AGREEMENT_EVENTS.CALLBACK_RECEIVED, transactionId: result.transactionId, request: req });
  if (agreement.status === AGREEMENT_STATUSES.SIGNED && agreement.callbackProcessedAt) return res.json({ received: true, duplicate: true });

  if (result.status !== 'verified') {
    const mapped = result.status === 'cancelled' ? AGREEMENT_STATUSES.ESIGN_CANCELLED : result.status === 'expired' ? AGREEMENT_STATUSES.EXPIRED : result.status === 'pending' ? AGREEMENT_STATUSES.VERIFICATION_PENDING : AGREEMENT_STATUSES.ESIGN_FAILED;
    await prisma.associatePartnerAgreement.update({ where: { id: agreement.id }, data: { status: mapped, callbackProcessedAt: new Date(), failureCode: result.failureCode, failureReason: result.failureReason } });
    return res.json({ received: true, verified: false });
  }

  const claimed = await prisma.associatePartnerAgreement.updateMany({
    where: { id: agreement.id, status: { in: [AGREEMENT_STATUSES.ESIGN_INITIATED, AGREEMENT_STATUSES.ESIGN_PENDING, AGREEMENT_STATUSES.VERIFICATION_PENDING] } },
    data: { status: AGREEMENT_STATUSES.ESIGN_SUCCESS },
  });
  if (claimed.count !== 1) {
    const current = await prisma.associatePartnerAgreement.findUnique({ where: { id: agreement.id } });
    if (current?.status === AGREEMENT_STATUSES.SIGNED) return res.json({ received: true, duplicate: true });
    return res.status(202).json({ received: true, processing: true });
  }

  try {
    const signedDocument = result.signedDocument ?? await provider.downloadSignedDocument(result.transactionId);
    if (signedDocument.length < 5 || signedDocument.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new HttpError(400, 'Provider did not return a valid PDF document.', { code: 'signed_document_invalid' });
    }
    if (!await provider.verifySignedDocument(signedDocument, result)) throw new HttpError(400, 'Signed document verification failed.', { code: 'signed_document_verification_failed' });
    const stored = storeFile('agreements', agreement.associatePartnerId, { originalname: `${agreement.agreementNumber}-signed.pdf`, mimetype: 'application/pdf', size: signedDocument.length, buffer: signedDocument });
    const now = new Date();
    await prisma.$transaction([
      prisma.associatePartnerAgreement.update({ where: { id: agreement.id }, data: {
        status: AGREEMENT_STATUSES.SIGNED, signedDocumentPath: stored.path, signedDocumentHash: sha256(signedDocument),
        esignCompletedAt: result.completedAt ?? now, signatureVerifiedAt: now, callbackProcessedAt: now, productionVerified: true, lockedAt: now,
        providerResponseReference: result.providerResponseReference, certificateSerialNumber: result.certificate?.serialNumber,
        certificateIssuer: result.certificate?.issuer, certificateSubject: result.certificate?.subject,
      } }),
      prisma.notification.create({ data: { userId: agreement.associatePartnerId, title: 'Agreement digitally signed', message: 'Your Associate Partner Agreement has been digitally signed and verified successfully.', type: 'agreement' } }),
    ]);
    await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: agreement.associatePartnerId, eventType: AGREEMENT_EVENTS.VERIFIED, transactionId: result.transactionId, request: req });
    await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: agreement.associatePartnerId, eventType: AGREEMENT_EVENTS.SIGNED, transactionId: result.transactionId, request: req });
    return res.json({ received: true, verified: true });
  } catch (error) {
    await prisma.associatePartnerAgreement.updateMany({
      where: { id: agreement.id, status: AGREEMENT_STATUSES.ESIGN_SUCCESS },
      data: { status: AGREEMENT_STATUSES.VERIFICATION_PENDING, failureCode: 'signed_document_verification_failed', failureReason: error instanceof Error ? error.message.slice(0, 2000) : 'Signed document verification failed.' },
    });
    await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: agreement.associatePartnerId, eventType: AGREEMENT_EVENTS.FAILED, transactionId: result.transactionId, request: req, metadata: { stage: 'signed_document_verification' } });
    throw error;
  }
}

export async function download(req: Request, res: Response) {
  const agreement = await currentAgreement(req.user!.id);
  if (!agreement) throw new HttpError(404, 'Agreement not found.');
  const signed = [AGREEMENT_STATUSES.SIGNED, AGREEMENT_STATUSES.SANDBOX_SIGNED].includes(agreement.status as never);
  const path = signed ? agreement.signedDocumentPath : agreement.originalDocumentPath;
  const hash = signed ? agreement.signedDocumentHash : agreement.originalDocumentHash;
  await assertStoredHash(path, hash);
  await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: req.user!.id, eventType: AGREEMENT_EVENTS.VIEWED, request: req, metadata: { signed } });
  const absolute = absolutePathFor(path!);
  const filename = `${agreement.agreementNumber}${signed ? '-signed' : ''}.pdf`;
  if (req.query.disposition === 'inline') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return fs.createReadStream(absolute).pipe(res);
  }
  return res.download(absolute, filename);
}
