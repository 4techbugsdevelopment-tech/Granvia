import axios from 'axios';
import { notifyAuthChange } from './authBus';

function normalizeApiBaseUrl(value: string | undefined): string {
  const rawValue = value?.trim() || '/api';
  const withoutTrailingSlash = rawValue.replace(/\/+$/, '') || '/';

  if (!/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  try {
    const url = new URL(withoutTrailingSlash);
    if (!url.pathname.replace(/\/+$/, '').endsWith('/api')) {
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/api`;
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return withoutTrailingSlash;
  }
}

// VITE_API_BASE_URL is the backend origin/root. Backend routes are mounted
// under /api, so full origins such as https://aip.granvia.llc normalize there.
// VITE_API_URL is kept as a fallback for existing local private env files.
export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
);

export const TOKEN_STORAGE_KEY = 'granvia_api_token';
const MOBILE_API_DEBUG_STORAGE_KEY = 'granvia_mobile_api_debug';
const MAX_MOBILE_API_ALERTS_PER_PAGE = 3;
let mobileApiAlertCount = 0;

type DebuggableWindow = Window & {
  __GRANVIA_APK__?: boolean;
};

function isSensitiveKey(key: string): boolean {
  return /password|token|authorization|secret|otp|api[_-]?key/i.test(key);
}

function safeDebugValue(value: unknown, key = '', seen = new WeakSet<object>()): unknown {
  if (isSensitiveKey(key)) return '[redacted]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (key.toLowerCase().includes('email')) return value;
    if (value.length > 400) return `${value.slice(0, 400)}... [truncated]`;
    return value;
  }
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return Array.from(value.entries()).reduce<Record<string, unknown>>((entries, [formKey, formValue]) => {
      entries[formKey] = safeDebugValue(formValue, formKey, seen);
      return entries;
    }, {});
  }
  if (typeof File !== 'undefined' && value instanceof File) {
    return `[file: ${value.name}, ${value.type || 'unknown'}, ${value.size} bytes]`;
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return `[blob: ${value.type || 'unknown'}, ${value.size} bytes]`;
  }
  if (Array.isArray(value)) return value.map(item => safeDebugValue(item, key, seen));
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        safeDebugValue(entryValue, entryKey, seen),
      ]),
    );
  }
  return String(value);
}

function parseRequestData(data: unknown): unknown {
  if (typeof data !== 'string') return safeDebugValue(data);
  try {
    return safeDebugValue(JSON.parse(data));
  } catch {
    return safeDebugValue(data);
  }
}

function resolveRequestUrl(baseURL: string | undefined, url: string | undefined): string {
  if (!url) return baseURL || '(missing url)';
  if (/^https?:\/\//i.test(url)) return url;
  if (!baseURL || !/^https?:\/\//i.test(baseURL)) return `${baseURL || ''}${url.startsWith('/') ? url : `/${url}`}`;

  try {
    return new URL(url.replace(/^\/+/, ''), `${baseURL.replace(/\/+$/, '')}/`).toString();
  } catch {
    return `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  }
}

function shouldShowMobileApiDebugAlert(error: unknown): boolean {
  if (typeof window === 'undefined') return false;
  if (mobileApiAlertCount >= MAX_MOBILE_API_ALERTS_PER_PAGE) return false;

  const debugWindow = window as DebuggableWindow;
  const isMobileShell =
    debugWindow.__GRANVIA_APK__ ||
    window.matchMedia?.('(max-width: 768px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (!isMobileShell) return false;
  if (!axios.isAxiosError(error)) return false;

  const explicitDebugEnabled =
    localStorage.getItem(MOBILE_API_DEBUG_STORAGE_KEY) === '1' ||
    new URLSearchParams(window.location.search).has('api_debug');

  return explicitDebugEnabled || !error.response || Number(error.response.status) >= 500;
}

function showMobileApiDebugAlert(error: unknown): void {
  if (!shouldShowMobileApiDebugAlert(error) || !axios.isAxiosError(error)) return;
  mobileApiAlertCount += 1;

  const config = error.config;
  const responseData = error.response?.data;
  const details = {
    title: 'Granvia API debug',
    time: new Date().toISOString(),
    page: window.location.href,
    origin: window.location.origin,
    apiBaseUrl: API_BASE_URL,
    request: {
      method: config?.method?.toUpperCase() || '(unknown)',
      endpoint: config?.url || '(missing)',
      fullUrl: resolveRequestUrl(config?.baseURL, config?.url),
      params: safeDebugValue(config?.params),
      payload: parseRequestData(config?.data),
      headers: safeDebugValue(config?.headers),
    },
    response: error.response
      ? {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: safeDebugValue(error.response.headers),
          data: safeDebugValue(responseData),
        }
      : 'No response received. Possible CORS, TLS/certificate, DNS, network, or server connectivity failure.',
    error: {
      name: error.name,
      code: error.code,
      message: error.message,
    },
    device: {
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      apkMode: Boolean((window as DebuggableWindow).__GRANVIA_APK__),
    },
  };

  window.alert(JSON.stringify(details, null, 2));
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    showMobileApiDebugAlert(error);

    if (error?.response?.status === 401 && getStoredToken()) {
      setStoredToken(null);
      notifyAuthChange();
    }

    // Preserve the Axios error object, but replace generic messages such as
    // "Request failed with status code 422" / "Network Error" with text that
    // every form can safely show to the user.
    const data = error?.response?.data as { message?: unknown; errors?: Record<string, string[] | string> } | undefined;
    const firstValidationMessage = data?.errors
      ? Object.values(data.errors).flatMap(value => Array.isArray(value) ? value : [value]).find(value => typeof value === 'string' && value.trim())
      : undefined;
    if (typeof firstValidationMessage === 'string') {
      error.message = firstValidationMessage;
    } else if (typeof data?.message === 'string' && data.message.trim()) {
      error.message = data.message;
    } else if (!error?.response) {
      error.message = error?.code === 'ECONNABORTED'
        ? 'The request took too long. Please try again.'
        : 'Unable to connect to the server. Check your internet connection and try again.';
    }
    return Promise.reject(error);
  }
);
