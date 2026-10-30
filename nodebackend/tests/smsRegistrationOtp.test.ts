import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { env } from '../src/config/env';
import { requestRegistrationOtpSchema } from '../src/controllers/registrationSmsController';
import {
  ChallengeCreation,
  GrantCreation,
  RegistrationOtpChallenge,
  RegistrationOtpRepository,
} from '../src/services/sms/registrationOtpRepository';
import { consumeRegistrationMobileGrant, RegistrationOtpService } from '../src/services/sms/registrationOtpService';
import { SendTemplateInput } from '../src/services/sms/smsService';
import { SmsService } from '../src/services/sms/smsService';
import { SmsMessageCreate, SmsMessageRepository } from '../src/services/sms/smsRepository';
import { SmsDeliveryError, SmsDeliveryStatus, SmsProvider, SmsProviderError, SmsProviderRequest } from '../src/services/sms/types';
import { HttpError } from '../src/utils/http';

type Grant = GrantCreation & { consumedAt: Date | null; invalidatedAt: Date | null; createdAt: Date };

class MemoryRepository implements RegistrationOtpRepository {
  challenges: RegistrationOtpChallenge[] = [];
  grants: Grant[] = [];
  private queue = Promise.resolve();

  private async exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }

  async createChallenge(input: ChallengeCreation, policy: { now: Date; maxSendsPerHour: number; maxRequestsPerIpPerHour: number }) {
    return this.exclusive(() => {
      const since = policy.now.getTime() - 60 * 60 * 1000;
      const mobileCount = this.challenges.filter(row => row.mobileDigest === input.mobileDigest && row.purpose === input.purpose && row.createdAt.getTime() >= since).length;
      const ipCount = this.challenges.filter(row => row.requestIpDigest === input.requestIpDigest && row.createdAt.getTime() >= since).length;
      if (mobileCount >= policy.maxSendsPerHour || ipCount >= policy.maxRequestsPerIpPerHour) throw new HttpError(429, 'Too many verification codes requested.');
      const latest = [...this.challenges].reverse().find(row => row.mobileDigest === input.mobileDigest && row.purpose === input.purpose && row.sessionId === input.sessionId && !row.consumedAt && !row.invalidatedAt);
      if (latest && latest.expiresAt > policy.now && latest.resendAvailableAt > policy.now) throw new HttpError(429, 'Please wait before requesting another code.');
      for (const row of this.challenges) {
        if (row.mobileDigest === input.mobileDigest && row.purpose === input.purpose && row.sessionId === input.sessionId && !row.consumedAt && !row.invalidatedAt) row.invalidatedAt = policy.now;
      }
      for (const row of this.grants) {
        if (row.mobileDigest === input.mobileDigest && row.purpose === input.purpose && row.sessionId === input.sessionId && !row.consumedAt && !row.invalidatedAt) row.invalidatedAt = policy.now;
      }
      const created: RegistrationOtpChallenge = { ...input, attempts: 0, consumedAt: null, invalidatedAt: null, createdAt: policy.now };
      this.challenges.push(created);
      return { ...created };
    });
  }

  async invalidateChallenge(id: string, now: Date) {
    await this.exclusive(() => {
      const row = this.challenges.find(item => item.id === id);
      if (row && !row.consumedAt) row.invalidatedAt = now;
    });
  }

  async findActiveChallenge(input: { mobileDigest: string; purpose: string; sessionId: string }) {
    const row = [...this.challenges].reverse().find(item => item.mobileDigest === input.mobileDigest && item.purpose === input.purpose && item.sessionId === input.sessionId && !item.consumedAt && !item.invalidatedAt);
    return row ? { ...row } : null;
  }

  async recordFailedAttempt(id: string, expectedAttempts: number, maxAttempts: number, now: Date) {
    return this.exclusive(() => {
      const row = this.challenges.find(item => item.id === id && item.attempts === expectedAttempts && !item.consumedAt && !item.invalidatedAt);
      if (!row) return false;
      row.attempts += 1;
      if (row.attempts >= maxAttempts) row.invalidatedAt = now;
      return true;
    });
  }

  async consumeChallengeAndCreateGrant(challengeId: string, grant: GrantCreation, now: Date) {
    return this.exclusive(() => {
      const challenge = this.challenges.find(row => row.id === challengeId && !row.consumedAt && !row.invalidatedAt && row.expiresAt > now);
      if (!challenge) return false;
      challenge.consumedAt = now;
      for (const row of this.grants) {
        if (row.mobileDigest === grant.mobileDigest && row.purpose === grant.purpose && row.sessionId === grant.sessionId && !row.consumedAt && !row.invalidatedAt) row.invalidatedAt = now;
      }
      this.grants.push({ ...grant, consumedAt: null, invalidatedAt: null, createdAt: now });
      return true;
    });
  }

  async consumeGrantWithClient(_client: any, input: { mobileDigest: string; purpose: string; sessionId: string; tokenHash: string; now: Date }) {
    return this.exclusive(() => {
      const grant = this.grants.find(row => row.mobileDigest === input.mobileDigest && row.purpose === input.purpose && row.sessionId === input.sessionId && row.tokenHash === input.tokenHash && !row.consumedAt && !row.invalidatedAt && row.expiresAt > input.now);
      if (!grant) return false;
      grant.consumedAt = input.now;
      return true;
    });
  }
}

