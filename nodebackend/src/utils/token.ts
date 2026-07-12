import crypto from 'crypto';
import { prisma } from '../prisma';
import { env } from '../config/env';

// Replicates Laravel Sanctum's personal-access-token scheme so the existing
// frontend (which stores an opaque Bearer string) works unchanged:
//   plainTextToken returned to client = `${tokenId}|${random40}`
//   value stored in DB                = sha256(random40)  (64 hex chars)

const TOKENABLE_TYPE = 'App\\Models\\User';
const TOKEN_NAME = 'api';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function issueToken(userId: string): Promise<string> {
  const plain = crypto.randomBytes(20).toString('hex'); // 40 hex chars, like Str::random(40)
  const expiresAt =
    env.tokenExpiryDays > 0
      ? new Date(Date.now() + env.tokenExpiryDays * 24 * 60 * 60 * 1000)
      : null;

  const record = await prisma.personalAccessToken.create({
    data: {
      tokenableType: TOKENABLE_TYPE,
      tokenableId: userId,
      name: TOKEN_NAME,
      token: sha256(plain),
      abilities: '["*"]',
      expiresAt,
    },
  });

  return `${record.id.toString()}|${plain}`;
}

/** Resolves a Bearer token string to the owning user id, or null if invalid/expired. */
export async function resolveTokenUserId(bearer: string): Promise<string | null> {
  const raw = bearer.includes('|') ? bearer.slice(bearer.indexOf('|') + 1) : bearer;
  const record = await prisma.personalAccessToken.findUnique({
    where: { token: sha256(raw) },
  });

  if (!record) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;
  if (record.tokenableType !== TOKENABLE_TYPE) return null;

  // Best-effort last-used bookkeeping (matches Sanctum).
  prisma.personalAccessToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return record.tokenableId;
}

/** Deletes the current access token (logout). */
export async function revokeToken(bearer: string): Promise<void> {
  const raw = bearer.includes('|') ? bearer.slice(bearer.indexOf('|') + 1) : bearer;
  await prisma.personalAccessToken
    .deleteMany({ where: { token: sha256(raw) } })
    .catch(() => undefined);
}
