import { API_BASE_URL } from './apiClient';

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
