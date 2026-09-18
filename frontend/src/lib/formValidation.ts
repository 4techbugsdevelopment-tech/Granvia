export type ValidationMap = Record<string, string>;

const HUMAN_NAME = /^[\p{L}][\p{L} .'-]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GST = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

export function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeIndianMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

export function humanNameError(value: string, field = 'Name', required = true, min = 2) {
  const normalized = normalizeSpaces(value);
  if (!normalized) return required ? `${field} is required.` : '';
  if (normalized.length < min) return `${field} must contain at least ${min} characters.`;
  if (!HUMAN_NAME.test(normalized)) return `${field} can contain only letters, spaces, apostrophes, hyphens and dots.`;
  return '';
}

export function emailError(value: string, required = true) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return required ? 'Email address is required.' : '';
  return EMAIL.test(normalized) ? '' : 'Enter a valid email address.';
}

export function indianMobileError(value: string, required = true) {
  const normalized = normalizeIndianMobile(value);
  if (!normalized) return required ? 'Mobile number is required.' : '';
  if (!/^\d{10}$/.test(normalized)) return 'Enter a valid 10-digit mobile number.';
  if (!/^[6-9]/.test(normalized)) return 'Enter a valid Indian mobile number.';
  return '';
}

export function passwordErrors(value: string) {
  const errors: string[] = [];
  if (value.length < 12) errors.push('Password must be at least 12 characters.');
  if (!/[A-Z]/.test(value)) errors.push('Password must include at least one uppercase letter.');
  if (!/[a-z]/.test(value)) errors.push('Password must include at least one lowercase letter.');
  if (!/\d/.test(value)) errors.push('Password must include at least one number.');
  if (!/[^A-Za-z0-9]/.test(value)) errors.push('Password must include at least one special character.');
  return errors;
}

export function passwordError(value: string, required = true) {
  if (!value) return required ? 'Password is required.' : '';
  return passwordErrors(value)[0] ?? '';
}

export function dob14Error(value: string, required = true) {
  if (!value) return required ? 'Date of birth is required.' : '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 'Enter a valid date of birth.';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dob = new Date(year, month - 1, day);
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) return 'Enter a valid date of birth.';

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (dob > todayOnly) return 'Date of birth cannot be in the future.';

  const cutoff = new Date(todayOnly.getFullYear() - 14, todayOnly.getMonth(), todayOnly.getDate());
  if (dob > cutoff) return 'Associate must be at least 14 years old.';
  return '';
}

export function pincodeError(value: string, required = false) {
  const normalized = value.trim();
  if (!normalized) return required ? 'Pincode is required.' : '';
  return /^\d{6}$/.test(normalized) ? '' : 'Enter a valid 6-digit pincode.';
}

export function moneyError(value: string, field = 'Amount', required = false, max = 10_000_000) {
  const normalized = value.trim();
  if (!normalized) return required ? `${field} is required.` : '';
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return `${field} must be a valid number with at most 2 decimal places.`;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return `${field} must be a valid number.`;
  if (amount <= 0) return `${field} must be greater than 0.`;
  if (amount > max) return `${field} is above the allowed limit.`;
  return '';
}

export function httpUrlError(value: string, required = false) {
  const normalized = value.trim();
  if (!normalized) return required ? 'Website is required.' : '';
  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? '' : 'Website must start with http:// or https://.';
  } catch {
    return 'Enter a valid website URL.';
  }
}

export function gstError(value: string, required = false) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return required ? 'GST number is required.' : '';
  return GST.test(normalized) ? '' : 'Enter a valid 15-character GST number.';
}

export function panError(value: string, required = false) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return required ? 'PAN number is required.' : '';
  return PAN.test(normalized) ? '' : 'Enter a valid PAN number.';
}

export function addError(errors: ValidationMap, field: string, message: string) {
  if (message) errors[field] = message;
}
