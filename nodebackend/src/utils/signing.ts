import crypto from 'crypto';
import { env } from '../config/env';

// Generic HMAC signed-URL helper (Laravel signed-route equivalent) used for
// email-verification links. Distinct purpose string from file downloads.

function sign(value: string, expires: number): string {
  return crypto.createHmac('sha256', env.fileSigningSecret).update(`verify|${value}|${expires}`).digest('hex');
}

export function signedVerifyUrl(userId: string, hash: string): string {
  const value = `${userId}/${hash}`;
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour
  const signature = sign(value, expires);
  return `${env.appUrl}/api/email/verify/${userId}/${hash}?expires=${expires}&signature=${signature}`;
}

export function verifyEmailSignature(userId: string, hash: string, expires: number, signature: string): boolean {
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = sign(`${userId}/${hash}`, expires);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Laravel uses sha1(email) as the URL hash component. */
export function emailHash(email: string): string {
  return crypto.createHash('sha1').update(email).digest('hex');
}
