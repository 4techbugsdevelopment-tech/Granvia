import crypto from 'crypto';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http';
import { challengeOtpHash, ipDigest, maskMobile, mobileDigest, safeHashEquals, verificationGrantHash } from './crypto';
import { assertRegistrationSmsReady } from './config';
import { PrismaRegistrationOtpRepository, RegistrationOtpRepository } from './registrationOtpRepository';
import { SendTemplateInput, smsService } from './smsService';
import { SmsDeliveryError } from './types';

const PURPOSE = 'registration';

type SmsSender = { sendTemplate(input: SendTemplateInput): Promise<unknown> };

export class RegistrationOtpService {
  constructor(
    private readonly repository: RegistrationOtpRepository,
    private readonly sender: SmsSender,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private ensureReady() {
    try {
      assertRegistrationSmsReady();
    } catch (error) {
      console.error('[sms configuration error]', error instanceof Error ? error.message : 'Invalid SMS configuration.');
      throw new HttpError(503, 'Mobile verification is temporarily unavailable.');
    }
  }

  async request(input: { mobile: string; sessionId?: string; ip: string }) {
    if (!env.sms.registrationOtpEnabled) throw new HttpError(409, 'Mobile verification is not enabled.');
    this.ensureReady();
    const now = this.now();
    const sessionId = input.sessionId ?? crypto.randomUUID();
    const challengeId = crypto.randomUUID();
    const otp = String(crypto.randomInt(100_000, 1_000_000));
    const challenge = await this.repository.createChallenge({
      id: challengeId,
      mobileDigest: mobileDigest(input.mobile),
      otpHash: challengeOtpHash(challengeId, otp),
      purpose: PURPOSE,
      sessionId,
      requestIpDigest: ipDigest(input.ip || 'unknown'),
      expiresAt: new Date(now.getTime() + env.sms.otpTtlSeconds * 1000),
      resendAvailableAt: new Date(now.getTime() + env.sms.resendCooldownSeconds * 1000),
    }, {
      now,
      maxSendsPerHour: env.sms.maxSendsPerHour,
      maxRequestsPerIpPerHour: env.sms.maxRequestsPerIpPerHour,
    });

    try {
      await this.sender.sendTemplate({
        to: `+91${input.mobile}`,
        templateKey: 'registration_otp',
        variables: { otp, ttl_minutes: Math.ceil(env.sms.otpTtlSeconds / 60) },
        correlationId: challenge.id,
        purpose: PURPOSE,
      });
    } catch (error) {
      await this.repository.invalidateChallenge(challenge.id, this.now());
      if (error instanceof SmsDeliveryError) throw new HttpError(502, error.message, { code: error.code });
      throw new HttpError(502, 'The verification message could not be sent. Please try again shortly.');
    }

    return {
      registration_session_id: sessionId,
      masked_mobile: maskMobile(input.mobile),
      expires_in: env.sms.otpTtlSeconds,
      resend_after: env.sms.resendCooldownSeconds,
      ...(env.sms.provider === 'mock' && env.sms.mockExposeOtp && process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {}),
    };
  }

  async verify(input: { mobile: string; sessionId: string; otp: string }) {
    if (!env.sms.registrationOtpEnabled) throw new HttpError(409, 'Mobile verification is not enabled.');
    this.ensureReady();
    const now = this.now();
    const digest = mobileDigest(input.mobile);
    const challenge = await this.repository.findActiveChallenge({ mobileDigest: digest, purpose: PURPOSE, sessionId: input.sessionId });
    if (!challenge || challenge.expiresAt <= now || challenge.attempts >= env.sms.maxAttempts) {
      throw new HttpError(422, 'The verification code is invalid or expired. Request a new code.');
    }

    const valid = safeHashEquals(challenge.otpHash, challengeOtpHash(challenge.id, input.otp));
    if (!valid) {
      const recorded = await this.repository.recordFailedAttempt(challenge.id, challenge.attempts, env.sms.maxAttempts, now);
      if (!recorded) throw new HttpError(409, 'Another verification attempt is already being processed. Please try again.');
      const attemptsRemaining = Math.max(0, env.sms.maxAttempts - challenge.attempts - 1);
      throw new HttpError(422, attemptsRemaining
        ? `The verification code is incorrect. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Request a new code.', { attempts_remaining: attemptsRemaining });
    }

    const grantToken = crypto.randomBytes(32).toString('base64url');
    const grantExpiresAt = new Date(now.getTime() + env.sms.grantTtlSeconds * 1000);
    const consumed = await this.repository.consumeChallengeAndCreateGrant(challenge.id, {
      id: crypto.randomUUID(),
      mobileDigest: digest,
      sessionId: input.sessionId,
      purpose: PURPOSE,
      tokenHash: verificationGrantHash(grantToken),
      expiresAt: grantExpiresAt,
    }, now);
    if (!consumed) throw new HttpError(409, 'This verification code has already been used.');

    return {
      message: 'Mobile number verified.',
      mobile_verification_grant: grantToken,
      grant_expires_in: env.sms.grantTtlSeconds,
    };
  }
}

export const registrationOtpService = new RegistrationOtpService(new PrismaRegistrationOtpRepository(), smsService);

export async function consumeRegistrationMobileGrant(client: any, input: {
  mobile: string;
  sessionId?: string;
  grantToken?: string;
}, repository: RegistrationOtpRepository = new PrismaRegistrationOtpRepository()) {
  if (!env.sms.registrationOtpEnabled) return;
  try {
    assertRegistrationSmsReady();
  } catch (error) {
    console.error('[sms configuration error]', error instanceof Error ? error.message : 'Invalid SMS configuration.');
    throw new HttpError(503, 'Mobile verification is temporarily unavailable.');
  }
  if (!input.sessionId || !input.grantToken) {
    throw new HttpError(422, 'Verify the mobile number before completing associate registration.', {
      errors: { mobile: ['Mobile verification is required.'] },
    });
  }
  const consumed = await repository.consumeGrantWithClient(client, {
    mobileDigest: mobileDigest(input.mobile),
    purpose: PURPOSE,
    sessionId: input.sessionId,
    tokenHash: verificationGrantHash(input.grantToken),
    now: new Date(),
  });
  if (!consumed) {
    throw new HttpError(422, 'Mobile verification has expired or was already used. Verify the number again.', {
      errors: { mobile: ['A fresh mobile verification is required.'] },
    });
  }
}
