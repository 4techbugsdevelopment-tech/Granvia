import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';

// Port of App\Services\FileStorageService. Files land under ./storage/app.
// Private categories are served through a signed /api/files/download link
// Signed download URLs for private files; public ones are served via /storage.

// Private files require a signed link; public ones are served statically at /storage.
export const PRIVATE_ROOT = path.resolve(process.cwd(), 'storage', 'app');
export const PUBLIC_ROOT = path.resolve(process.cwd(), 'storage', 'public');
const PRIVATE_CATEGORIES = ['company-documents', 'guard-documents', 'invoices', 'agreements'];

export interface IncomingFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function isPrivate(category: string): boolean {
  return PRIVATE_CATEGORIES.includes(category);
}

function sign(storedPath: string, expires: number): string {
  return crypto
    .createHmac('sha256', env.fileSigningSecret)
    .update(`${storedPath}|${expires}`)
    .digest('hex');
}

export function verifySignature(storedPath: string, expires: number, signature: string): boolean {
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = sign(storedPath, expires);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function urlFor(category: string, storedPath: string): string {
  if (isPrivate(category)) {
    const expires = Date.now() + 10 * 60 * 1000;
    const signature = sign(storedPath, expires);
    const query = `path=${encodeURIComponent(storedPath)}&expires=${expires}&signature=${signature}`;
    return `${env.appUrl}/api/files/download?${query}`;
  }
  return `${env.appUrl}/storage/${storedPath}`;
}

export function storeFile(category: string, ownerId: string, file: IncomingFile) {
  const ext = path.extname(file.originalname).replace('.', '') || 'bin';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const relPath = `${category}/${ownerId}/${filename}`;
  const root = isPrivate(category) ? PRIVATE_ROOT : PUBLIC_ROOT;
  const absPath = path.join(root, relPath);

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, file.buffer);

  return { path: relPath, url: urlFor(category, relPath) };
}

/** Resolves a PRIVATE stored path to an absolute path, guarding against traversal. */
export function absolutePathFor(storedPath: string): string {
  const abs = path.resolve(PRIVATE_ROOT, storedPath);
  const relative = path.relative(PRIVATE_ROOT, abs);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid path.');
  }
  return abs;
}

export function categoryOf(storedPath: string): string {
  return storedPath.split('/')[0] ?? '';
}
