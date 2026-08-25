import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { storeFile, urlFor, removePrivateFile, IncomingFile } from '../utils/fileStorage';

// Port of App\Http\Controllers\DocumentController (company documents).

const storeSchema = z.object({ document_type: z.string() });
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];

function withUrl(doc: Record<string, unknown>) {
  const out = snakeKeys(doc) as Record<string, unknown>;
  // Never return the signed URL stored at upload time: it expires after ten
  // minutes. Generate a fresh link every time documents are listed instead.
  out.download_url = urlFor('company-documents', doc.filePath as string);
  return out;
}

async function ownedCompanyOrFail(id: string, userId: string) {
  const company = await prisma.employerCompany.findUnique({ where: { id } });
  if (!company) throw new HttpError(404, 'Not found.');
  if (company.employerUserId !== userId) throw new HttpError(403, 'Forbidden.');
  return company;
}

/** GET /employer/companies/:company/documents */
export async function index(req: Request, res: Response) {
  await ownedCompanyOrFail(req.params.company, req.user!.id);
  const docs = await prisma.companyDocument.findMany({
    where: { companyId: req.params.company },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(docs.map((doc) => withUrl(doc as unknown as Record<string, unknown>)));
}

/** POST /employer/companies/:company/documents */
export async function store(req: Request, res: Response) {
  await ownedCompanyOrFail(req.params.company, req.user!.id);
  const { document_type } = storeSchema.parse(req.body);
  const file = req.file as IncomingFile | undefined;

  if (!file) {
    throw new HttpError(422, 'The file field is required.', {
      errors: { file: ['The file field is required.'] },
    });
  }
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    throw new HttpError(422, 'The file must be a file of type: jpg, jpeg, png, pdf.', {
      errors: { file: ['The file must be a file of type: jpg, jpeg, png, pdf.'] },
    });
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new HttpError(422, 'The file must not be greater than 10240 kilobytes.', {
      errors: { file: ['The file must not be greater than 10240 kilobytes.'] },
    });
  }

  const stored = storeFile('company-documents', req.user!.id, file);
  const document = await prisma.companyDocument.create({
    data: {
      companyId: req.params.company,
      employerUserId: req.user!.id,
      documentType: document_type,
      filePath: stored.path,
      fileUrl: stored.url,
      fileSize: file.size,
      fileType: file.mimetype,
      verificationStatus: 'pending',
    },
  });
  return res.status(201).json(withUrl(document as unknown as Record<string, unknown>));
}

export async function update(req: Request, res: Response) {
  await ownedCompanyOrFail(req.params.company, req.user!.id);
  const document = await prisma.companyDocument.findFirst({ where: { id: req.params.document, companyId: req.params.company } });
  if (!document) throw new HttpError(404, 'Document not found.');
  const { document_type } = storeSchema.parse(req.body);
  const updated = await prisma.companyDocument.update({ where: { id: document.id }, data: { documentType: document_type } });
  return res.json(withUrl(updated as unknown as Record<string, unknown>));
}

export async function destroy(req: Request, res: Response) {
  await ownedCompanyOrFail(req.params.company, req.user!.id);
  const document = await prisma.companyDocument.findFirst({ where: { id: req.params.document, companyId: req.params.company } });
  if (!document) throw new HttpError(404, 'Document not found.');
  await prisma.companyDocument.delete({ where: { id: document.id } });
  removePrivateFile(document.filePath);
  return res.json({ message: 'Document deleted successfully.' });
}
