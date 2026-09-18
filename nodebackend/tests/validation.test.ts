import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import {
  guardDobSchema,
  humanNameSchema,
  indianMobileSchema,
  moneySchema,
  normalizedEmailSchema,
  strongPasswordSchema,
  textSchema,
  validateUploadFile,
} from '../src/utils/validation';

function rejects(schema: z.ZodTypeAny, value: unknown, label: string) {
  assert.equal(schema.safeParse(value).success, false, label);
}

function accepts(schema: z.ZodTypeAny, value: unknown, label: string) {
  assert.equal(schema.safeParse(value).success, true, label);
}

test('strong password policy rejects direct API bypass values', () => {
  rejects(strongPasswordSchema, 'Abcdef1!234', '11 characters');
  rejects(strongPasswordSchema, 'abcdefabcdef1!', 'missing uppercase');
  rejects(strongPasswordSchema, 'ABCDEFABCDEF1!', 'missing lowercase');
  rejects(strongPasswordSchema, 'Abcdefghijkl!', 'missing number');
  rejects(strongPasswordSchema, 'Abcdefghijk1', 'missing special');
  accepts(strongPasswordSchema, 'ValidPass123!', 'valid 12+ password');
});

test('mobile and email validators normalize but reject malformed values', () => {
  rejects(indianMobileSchema, 'abcdefghij', 'letters');
  rejects(indianMobileSchema, '987654321', '9 digits');
  rejects(indianMobileSchema, '98765432101', '11 digits');
  accepts(indianMobileSchema, '+91 98765 43210', 'valid Indian number with prefix');

  const parsed = normalizedEmailSchema.parse(' USER@Example.COM ');
  assert.equal(parsed, 'user@example.com');
});

test('name, DOB, amount, and text validators enforce field-nature rules', () => {
  rejects(humanNameSchema('Full name'), '12345', 'numeric-only name');
  accepts(humanNameSchema('Full name'), "Anita D'Souza", 'human name');

  const today = new Date();
  const under14 = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
  rejects(guardDobSchema(), under14, 'under minimum age');
  rejects(guardDobSchema(), '2999-01-01', 'future DOB');

  const amount = moneySchema('Amount');
  rejects(amount, 0, 'zero amount');
  rejects(amount, -1, 'negative amount');
  rejects(amount, '12.345', 'too many decimals');
  accepts(amount, '12.34', 'valid amount');

  rejects(textSchema('Message', { min: 3, max: 10 }), '<script>', 'angle brackets');
  rejects(textSchema('Message', { min: 3, max: 10 }), 'ab', 'too short');
  accepts(textSchema('Message', { min: 3, max: 10 }), 'Valid note', 'valid text');
});

test('upload validator rejects missing, empty, mismatched, oversized, and accepts valid files', () => {
  const options = {
    allowedMime: ['image/jpeg', 'image/png', 'application/pdf'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
    maxBytes: 10 * 1024 * 1024,
  };

  assert.deepEqual(validateUploadFile(undefined, options), ['The file field is required.']);
  assert.ok(validateUploadFile({ originalname: 'x.pdf', mimetype: 'application/pdf', size: 0 }, options).some((msg) => msg.includes('empty')));
  assert.ok(validateUploadFile({ originalname: 'x.exe', mimetype: 'application/pdf', size: 100 }, options).some((msg) => msg.includes('extension')));
  assert.ok(validateUploadFile({ originalname: 'x.pdf', mimetype: 'application/octet-stream', size: 100 }, options).some((msg) => msg.includes('type')));
  assert.ok(validateUploadFile({ originalname: 'x.pdf', mimetype: 'application/pdf', size: 11 * 1024 * 1024 }, options).some((msg) => msg.includes('10240')));
  assert.deepEqual(validateUploadFile({ originalname: 'x.pdf', mimetype: 'application/pdf', size: 100 }, options), []);
});
