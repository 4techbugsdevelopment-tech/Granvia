import crypto from 'crypto';
import { z } from 'zod';

const PASSWORD_SPECIAL = /[^A-Za-z0-9]/;
const HUMAN_NAME = /^[\p{L}][\p{L} .'-]*$/u;
const SAFE_TEXT = /^[^<>]*$/;

export function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function humanNameSchema(field = 'Name', min = 2) {
  return z.string()
    .transform(normalizeSpaces)
    .refine((value) => value.length >= min, `${field} must contain at least ${min} characters.`)
    .refine((value) => HUMAN_NAME.test(value), `${field} can contain only letters, spaces, apostrophes, hyphens and dots.`);
}

export const normalizedEmailSchema = z.string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.');

export const indianMobileSchema = z.string()
  .transform((value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  })
  .refine((value) => /^\d{10}$/.test(value), 'Enter a valid 10-digit mobile number.')
  .refine((value) => /^[6-9]/.test(value), 'Enter a valid Indian mobile number.');

export const strongPasswordSchema = z.string().superRefine((value, ctx) => {
  const checks: Array<[boolean, string]> = [
    [value.length >= 12, 'Password must be at least 12 characters.'],
    [/[A-Z]/.test(value), 'Password must include at least one uppercase letter.'],
    [/[a-z]/.test(value), 'Password must include at least one lowercase letter.'],
    [/\d/.test(value), 'Password must include at least one number.'],
    [PASSWORD_SPECIAL.test(value), 'Password must include at least one special character.'],
  ];
  for (const [ok, message] of checks) {
    if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
});

export function generateStrongPassword(length = 16): string {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*_-+='];
  const all = groups.join('');
  const chars = [
    ...groups.map((group) => group[crypto.randomInt(0, group.length)]),
    ...Array.from({ length: Math.max(0, length - groups.length) }, () => all[crypto.randomInt(0, all.length)]),
  ];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const optionalHttpUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string()
    .trim()
    .url('Enter a valid website URL.')
    .refine((value) => value.startsWith('http://') || value.startsWith('https://'), 'Website must start with http:// or https://.')
    .optional()
    .nullable(),
);

export function moneySchema(field = 'Amount', opts: { positive?: boolean; max?: number } = {}) {
  const positive = opts.positive ?? true;
  const max = opts.max ?? 10_000_000;
  return z.coerce.number()
    .finite(`${field} must be a valid number.`)
    .refine((value) => (positive ? value > 0 : value >= 0), positive ? `${field} must be greater than 0.` : `${field} cannot be negative.`)
    .refine((value) => value <= max, `${field} is above the allowed limit.`)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, `${field} can have at most 2 decimal places.`);
}

export function textSchema(field = 'Text', opts: { min?: number; max?: number } = {}) {
  const min = opts.min ?? 1;
  const max = opts.max ?? 2000;
  return z.string()
    .transform(normalizeSpaces)
    .refine((value) => value.length >= min, `${field} must contain at least ${min} characters.`)
    .refine((value) => value.length <= max, `${field} must not exceed ${max} characters.`)
    .refine((value) => SAFE_TEXT.test(value), `${field} cannot contain angle brackets.`);
}

export function guardDobSchema() {
  return z.coerce.date()
    .refine((value) => !Number.isNaN(value.getTime()), 'Enter a valid date of birth.')
    .refine((value) => value <= new Date(), 'Date of birth cannot be in the future.')
    .refine((value) => {
      const today = new Date();
      const cutoff = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
      return value <= cutoff;
    }, 'Associate must be at least 14 years old.');
}

export function validateUploadFile(
  file: { originalname?: string; mimetype: string; size: number } | undefined,
  options: { field?: string; allowedMime: string[]; allowedExtensions: string[]; maxBytes: number },
) {
  const field = options.field ?? 'file';
  if (!file) {
    return [`The ${field} field is required.`];
  }
  const name = file.originalname ?? '';
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const errors: string[] = [];
  if (!options.allowedMime.includes(file.mimetype)) {
    errors.push(`The ${field} must be a file of type: ${options.allowedExtensions.join(', ')}.`);
  }
  if (!ext || !options.allowedExtensions.includes(ext)) {
    errors.push(`The ${field} extension must be one of: ${options.allowedExtensions.join(', ')}.`);
  }
  if (file.size <= 0) {
    errors.push(`The ${field} must not be empty.`);
  }
  if (file.size > options.maxBytes) {
    errors.push(`The ${field} must not be greater than ${Math.floor(options.maxBytes / 1024)} kilobytes.`);
  }
  return errors;
}
