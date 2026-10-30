import { env } from '../../config/env';
import { SmsTemplateKey } from './types';

type TemplateDefinition = {
  content: string;
  providerTemplateId: string;
  enabled: boolean;
};

export class SmsTemplateManager {
  private definitions(): Partial<Record<SmsTemplateKey, TemplateDefinition>> {
    return {
      registration_otp: {
        content: env.sms.registrationOtpTemplate,
        providerTemplateId: env.sms.powerText.otpTemplateId,
        enabled: true,
      },
    };
  }

  render(templateKey: SmsTemplateKey, variables: Record<string, string | number>) {
    const definition = this.definitions()[templateKey];
    if (!definition?.enabled) throw new Error(`SMS template is not enabled: ${templateKey}`);

    const message = definition.content.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_match, key: string) => {
      const value = variables[key];
      if (value === undefined || value === null || String(value).length === 0) {
        throw new Error(`Missing SMS template variable: ${key}`);
      }
      return String(value);
    });
    if (/\{\{[^}]+\}\}/.test(message)) throw new Error('SMS template contains unresolved variables.');
    if (message.length > 1000) throw new Error('SMS message exceeds the configured safety limit.');

    return { message, providerTemplateId: definition.providerTemplateId };
  }
}
