import crypto from 'crypto';
import { env } from '../../config/env';

function hmac(value: string) {
  if (env.sms.hashSecret.length < 32) throw new Error('SMS_OTP_HASH_SECRET must contain at least 32 characters.');
  return crypto.createHmac('sha256', env.sms.hashSecret).update(value).digest('hex');
}

export function mobileDigest(mobile: string) {
  return hmac(`mobile:${mobile}`);
}

export function ipDigest(ip: string) {
  return hmac(`ip:${ip}`);
}

export function challengeOtpHash(challengeId: string, otp: string) {
  return hmac(`otp:${challengeId}:${otp}`);
}

export function verificationGrantHash(token: string) {
  return hmac(`grant:${token}`);
}

export function safeHashEquals(left: string, right: string) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function maskMobile(mobile: string) {
  const digits = mobile.replace(/\D/g, '');
  return digits.length >= 4 ? `+91******${digits.slice(-4)}` : '**********';
}
