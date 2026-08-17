import { HttpError } from '../../../utils/http';
import { BaseEsignProvider, SigningTransaction, SigningTransactionInput, VerifiedEsignResult } from './BaseEsignProvider';

/**
 * Production adapter boundary. Implement these methods only from the selected
 * ESP's official documentation; no endpoint, header or callback shape is
 * guessed here.
 */
export class ConfiguredEsignProvider extends BaseEsignProvider {
  readonly name: string;

  constructor(providerName: string) {
    super();
    this.name = providerName || 'unconfigured';
  }

  private unavailable(): never {
    throw new HttpError(503, 'Production eSign provider is not configured. Official ESP documentation and credentials are required.', {
      code: 'esign_provider_not_configured',
    });
  }

  createSigningTransaction(_input: SigningTransactionInput): Promise<SigningTransaction> { return this.unavailable(); }
  verifyCallback(_payload: unknown, _headers: Record<string, string | string[] | undefined>): Promise<VerifiedEsignResult> { return this.unavailable(); }
  getTransactionStatus(_transactionId: string): Promise<VerifiedEsignResult> { return this.unavailable(); }
  downloadSignedDocument(_transactionId: string): Promise<Buffer> { return this.unavailable(); }
  verifySignedDocument(_document: Buffer, _expected: VerifiedEsignResult): Promise<boolean> { return this.unavailable(); }
}
