import fs from 'fs';
import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { AGREEMENT_STATUSES } from '../services/associateAgreement/agreementConstants';
import { assertStoredHash } from '../services/associateAgreement/agreementService';
import { absolutePathFor } from '../utils/fileStorage';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { z } from 'zod';
import { AGREEMENT_EVENTS } from '../services/associateAgreement/agreementConstants';
import { recordAgreementEvent } from '../services/associateAgreement/agreementAuditService';

const supersedeSchema = z.object({ reason: z.string().trim().min(10).max(1000) });

export async function show(req: Request, res: Response) {
  const guard = await prisma.user.findFirst({ where: { id: req.params.guard, role: 'guard' } });
  if (!guard) throw new HttpError(404, 'Associate Partner not found.');
  const agreement = await prisma.associatePartnerAgreement.findFirst({
    where: { associatePartnerId: guard.id, currentKey: guard.id },
    include: { auditEvents: { orderBy: { createdAt: 'desc' } } },
  });
  return res.json(agreement ? snakeKeys(agreement) : null);
}

export async function download(req: Request, res: Response) {
  const agreement = await prisma.associatePartnerAgreement.findFirst({ where: { id: req.params.agreement, associatePartnerId: req.params.guard } });
  if (!agreement) throw new HttpError(404, 'Agreement not found.');
  const signed = [AGREEMENT_STATUSES.SIGNED, AGREEMENT_STATUSES.SANDBOX_SIGNED].includes(agreement.status as never);
  const path = signed ? agreement.signedDocumentPath : agreement.originalDocumentPath;
  const hash = signed ? agreement.signedDocumentHash : agreement.originalDocumentHash;
  await assertStoredHash(path, hash);
  const filename = `${agreement.agreementNumber}${signed ? '-signed' : ''}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  return fs.createReadStream(absolutePathFor(path!)).pipe(res);
}

/** Explicitly closes the current version. It never edits/deletes its PDFs. */
export async function supersede(req: Request, res: Response) {
  const { reason } = supersedeSchema.parse(req.body);
  const agreement = await prisma.associatePartnerAgreement.findFirst({ where: { id: req.params.agreement, associatePartnerId: req.params.guard, currentKey: req.params.guard } });
  if (!agreement) throw new HttpError(404, 'Current agreement not found.');
  if (['ESIGN_INITIATED', 'ESIGN_PENDING', 'ESIGN_SUCCESS', 'VERIFICATION_PENDING'].includes(agreement.status)) {
    throw new HttpError(409, 'A pending eSign transaction must finish or expire before this agreement can be superseded.');
  }
  const updated = await prisma.associatePartnerAgreement.update({ where: { id: agreement.id }, data: { status: AGREEMENT_STATUSES.SUPERSEDED, currentKey: null, lockedAt: agreement.lockedAt ?? new Date(), failureReason: reason } });
  await recordAgreementEvent({ agreementId: agreement.id, associatePartnerId: agreement.associatePartnerId, eventType: AGREEMENT_EVENTS.SUPERSEDED, request: req, metadata: { reason } });
  await prisma.notification.create({ data: { userId: agreement.associatePartnerId, title: 'New agreement required', message: 'Your previous Associate Partner Agreement was superseded. Generate and review the current version before eSign.', type: 'agreement' } });
  return res.json(snakeKeys(updated));
}
