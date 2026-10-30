import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../utils/http';

export type RegistrationOtpChallenge = {
  id: string;
  mobileDigest: string;
  otpHash: string;
  purpose: string;
  sessionId: string;
  requestIpDigest: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  attempts: number;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
  createdAt: Date;
};

export type ChallengeCreation = Omit<RegistrationOtpChallenge, 'attempts' | 'consumedAt' | 'invalidatedAt' | 'createdAt'>;
export type GrantCreation = {
  id: string;
  mobileDigest: string;
  sessionId: string;
  purpose: string;
  tokenHash: string;
  expiresAt: Date;
};

export interface RegistrationOtpRepository {
  createChallenge(input: ChallengeCreation, policy: {
    now: Date;
    maxSendsPerHour: number;
    maxRequestsPerIpPerHour: number;
  }): Promise<RegistrationOtpChallenge>;
  invalidateChallenge(id: string, now: Date): Promise<void>;
  findActiveChallenge(input: { mobileDigest: string; purpose: string; sessionId: string }): Promise<RegistrationOtpChallenge | null>;
  recordFailedAttempt(id: string, expectedAttempts: number, maxAttempts: number, now: Date): Promise<boolean>;
  consumeChallengeAndCreateGrant(challengeId: string, grant: GrantCreation, now: Date): Promise<boolean>;
  consumeGrantWithClient(client: any, input: {
    mobileDigest: string;
    purpose: string;
    sessionId: string;
    tokenHash: string;
    now: Date;
  }): Promise<boolean>;
}

function concurrencyError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'P2002' || code === 'P2034') {
    return new HttpError(409, 'Another verification request is already being processed. Please try again.');
  }
  return null;
}

export class PrismaRegistrationOtpRepository implements RegistrationOtpRepository {
  async createChallenge(input: ChallengeCreation, policy: {
    now: Date;
    maxSendsPerHour: number;
    maxRequestsPerIpPerHour: number;
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const since = new Date(policy.now.getTime() - 60 * 60 * 1000);
        const [mobileRequests, ipRequests, latest] = await Promise.all([
          tx.smsOtpChallenge.count({ where: { mobileDigest: input.mobileDigest, purpose: input.purpose, createdAt: { gte: since } } }),
          tx.smsOtpChallenge.count({ where: { requestIpDigest: input.requestIpDigest, createdAt: { gte: since } } }),
          tx.smsOtpChallenge.findFirst({
            where: { mobileDigest: input.mobileDigest, purpose: input.purpose, sessionId: input.sessionId, consumedAt: null, invalidatedAt: null },
            orderBy: { createdAt: 'desc' },
          }),
        ]);
        if (mobileRequests >= policy.maxSendsPerHour || ipRequests >= policy.maxRequestsPerIpPerHour) {
          throw new HttpError(429, 'Too many verification codes requested. Please try again later.');
        }
        if (latest && latest.resendAvailableAt > policy.now && latest.expiresAt > policy.now) {
          const retryAfter = Math.max(1, Math.ceil((latest.resendAvailableAt.getTime() - policy.now.getTime()) / 1000));
          throw new HttpError(429, `Please wait ${retryAfter} seconds before requesting another code.`, { retry_after: retryAfter });
        }

        await tx.smsOtpChallenge.updateMany({
          where: { mobileDigest: input.mobileDigest, purpose: input.purpose, sessionId: input.sessionId, consumedAt: null, invalidatedAt: null },
          data: { invalidatedAt: policy.now },
        });
        await tx.smsVerificationGrant.updateMany({
          where: { mobileDigest: input.mobileDigest, purpose: input.purpose, sessionId: input.sessionId, consumedAt: null, invalidatedAt: null },
          data: { invalidatedAt: policy.now },
        });
        return tx.smsOtpChallenge.create({ data: input });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const mapped = concurrencyError(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async invalidateChallenge(id: string, now: Date) {
    await prisma.smsOtpChallenge.updateMany({ where: { id, consumedAt: null }, data: { invalidatedAt: now } });
  }

  async findActiveChallenge(input: { mobileDigest: string; purpose: string; sessionId: string }) {
    return prisma.smsOtpChallenge.findFirst({
      where: { ...input, consumedAt: null, invalidatedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordFailedAttempt(id: string, expectedAttempts: number, maxAttempts: number, now: Date) {
    const exhausted = expectedAttempts + 1 >= maxAttempts;
    const result = await prisma.smsOtpChallenge.updateMany({
      where: { id, attempts: expectedAttempts, consumedAt: null, invalidatedAt: null },
      data: { attempts: { increment: 1 }, ...(exhausted ? { invalidatedAt: now } : {}) },
    });
    return result.count === 1;
  }

  async consumeChallengeAndCreateGrant(challengeId: string, grant: GrantCreation, now: Date) {
    return prisma.$transaction(async (tx) => {
      const consumed = await tx.smsOtpChallenge.updateMany({
        where: { id: challengeId, consumedAt: null, invalidatedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;
      await tx.smsVerificationGrant.updateMany({
        where: { mobileDigest: grant.mobileDigest, purpose: grant.purpose, sessionId: grant.sessionId, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });
      await tx.smsVerificationGrant.create({ data: grant });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async consumeGrantWithClient(client: any, input: {
    mobileDigest: string;
    purpose: string;
    sessionId: string;
    tokenHash: string;
    now: Date;
  }) {
    const grant = await client.smsVerificationGrant.findFirst({
      where: {
        mobileDigest: input.mobileDigest,
        purpose: input.purpose,
        sessionId: input.sessionId,
        tokenHash: input.tokenHash,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: input.now },
      },
      select: { id: true },
    });
    if (!grant) return false;
    const result = await client.smsVerificationGrant.updateMany({
      where: { id: grant.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: input.now } },
      data: { consumedAt: input.now },
    });
    return result.count === 1;
  }
}
