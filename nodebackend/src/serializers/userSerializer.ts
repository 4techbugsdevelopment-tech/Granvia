import { snakeKeys, parseJsonField } from '../utils/serialize';

type AnyRecord = Record<string, unknown> | null;

/** Matches AuthController::meResponse()['user']. */
export function serializeUser(user: Record<string, unknown>) {
  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    profile_type: user.profileType,
    account_status: user.accountStatus,
    avatar_url: user.avatarUrl,
    email_verified: user.emailVerifiedAt != null,
    created_at: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  };
}

export function serializeEmployerProfile(profile: AnyRecord) {
  return profile ? (snakeKeys(profile) as Record<string, unknown>) : null;
}

export function serializeGuardProfile(profile: AnyRecord) {
  if (!profile) return null;
  const out = snakeKeys(profile) as Record<string, unknown>;
  // json columns stored as strings -> parse back to arrays for the frontend
  out.skills = parseJsonField(out.skills);
  out.languages = parseJsonField(out.languages);
  return out;
}

/**
 * Serializes a full User row to snake_case for output, stripping the hidden
 * `password` / `remember_token` fields (User model has #[Hidden]). Nested
 * relations (employer_profile, employer_wallet, guard_profile) pass through.
 */
export function serializeUserRow(user: Record<string, unknown>) {
  const clone = { ...user };
  delete clone.password;
  delete clone.rememberToken;
  const out = snakeKeys(clone) as Record<string, unknown>;
  // parse json columns on a nested guard_profile if present
  const gp = out.guard_profile as Record<string, unknown> | null | undefined;
  if (gp) {
    gp.skills = parseJsonField(gp.skills);
    gp.languages = parseJsonField(gp.languages);
  }
  return out;
}

/** Full AuthController::meResponse() payload. */
export function meResponse(
  user: Record<string, unknown>,
  employerProfile: AnyRecord,
  guardProfile: AnyRecord
) {
  return {
    user: serializeUser(user),
    employer_profile: serializeEmployerProfile(employerProfile),
    guard_profile: serializeGuardProfile(guardProfile),
  };
}
