import crypto from 'crypto';
import { SmsProvider, SmsProviderRequest, SmsProviderResult } from '../types';

export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';
  readonly sent: SmsProviderRequest[] = [];

  async send(request: SmsProviderRequest): Promise<SmsProviderResult> {
    this.sent.push({ ...request });
    return {
      status: 'accepted',
      providerMessageId: `mock-${crypto.randomUUID()}`,
      attempts: 1,
    };
  }
}
