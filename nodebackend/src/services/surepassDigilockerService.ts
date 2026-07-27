import { env } from '../config/env';
import { HttpError } from '../utils/http';

const INITIALIZE_PATH = '/api/v1/digilocker/initialize';

export type SurepassDigilockerSession = {
  client_id: string;
  token: string;
  url: string;
  expiry_seconds: number;
};

export type SurepassInitializeResponse = {
  data: SurepassDigilockerSession;
  status_code: number;
  message_code: string;
  message: string;
  success: boolean;
};

export type InitializeDigilockerOptions = {
  redirectUrl: string;
  signupFlow?: boolean;
  skipMainScreen?: boolean;
  logoUrl?: string;
};

function isInitializeResponse(value: unknown): value is SurepassInitializeResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  const data = response.data;
  if (!data || typeof data !== 'object') return false;
  const session = data as Record<string, unknown>;
  return (
    typeof response.success === 'boolean' &&
    typeof session.client_id === 'string' &&
    typeof session.token === 'string' &&
    typeof session.url === 'string' &&
    typeof session.expiry_seconds === 'number'
  );
}

async function readResponseBody(response: globalThis.Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 2_000) };
  }
}

/**
 * Creates a short-lived hosted DigiLocker verification session.
 *
 * The account bearer token is deliberately read only from the backend
 * environment. The returned token is a separate, short-lived session token
 * intended for the Surepass hosted flow.
 */
export async function initializeDigilockerSession(
  options: InitializeDigilockerOptions
): Promise<SurepassInitializeResponse> {
  if (!env.surepass.bearerToken) {
    throw new HttpError(
      503,
      'Surepass sandbox is not configured. Set SUREPASS_BEARER_TOKEN on the backend.'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.surepass.timeoutMs);

  try {
    const response = await fetch(`${env.surepass.baseUrl}${INITIALIZE_PATH}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.surepass.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          signup_flow: options.signupFlow ?? true,
          redirect_url: options.redirectUrl,
          skip_main_screen: options.skipMainScreen ?? false,
          ...(options.logoUrl ? { logo_url: options.logoUrl } : {}),
        },
      }),
      signal: controller.signal,
    });

    const body = await readResponseBody(response);
    if (!response.ok) {
      throw new HttpError(502, 'Surepass rejected the sandbox session request.', {
        provider: 'surepass',
        upstream_status: response.status,
        upstream_response: body,
      });
    }

    if (!isInitializeResponse(body) || !body.success) {
      throw new HttpError(502, 'Surepass returned an unexpected response.', {
        provider: 'surepass',
        upstream_status: response.status,
        upstream_response: body,
      });
    }

    return body;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, 'Surepass sandbox request timed out.', {
        provider: 'surepass',
      });
    }
    throw new HttpError(502, 'Unable to reach the Surepass sandbox.', {
      provider: 'surepass',
    });
  } finally {
    clearTimeout(timeout);
  }
}
