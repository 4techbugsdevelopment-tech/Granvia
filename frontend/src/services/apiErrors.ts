import axios from 'axios';

export type ValidationErrors = Record<string, string>;

/** Returns the API's field => message validation map (422 responses). */
export function getValidationErrors(error: unknown): ValidationErrors {
  if (!axios.isAxiosError(error)) return {};

  const data = error.response?.data as { errors?: Record<string, string[] | string> } | undefined;
  if (!data?.errors || typeof data.errors !== 'object') return {};

  return Object.fromEntries(
    Object.entries(data.errors).flatMap(([field, messages]) => {
      const message = Array.isArray(messages) ? messages[0] : messages;
      return typeof message === 'string' && message ? [[field, message]] : [];
    }),
  );
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  if (!error) return fallback;

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    if (data?.errors) {
      const first = Object.values(data.errors)[0]?.[0];
      if (first) return first;
    }
    if (data?.message) return data.message;
  }

  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
}
