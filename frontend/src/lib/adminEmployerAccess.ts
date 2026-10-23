const STORAGE_KEY = 'granvia_admin_employer_id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Run before AuthProvider makes its first /auth/me request. No token in URLs. */
export function initializeAdminEmployerAccess() {
  if (!/^\/employer(?:\/|$)/.test(window.location.pathname)) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  const url = new URL(window.location.href);
  const id = url.searchParams.get('admin_employer');
  if (id !== null) {
    // Keep invalid requests in isolated access mode so they fail closed rather
    // than silently opening the real account's normal portal.
    sessionStorage.setItem(STORAGE_KEY, UUID.test(id) ? id : 'invalid');
    url.searchParams.delete('admin_employer');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

export function getAdminEmployerId(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function adminEmployerUrl(employerId: string) {
  return `/employer?admin_employer=${encodeURIComponent(employerId)}`;
}

export function exitAdminEmployerAccess() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.location.replace('/admin/employers');
}
