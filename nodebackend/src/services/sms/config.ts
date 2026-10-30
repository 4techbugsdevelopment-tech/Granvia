import { env } from '../../config/env';

export function assertRegistrationSmsReady() {
  if (!env.sms.registrationOtpEnabled) return;
  if (!env.sms.enabled) {
    throw new Error('SMS_REGISTRATION_OTP_ENABLED requires SMS_ENABLED=true.');
  }
  if (env.sms.hashSecret.length < 32) {
    throw new Error('SMS_OTP_HASH_SECRET must contain at least 32 characters.');
  }
  if (process.env.NODE_ENV === 'production' && env.sms.provider === 'mock') {
    throw new Error('SMS_PROVIDER=mock cannot be used for production registration OTP.');
  }
  if (!env.sms.registrationOtpTemplate.includes('{{otp}}')) {
    throw new Error('SMS_TEMPLATE_REGISTRATION_OTP must include {{otp}}.');
  }
  if (env.sms.provider === 'powertext') {
    const missing = Object.entries({
      POWERTEXT_BASE_URL: env.sms.powerText.baseUrl,
      POWERTEXT_SEND_PATH: env.sms.powerText.sendPath,
      POWERTEXT_AUTH_KEY: env.sms.powerText.authKey,
      POWERTEXT_SENDER_ID: env.sms.powerText.senderId,
      POWERTEXT_ROUTE_ID: env.sms.powerText.routeId,
      POWERTEXT_DLT_ENTITY_ID: env.sms.powerText.dltEntityId,
      POWERTEXT_OTP_TEMPLATE_ID: env.sms.powerText.otpTemplateId,
      SMS_TEMPLATE_REGISTRATION_OTP: process.env.SMS_TEMPLATE_REGISTRATION_OTP?.trim() ?? '',
    }).filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) throw new Error(`Missing PowerText SMS configuration: ${missing.join(', ')}`);
    if (!['GET', 'POST'].includes(env.sms.powerText.httpMethod)) {
      throw new Error('POWERTEXT_HTTP_METHOD must be GET or POST.');
    }
  } else if (env.sms.provider !== 'mock') {
    throw new Error(`Unsupported SMS_PROVIDER: ${env.sms.provider}`);
  }
}