class FakeSender {
  calls: SendTemplateInput[] = [];
  fail = false;
  async sendTemplate(input: SendTemplateInput) {
    this.calls.push(input);
    if (this.fail) throw new SmsDeliveryError('provider_test_failure');
    return { status: 'accepted' };
  }
  otp(index = this.calls.length - 1) { return String(this.calls[index].variables.otp); }
}

class MemoryMessageRepository implements SmsMessageRepository {
  rows = new Map<string, SmsMessageCreate & { providerMessageId?: string; attemptCount: number; errorCode?: string }>();
  async create(data: SmsMessageCreate) { this.rows.set(data.id, { ...data, attemptCount: 0 }); }
  async complete(id: string, data: { status: Exclude<SmsDeliveryStatus, 'pending'>; providerMessageId?: string; attemptCount: number; errorCode?: string }) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, ...data });
  }
  async findStatus(id: string) {
    const row = this.rows.get(id);
    return row ? { id, status: row.status, providerMessageId: row.providerMessageId, attemptCount: row.attemptCount } : null;
  }
}

class ControlledProvider implements SmsProvider {
  readonly name = 'controlled';
  request?: SmsProviderRequest;
  failure?: SmsProviderError;
  async send(request: SmsProviderRequest) {
    this.request = request;
    if (this.failure) throw this.failure;
    return { status: 'accepted' as const, providerMessageId: 'provider-message-1', attempts: 1 };
  }
}

before(() => {
  Object.assign(env.sms, {
    enabled: true,
    registrationOtpEnabled: true,
    provider: 'mock',
    mockExposeOtp: false,
    hashSecret: 'test-only-secret-that-is-longer-than-32-characters',
    otpTtlSeconds: 300,
    grantTtlSeconds: 600,
    resendCooldownSeconds: 60,
    maxAttempts: 5,
    maxSendsPerHour: 5,
    maxRequestsPerIpPerHour: 20,
  });
});

function setup() {
  const repository = new MemoryRepository();
  const sender = new FakeSender();
  let current = new Date();
  const service = new RegistrationOtpService(repository, sender, () => current);
  return { repository, sender, service, advance: (seconds: number) => { current = new Date(current.getTime() + seconds * 1000); } };
}

test('successful OTP request and verification returns a single-use registration grant', async () => {
  const { service, sender } = setup();
  const requested = await service.request({ mobile: '9876543210', ip: '127.0.0.1' });
  assert.match(requested.registration_session_id, /^[0-9a-f-]{36}$/);
  assert.equal(requested.masked_mobile, '+91******3210');
  const verified = await service.verify({ mobile: '9876543210', sessionId: requested.registration_session_id, otp: sender.otp() });
  assert.ok(verified.mobile_verification_grant.length >= 32);
});

