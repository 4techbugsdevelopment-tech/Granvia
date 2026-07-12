import { prisma } from '../prisma';
import { parseJsonField } from './serialize';

// Laravel eagerly loads a `guardProfile` relation on several employer-facing
// lists (keyed `guard_profile` in JSON). Prisma can't model that as an optional
// relation off a required FK without risking "required relation missing" errors,
// so we enrich manually: one batched lookup by guard_user_id.

function guardProfileSubset(p: {
  id: string;
  userId: string;
  fullName: string | null;
  mobile: string | null;
  city: string | null;
  skills: string | null;
  languages: string | null;
  verificationStatus: string;
}) {
  return {
    id: p.id,
    user_id: p.userId,
    full_name: p.fullName,
    mobile: p.mobile,
    city: p.city,
    skills: parseJsonField(p.skills),
    languages: parseJsonField(p.languages),
    verification_status: p.verificationStatus,
  };
}

/** Attaches `guard_profile` to each snake_cased row using its `guard_user_id`. */
export async function attachGuardProfiles<T extends { guard_user_id?: string | null }>(
  rows: T[]
): Promise<(T & { guard_profile: ReturnType<typeof guardProfileSubset> | null })[]> {
  const ids = [...new Set(rows.map((r) => r.guard_user_id).filter(Boolean))] as string[];

  const profiles = ids.length
    ? await prisma.guardProfile.findMany({
        where: { userId: { in: ids } },
        select: {
          id: true,
          userId: true,
          fullName: true,
          mobile: true,
          city: true,
          skills: true,
          languages: true,
          verificationStatus: true,
        },
      })
    : [];

  const map = new Map(profiles.map((p) => [p.userId, guardProfileSubset(p)]));

  return rows.map((r) => ({
    ...r,
    guard_profile: r.guard_user_id ? map.get(r.guard_user_id) ?? null : null,
  }));
}
