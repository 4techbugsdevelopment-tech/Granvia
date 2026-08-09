import fs from 'fs';
import { Router, Request, Response } from 'express';
import { verifySignature, absolutePathFor } from '../utils/fileStorage';

const router = Router();

// Signed download endpoint for private files (guard-documents, invoices, etc.).
// Signed download route for private files.
router.get('/files/download', (req: Request, res: Response) => {
  const path = String(req.query.path ?? '');
  const expires = Number(req.query.expires ?? 0);
  const signature = String(req.query.signature ?? '');

  if (!path || !verifySignature(path, expires, signature)) {
    return res.status(403).json({ message: 'Invalid or expired link.' });
  }

  let abs: string;
  try {
    abs = absolutePathFor(path);
  } catch {
    return res.status(400).json({ message: 'Invalid path.' });
  }

  if (!fs.existsSync(abs)) {
    return res.status(404).json({ message: 'File not found.' });
  }

  return res.download(abs);
});

export default router;