test('central SMS service renders templates, masks logs, and exposes stored delivery status', async () => {
  const repository = new MemoryMessageRepository();
  const provider = new ControlledProvider();
  const service = new SmsService(provider, repository);
  const sent = await service.sendTemplate({
    to: '+919876543210',
    templateKey: 'registration_otp',
    variables: { otp: '123456', ttl_minutes: 5 },
    correlationId: 'challenge-1',
    purpose: 'registration',
  });
  assert.equal(provider.request?.message.includes('123456'), true);
  const logged = repository.rows.get(sent.id)!;
  assert.equal(logged.recipientMasked, '+91******3210');
  assert.equal(Object.values(logged).includes('+919876543210'), false);
  assert.deepEqual(await service.getDeliveryStatus({ messageId: sent.id }), {
    id: sent.id,
    status: 'accepted',
    providerMessageId: 'provider-message-1',
    attemptCount: 1,
  });
});

test('ambiguous provider failures are tracked as unknown without exposing provider details', async () => {
  const repository = new MemoryMessageRepository();
  const provider = new ControlledProvider();
  provider.failure = new SmsProviderError('sensitive upstream detail', 'transport_failure', false, 1, 'unknown');
  const service = new SmsService(provider, repository);
  await assert.rejects(
    () => service.sendTemplate({ to: '+919876543210', templateKey: 'registration_otp', variables: { otp: '123456', ttl_minutes: 5 } }),
    (error) => error instanceof SmsDeliveryError && !error.message.includes('sensitive'),
  );
  assert.equal([...repository.rows.values()][0].status, 'unknown');
});

test('invalid Indian mobile numbers are rejected before service execution', () => {
  assert.equal(requestRegistrationOtpSchema.safeParse({ mobile: '1234567890' }).success, false);
  assert.equal(requestRegistrationOtpSchema.safeParse({ mobile: '98765' }).success, false);
  assert.equal(requestRegistrationOtpSchema.safeParse({ mobile: '+91 98765 43210' }).success, true);
});

test('incorrect OTPs increment attempts and exhaust after five failures', async () => {
  const { service, sender } = setup();
  const requested = await service.request({ mobile: '9876543210', ip: '127.0.0.1' });
  const issued = sender.otp();
  const incorrect = `${issued[0] === '9' ? '8' : '9'}${issued.slice(1)}`;
  for (let attempt = 4; attempt >= 0; attempt -= 1) {
    await assert.rejects(
      () => service.verify({ mobile: '9876543210', sessionId: requested.registration_session_id, otp: incorrect }),
      (error) => error instanceof HttpError && error.status === 422 && Number(error.payload.attempts_remaining) === attempt,
    );
  }
});

test('expired OTP is rejected', async () => {
  const { service, sender, advance } = setup();
  const requested = await service.request({ mobile: '9876543210', ip: '127.0.0.1' });
  advance(301);
  await assert.rejects(
    () => service.verify({ mobile: '9876543210', sessionId: requested.registration_session_id, otp: sender.otp() }),
    (error) => error instanceof HttpError && error.status === 422,
  );
});

test('resend cooldown rejects early resend and later resend invalidates the previous OTP', async () => {
  const { service, sender, advance } = setup();
  const first = await service.request({ mobile: '9876543210', ip: '127.0.0.1' });
  const firstOtp = sender.otp();
  await assert.rejects(
    () => service.request({ mobile: '9876543210', sessionId: first.registration_session_id, ip: '127.0.0.1' }),
    (error) => error instanceof HttpError && error.status === 429,
  );
  advance(61);
  await service.request({ mobile: '9876543210', sessionId: first.registration_session_id, ip: '127.0.0.1' });
  await assert.rejects(
    () => service.verify({ mobile: '9876543210', sessionId: first.registration_session_id, otp: firstOtp }),
    (error) => error instanceof HttpError && error.status === 422,
  );
  await service.verify({ mobile: '9876543210', sessionId: first.registration_session_id, otp: sender.otp() });
});

