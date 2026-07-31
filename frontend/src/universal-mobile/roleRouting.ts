import type { ProfileRow } from '../lib/apiTypes';

export type UniversalRole = 'guard' | 'employer' | 'sales_executive' | 'sub_admin' | 'super_admin';

export type UniversalPortalKey = 'associate' | 'employer' | 'sales' | 'subadmin';

export type UniversalRouteTarget =
  | { kind: 'root' }
  | { kind: 'login' }
  | { kind: 'unauthorized' }
  | { kind: 'portal'; role: Exclude<UniversalRole, 'super_admin'>; portal: UniversalPortalKey };

export const UNIVERSAL_APP_BASE_PATH = '/universal-app';
export const UNIVERSAL_APP_LOGIN_PATH = `${UNIVERSAL_APP_BASE_PATH}/login`;
export const UNIVERSAL_APP_UNAUTHORIZED_PATH = `${UNIVERSAL_APP_BASE_PATH}/unauthorized`;
export const UNIVERSAL_APP_LEGACY_PATH = '/app';

const UNIVERSAL_PORTALS: Record<Exclude<UniversalRole, 'super_admin'>, { portal: UniversalPortalKey; path: string; label: string }> = {
  guard: { portal: 'associate', path: `${UNIVERSAL_APP_BASE_PATH}/associate`, label: 'Associate Partner' },
  employer: { portal: 'employer', path: `${UNIVERSAL_APP_BASE_PATH}/employer`, label: 'Employer' },
  sales_executive: { portal: 'sales', path: `${UNIVERSAL_APP_BASE_PATH}/sales`, label: 'Sales Executive' },
  sub_admin: { portal: 'subadmin', path: `${UNIVERSAL_APP_BASE_PATH}/sub-admin`, label: 'Sub Admin' },
};

export function isSupportedUniversalRole(role: string | null | undefined): role is Exclude<UniversalRole, 'super_admin'> {
  return role === 'guard' || role === 'employer' || role === 'sales_executive' || role === 'sub_admin';
}

export function normalizeUniversalAppPath(pathname: string): string {
  if (pathname === UNIVERSAL_APP_LEGACY_PATH) return UNIVERSAL_APP_BASE_PATH;
  return pathname.replace(/\/+$/, '') || UNIVERSAL_APP_BASE_PATH;
}

export function resolveUniversalRoute(pathname: string): UniversalRouteTarget {
  const normalized = normalizeUniversalAppPath(pathname);

  if (normalized === UNIVERSAL_APP_BASE_PATH) return { kind: 'root' };
  if (normalized === UNIVERSAL_APP_LOGIN_PATH) return { kind: 'login' };
  if (normalized === UNIVERSAL_APP_UNAUTHORIZED_PATH) return { kind: 'unauthorized' };
  if (normalized === `${UNIVERSAL_APP_BASE_PATH}/associate`) return { kind: 'portal', role: 'guard', portal: 'associate' };
  if (normalized === `${UNIVERSAL_APP_BASE_PATH}/employer`) return { kind: 'portal', role: 'employer', portal: 'employer' };
  if (normalized === `${UNIVERSAL_APP_BASE_PATH}/sales`) return { kind: 'portal', role: 'sales_executive', portal: 'sales' };
  if (normalized === `${UNIVERSAL_APP_BASE_PATH}/sub-admin`) return { kind: 'portal', role: 'sub_admin', portal: 'subadmin' };
  return { kind: 'root' };
}

export function getUniversalPortalPath(role: Exclude<UniversalRole, 'super_admin'>): string {
  return UNIVERSAL_PORTALS[role].path;
}

export function getUniversalPathFromProfile(profile: ProfileRow | null | undefined): string {
  if (!profile) return UNIVERSAL_APP_LOGIN_PATH;
  if (profile.role === 'super_admin') return UNIVERSAL_APP_UNAUTHORIZED_PATH;
  if (!isSupportedUniversalRole(profile.role)) return UNIVERSAL_APP_UNAUTHORIZED_PATH;
  return getUniversalPortalPath(profile.role);
}

export function getUnsupportedRoleMessage(role: string | null | undefined): string {
  if (role === 'super_admin') {
    return 'Super Admin access is available only through the secure web administration portal.';
  }
  return 'Your account role is not supported in the universal mobile app.';
}
