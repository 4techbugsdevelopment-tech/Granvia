import crypto from 'crypto';
import { env } from '../../config/env';
import { maskMobile, mobileDigest } from './crypto';
import { PowerTextSmsProvider } from './providers/powerTextProvider';
import { MockSmsProvider } from './providers/mockProvider';
import { PrismaSmsMessageRepository, SmsMessageRepository } from './smsRepository';
import { SmsTemplateManager } from './templateManager';
import { SmsDeliveryError, SmsProvider, SmsProviderError, SmsTemplateKey } from './types';

export type SendTemplateInput = {
  to: string;
  templateKey: SmsTemplateKey;
  variables: Record<string, string | number>;
  correlationId?: string;
  purpose?: string;
};

export class SmsService {
  constructor(
    private readonly provider: SmsProvider,
    private readonly repository: SmsMessageRepository,
    private readonly templates = new SmsTemplateManager(),
  ) {}

  async sendTemplate(input: SendTemplateInput) {
    if (!env.sms.enabled) throw new SmsDeliveryError('sms_disabled');
    const rendered = this.templates.render(input.templateKey, input.variables);
    const messageId = crypto.randomUUID();
    await this.repository.create({
      id: messageId,
      recipientMasked: maskMobile(input.to),
      recipientDigest: mobileDigest(input.to),
      templateKey: input.templateKey,
      provider: this.provider.name,
      status: 'pending',
      correlationId: input.correlationId,
      purpose: input.purpose,
    });

    try {
      const result = await this.provider.send({
        to: input.to,
        message: rendered.message,
        providerTemplateId: rendered.providerTemplateId,
        dltEntityId: env.sms.powerText.dltEntityId || undefined,
        correlationId: input.correlationId,
      });
      await this.repository.complete(messageId, {
        status: result.status,
        providerMessageId: result.providerMessageId,
        attemptCount: result.attempts,
      });
      return { id: messageId, ...result };
    } catch (error) {
      const providerError = error instanceof SmsProviderError
        ? error
        : new SmsProviderError('SMS provider failed.', 'provider_error');
      await this.repository.complete(messageId, {
        status: providerError.deliveryStatus,
        attemptCount: providerError.attempts,
        errorCode: providerError.code.slice(0, 80),
        errorMessage: providerError.message.slice(0, 500),
      });
      throw new SmsDeliveryError(providerError.code);
    }
  }

  async getDeliveryStatus(input: { messageId: string }) {
    return this.repository.findStatus(input.messageId);
  }
}

function configuredProvider(): SmsProvider {
  return env.sms.provider === 'powertext' ? new PowerTextSmsProvider() : new MockSmsProvider();
}

export const smsService = new SmsService(configuredProvider(), new PrismaSmsMessageRepository());
