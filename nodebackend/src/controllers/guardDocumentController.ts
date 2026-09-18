import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { storeFile, urlFor, IncomingFile } from '../utils/fileStorage';
import { validateUploadFile } from '../utils/validation';

// Port of the guard-facing methods of App\Http\Controllers\GuardDocumentController.

const DOCUMENT_TYPES = ['id_proof', 'police_verification', 'bank_proof', 'skill_training_certificate', 'other'] as const;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const storeSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
});

function withUrl(doc: Record<string, unknown>) {
  const out = snakeKeys(doc) as Record<string, unknown>;
  out.download_url = urlFor('guard-documents', doc.filePath as string);
  return out;
}

/** GET /guard/documents */
export async function index(req: Request, res: Response) {
  const docs = await prisma.guardDocument.findMany({
    where: { guardUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(docs.map((d) => withUrl(d as unknown as Record<string, unknown>)));
}

/** POST /guard/documents (multipart: document_type + file) */
export async function store(req: Request, res: Response) {
  const { document_type } = storeSchema.parse(req.body);
  const file = req.file as IncomingFile | undefined;

  const fileErrors = validateUploadFile(file, {
    allowedMime: ALLOWED_MIME,
    allowedExtensions: ALLOWED_EXTENSIONS,
    maxBytes: MAX_DOCUMENT_BYTES,
  });
  if (fileErrors.length || !file) throw new HttpError(422, fileErrors[0], { errors: { file: fileErrors } });

  const stored = storeFile('guard-documents', req.user!.id, file);

  const document = await prisma.guardDocument.create({
    data: {
      guardUserId: req.user!.id,
      documentType: document_type,
      filePath: stored.path,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      status: 'pending',
    },
  });

  // A fresh upload puts that verification back into review.
  if (document_type === 'police_verification') {
    await prisma.guardProfile.updateMany({
      where: { userId: req.user!.id },
      data: { policeVerificationStatus: 'pending' },
    });
  }

  return res.status(201).json(withUrl(document as unknown as Record<string, unknown>));
}

// --- admin ----------------------------------------------------------------

const adminStatusSchema = z.object({
  status: z.enum(['verified', 'rejected', 'pending']),
  admin_remarks: z.string().nullish(),
});

/** GET /admin/guards/:guard/documents */
export async function adminIndex(req: Request, res: Response) {
  const guard = await prisma.user.findUnique({ where: { id: req.params.guard } });
  if (!guard || guard.role !== 'guard') throw new HttpError(404, 'Not an associate account.');

  const docs = await prisma.guardDocument.findMany({
    where: { guardUserId: guard.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(docs.map((d) => withUrl(d as unknown as Record<string, unknown>)));
}

/** PATCH /admin/guard-documents/:document */
export async function adminUpdateStatus(req: Request, res: Response) {
  const document = await prisma.guardDocument.findUnique({ where: { id: req.params.document } });
  if (!document) throw new HttpError(404, 'Not found.');

  const data = adminStatusSchema.parse(req.body);
  const updated = await prisma.guardDocument.update({
    where: { id: document.id },
    data: {
      status: data.status,
      ...(data.admin_remarks !== undefined ? { adminRemarks: data.admin_remarks } : {}),
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
    },
  });

  if (document.documentType === 'police_verification') {
    const mapped = data.status === 'verified' ? 'verified' : data.status === 'rejected' ? 'rejected' : 'pending';
    await prisma.guardProfile.updateMany({
      where: { userId: document.guardUserId },
      data: { policeVerificationStatus: mapped },
    });
  }

  return res.json(withUrl(updated as unknown as Record<string, unknown>));
}
