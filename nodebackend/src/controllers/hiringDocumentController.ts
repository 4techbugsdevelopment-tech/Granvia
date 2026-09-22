import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { HttpError } from '../utils/http';
import { latestOfferLetterForAssociate, offerLetterForAssociateApplication } from '../services/offerLetterService';
import { assertEmployerHiredAgreementAccess } from '../services/employmentAgreementService';

const DOCUMENTS_ROOT = path.resolve(__dirname, '../../../documents');
const DOCUMENTS = {
  'offer-letter': {
    role: 'guard',
    filename: 'Offer letter.pdf',
    contentType: 'application/pdf',
  },
  'employment-agreement': {
    role: 'employer',
    filename: 'Employment Agreement.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
} as const;

export async function download(req: Request, res: Response) {
  const document = DOCUMENTS[req.params.document as keyof typeof DOCUMENTS];
  if (!document) throw new HttpError(404, 'Document not found.');
  const allowed = req.user!.role === document.role || (document.role === 'employer' && req.user!.role === 'super_admin');
  if (!allowed) throw new HttpError(403, 'Forbidden.');

  const applicationId = typeof req.query.application_id === 'string' ? req.query.application_id.trim() : '';
  let absolutePath: string;
  if (req.params.document === 'offer-letter') {
    absolutePath = applicationId
      ? await offerLetterForAssociateApplication(req.user!.id, applicationId)
      : await latestOfferLetterForAssociate(req.user!.id);
  } else {
    if (!applicationId) throw new HttpError(422, 'application_id is required.');
    await assertEmployerHiredAgreementAccess(req.user!.id, req.user!.role, applicationId);
    absolutePath = path.join(DOCUMENTS_ROOT, document.filename);
  }
  if (!fs.existsSync(absolutePath)) throw new HttpError(404, 'Document file not found.');

  res.setHeader('Content-Type', document.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(absolutePath);
}
