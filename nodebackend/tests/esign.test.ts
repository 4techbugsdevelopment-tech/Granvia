import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';
import { AGREEMENT_STATUSES, ACTIVE_TRANSACTION_STATUSES, RETRYABLE_STATUSES } from '../src/services/associateAgreement/agreementConstants';
import { generateAgreementPdf, generateSandboxEvidencePdf } from '../src/services/associateAgreement/agreementPdfService';
import { SandboxEsignProvider } from '../src/services/esign/providers/SandboxEsignProvider';

test('agreement lifecycle keeps active and retryable states disjoint', () => {
  assert.equal(RETRYABLE_STATUSES.includes(AGREEMENT_STATUSES.READY_FOR_SIGNATURE), true);
  assert.equal(ACTIVE_TRANSACTION_STATUSES.includes(AGREEMENT_STATUSES.ESIGN_PENDING), true);
  assert.equal(RETRYABLE_STATUSES.some(status => ACTIVE_TRANSACTION_STATUSES.includes(status)), false);
  assert.notEqual(AGREEMENT_STATUSES.SANDBOX_SIGNED, AGREEMENT_STATUSES.SIGNED);
});

test('agreement generator creates a PDF whose SHA-256 can be recorded', async () => {
  const pdf = await generateAgreementPdf({
    agreementNumber: 'GRN-AP-2026-TEST', agreementVersion: 'AP-2026-V1', generatedAt: new Date('2026-08-17T00:00:00Z'),
    partnerName: 'Test Associate', partnerReference: 'partner-test', mobile: '9999999999', email: 'test@example.com',
    address: 'Test Address', city: 'Delhi', state: 'Delhi',
  });
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.match(crypto.createHash('sha256').update(pdf).digest('hex'), /^[a-f0-9]{64}$/);
});

test('sandbox provider cannot verify a legal signed document', async () => {
  const provider = new SandboxEsignProvider();
  const transaction = await provider.createSigningTransaction({
    agreementId: 'test', agreementNumber: 'test', document: Buffer.from('%PDF-test'), documentHash: 'hash',
    signerName: 'Test', signerReference: 'test', callbackUrl: 'https://example.test/callback', returnUrl: 'https://example.test/return', correlationToken: 'state',
  });
  assert.match(transaction.transactionId, /^sandbox_/);
  assert.equal(await provider.verifySignedDocument(Buffer.from('%PDF-test'), { transactionId: transaction.transactionId, status: 'verified' }), false);
  await assert.rejects(() => provider.verifyCallback(), /does not accept provider callbacks/);
});

test('sandbox evidence is unmistakably separate PDF evidence', async () => {
  const pdf = await generateSandboxEvidencePdf('GRN-AP-2026-TEST', 'a'.repeat(64));
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(pdf.length > 500);
});
