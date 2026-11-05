import axios from 'axios';
import { notifyAuthChange } from './authBus';
import { getAdminEmployerId } from './adminEmployerAccess';

// Relative by default so the same build works on localhost and production:
// - dev: Vite proxies /api -> backend (see vite.config.ts server.proxy)
// - prod: the host proxies /api -> backend (netlify.toml redirect / nginx)
// Set VITE_API_URL to a full URL only for a cross-origin backend (requires CORS).
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const TOKEN_STORAGE_KEY = 'granvia_api_token';

function usesSessionOnlyAppToken(): boolean {
  const appWindow = window as Window & { __GRANVIA_APK__?: boolean };
  return Boolean(
    appWindow.__GRANVIA_APK__ ||
    navigator.userAgent.includes('wv') ||
    window.matchMedia?.('(display-mode: standalone)').matches
  );
}

export function getStoredToken(): string | null {
  if (usesSessionOnlyAppToken()) {
    // Older app builds persisted tokens indefinitely. Remove that legacy copy
    // so an app process restarted after close must authenticate again.
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  const storage = usesSessionOnlyAppToken() ? sessionStorage : localStorage;
  if (token) {
    storage.setItem(TOKEN_STORAGE_KEY, token);
    if (storage === sessionStorage) localStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
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
  const employerId = getAdminEmployerId();
  if (employerId) config.headers['X-Admin-Employer-Id'] = employerId;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && getStoredToken() && !getAdminEmployerId()) {
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
