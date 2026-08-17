export interface SigningTransactionInput {
  agreementId: string;
  agreementNumber: string;
  document: Buffer;
  documentHash: string;
  signerName: string;
  signerReference: string;
  callbackUrl: string;
  returnUrl: string;
  correlationToken: string;
}

export interface SigningTransaction {
  transactionId: string;
  requestId?: string;
  signingUrl?: string;
  expiresAt?: Date;
}

export interface VerifiedEsignResult {
  transactionId: string;
  requestId?: string;
  status: 'verified' | 'pending' | 'failed' | 'cancelled' | 'expired';
  signedDocument?: Buffer;
  providerResponseReference?: string;
  completedAt?: Date;
  certificate?: { serialNumber?: string; issuer?: string; subject?: string };
  failureCode?: string;
  failureReason?: string;
  /** Opaque state returned by the ESP, when the configured flow supports it. */
  correlationToken?: string;
}

export abstract class BaseEsignProvider {
  abstract readonly name: string;
  abstract createSigningTransaction(input: SigningTransactionInput): Promise<SigningTransaction>;
  abstract verifyCallback(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<VerifiedEsignResult>;
  abstract getTransactionStatus(transactionId: string): Promise<VerifiedEsignResult>;
  abstract downloadSignedDocument(transactionId: string): Promise<Buffer>;
  abstract verifySignedDocument(document: Buffer, expected: VerifiedEsignResult): Promise<boolean>;
}
