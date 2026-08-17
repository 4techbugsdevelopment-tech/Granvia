import crypto from 'crypto';
import { HttpError } from '../../../utils/http';
import { BaseEsignProvider, SigningTransaction, SigningTransactionInput, VerifiedEsignResult } from './BaseEsignProvider';

export class SandboxEsignProvider extends BaseEsignProvider {
  readonly name = 'granvia-sandbox-not-legal';

  async createSigningTransaction(_input: SigningTransactionInput): Promise<SigningTransaction> {
    return { transactionId: `sandbox_${crypto.randomUUID()}` };
  }

  async verifyCallback(): Promise<VerifiedEsignResult> {
    throw new HttpError(400, 'Sandbox mode does not accept provider callbacks.', { code: 'sandbox_callback_rejected' });
  }

  async getTransactionStatus(transactionId: string): Promise<VerifiedEsignResult> {
    return { transactionId, status: 'pending' };
  }

  async downloadSignedDocument(): Promise<Buffer> {
    throw new HttpError(400, 'Sandbox mode has no legally signed provider document.');
  }

  async verifySignedDocument(): Promise<boolean> { return false; }
}
