import { API_BASE_URL } from './apiClient';

const EMPLOYER_LOGO_PUBLIC_BASE = 'https://aip.granvia.llc/storage/public/employer-logos/';
const COMPANY_LOGO_PUBLIC_BASE = 'https://aip.granvia.llc/storage/public/company-logos/';

function apiOrigin(): string {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    return new URL(API_BASE_URL).origin;
  }
  return window.location.origin;
}

function isLocalApiHost(url: URL): boolean {
  return ['127.0.0.1', 'localhost', '0.0.0.0', '10.0.2.2'].includes(url.hostname);
}

export function previewUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, apiOrigin());
    if (parsed.pathname.startsWith('/api/files/download') && isLocalApiHost(parsed)) {
      return `${apiOrigin()}${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function employerLogoUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  try {
    const parsed = new URL(url, apiOrigin());
    if (parsed.pathname.includes('/company-logos/')) return companyLogoUrl(url);
    const marker = '/employer-logos/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return previewUrl(url);

    const storedPath = parsed.pathname.slice(markerIndex + marker.length).replace(/^\/+/, '');
    return storedPath
      ? `${EMPLOYER_LOGO_PUBLIC_BASE}${storedPath}${parsed.search}${parsed.hash}`
      : EMPLOYER_LOGO_PUBLIC_BASE;
  } catch {
    return url;
  }
}

/**
 * Company logos are physically published by the production host beneath
 * /storage/public/company-logos. Persisted rows may contain the backend's
 * legacy /storage/company-logos URL, so resolve by category suffix instead of
 * requiring a database rewrite.
 */
export function companyLogoUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  try {
    const parsed = new URL(url, apiOrigin());
    const marker = '/company-logos/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return previewUrl(url);

    const storedPath = parsed.pathname.slice(markerIndex + marker.length).replace(/^\/+/, '');
    return storedPath
      ? `${COMPANY_LOGO_PUBLIC_BASE}${storedPath}${parsed.search}${parsed.hash}`
      : COMPANY_LOGO_PUBLIC_BASE;
  } catch {
    return url;
  }
}