test('per-mobile request limit rejects excess sends', async () => {
  const previous = env.sms.maxSendsPerHour;
  env.sms.maxSendsPerHour = 2;
  try {
    const { service, advance } = setup();
    const first = await service.request({ mobile: '9876543210', ip: '127.0.0.1' });
    advance(61);
    await service.request({ mobile: '9876543210', sessionId: first.registration_session_id, ip: '127.0.0.1' });
    advance(61);
    await assert.rejects(
      () => service.request({ mobile: '9876543210', sessionId: first.registration_session_id, ip: '127.0.0.1' }),
      (error) => error instanceof HttpError && error.status === 429,
    );
  } finally {
    env.sms.maxSendsPerHour = previous;
  }
});

test('OTP reuse and concurrent verification are prevented', async () => {
  const { service, sender } = setup();
  const requested = await service.request({ mobile: '9876543210', ip: '127.0.0.1' });
  const otp = sender.otp();
  const outcomes = await Promise.allSettled([
    service.verify({ mobile: '9876543210', sessionId: requested.registration_session_id, otp }),
    service.verify({ mobile: '9876543210', sessionId: requested.registration_session_id, otp }),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  await assert.rejects(() => service.verify({ mobile: '9876543210', sessionId: requested.registration_session_id, otp }));
});

test('concurrent OTP requests allow only one active request during cooldown', async () => {
  const { service } = setup();
  const sessionId = '4c8e5e09-4b0b-44f7-a17b-5516e80f6225';
  const results = await Promise.allSettled([
    service.request({ mobile: '9876543210', sessionId, ip: '127.0.0.1' }),
    service.request({ mobile: '9876543210', sessionId, ip: '127.0.0.1' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
});

test('provider failure invalidates the challenge and returns a safe 502 error', async () => {
  const { service, sender, repository } = setup();
  sender.fail = true;
  await assert.rejects(
    () => service.request({ mobile: '9876543210', ip: '127.0.0.1' }),
    (error) => error instanceof HttpError && error.status === 502 && !error.message.includes('provider_test_failure'),
  );
  assert.ok(repository.challenges[0].invalidatedAt);
});

test('registration grant blocks bypass, is mobile/session-bound, and is consumed once', async () => {
  const { service, sender, repository } = setup();
  const requested = await service.request({ mobile: '9876543210', ip: '127.0.0.1' });
  const verified = await service.verify({ mobile: '9876543210', sessionId: requested.registration_session_id, otp: sender.otp() });
  await assert.rejects(
    () => consumeRegistrationMobileGrant({}, { mobile: '9876543210' }, repository),
    (error) => error instanceof HttpError && error.status === 422,
  );
  await assert.rejects(
    () => consumeRegistrationMobileGrant({}, { mobile: '9876543211', sessionId: requested.registration_session_id, grantToken: verified.mobile_verification_grant }, repository),
    (error) => error instanceof HttpError && error.status === 422,
  );
  const concurrentRegistrations = await Promise.allSettled([
    consumeRegistrationMobileGrant({}, {
      mobile: '9876543210',
      sessionId: requested.registration_session_id,
      grantToken: verified.mobile_verification_grant,
    }, repository),
    consumeRegistrationMobileGrant({}, {
      mobile: '9876543210',
      sessionId: requested.registration_session_id,
      grantToken: verified.mobile_verification_grant,
    }, repository),
  ]);
  assert.equal(concurrentRegistrations.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(concurrentRegistrations.filter(result => result.status === 'rejected').length, 1);
  await assert.rejects(
    () => consumeRegistrationMobileGrant({}, { mobile: '9876543210', sessionId: requested.registration_session_id, grantToken: verified.mobile_verification_grant }, repository),
    (error) => error instanceof HttpError && error.status === 422,
  );
});

test('existing associate registration remains compatible while feature flag is disabled', async () => {
  const previous = env.sms.registrationOtpEnabled;
  env.sms.registrationOtpEnabled = false;
  try {
    const repository = new MemoryRepository();
    await consumeRegistrationMobileGrant({}, { mobile: '9876543210' }, repository);
    assert.equal(repository.grants.length, 0);
  } finally {
    env.sms.registrationOtpEnabled = previous;
  }
});
