import { prisma } from '../prisma';
import { parseJsonField } from './serialize';

// Several employer-facing lists include guard profile data keyed `guard_profile`
// in JSON. Prisma can't model that as an optional relation off a required FK
// without risking "required relation missing" errors, so we enrich manually:
// one batched lookup by guard_user_id.

function guardProfileSubset(p: {
  id: string;
  userId: string;
  fullName: string | null;
  mobile: string | null;
  gender: string | null;
  dob: Date | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  skills: string | null;
  languages: string | null;
  experience: string | null;
  qualification: string | null;
  policeVerificationStatus: string;
  verificationStatus: string;
  aadhaarStatus: string;
}) {
  return {
    id: p.id,
    user_id: p.userId,
    full_name: p.fullName,
    mobile: p.mobile,
    gender: p.gender,
    dob: p.dob,
    address: p.address,
    city: p.city,
    state: p.state,
    pincode: p.pincode,
    skills: parseJsonField(p.skills),
    languages: parseJsonField(p.languages),
    experience: p.experience,
    qualification: p.qualification,
    police_verification_status: p.policeVerificationStatus,
    verification_status: p.verificationStatus,
    aadhaar_status: p.aadhaarStatus,
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
          gender: true,
          dob: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          skills: true,
          languages: true,
          experience: true,
          qualification: true,
          policeVerificationStatus: true,
          verificationStatus: true,
          aadhaarStatus: true,
        },
      })
    : [];

  const map = new Map(profiles.map((p) => [p.userId, guardProfileSubset(p)]));

  return rows.map((r) => ({
    ...r,
    guard_profile: r.guard_user_id ? map.get(r.guard_user_id) ?? null : null,
  }));
}
