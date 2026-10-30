import { setTimeout as delay } from 'node:timers/promises';
import { env } from '../../../config/env';
import { SmsProvider, SmsProviderError, SmsProviderRequest, SmsProviderResult } from '../types';

type FetchLike = typeof fetch;

function providerMessageId(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const value = parsed.message_id ?? parsed.messageId ?? parsed.id ?? parsed.request_id;
    return value == null ? undefined : String(value).slice(0, 255);
  } catch {
    const match = body.match(/(?:message|request)[_-]?id["'\s:=]+([A-Za-z0-9._-]+)/i);
    return match?.[1]?.slice(0, 255);
  }
}

export class PowerTextSmsProvider implements SmsProvider {
  readonly name = 'powertext';

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async send(request: SmsProviderRequest): Promise<SmsProviderResult> {
    const values = new URLSearchParams({
      'authentic-key': env.sms.powerText.authKey,
      senderid: env.sms.powerText.senderId,
      route: env.sms.powerText.routeId,
      number: request.to.replace(/\D/g, ''),
      message: request.message,
      templateid: request.providerTemplateId,
      entityid: request.dltEntityId ?? env.sms.powerText.dltEntityId,
    });
    const method = env.sms.powerText.httpMethod as 'GET' | 'POST';
    const endpoint = `${env.sms.powerText.baseUrl}${env.sms.powerText.sendPath.startsWith('/') ? '' : '/'}${env.sms.powerText.sendPath}`;
    let attempts = 0;
    let lastError: SmsProviderError | undefined;

    while (attempts <= env.sms.maxRetries) {
      attempts += 1;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), env.sms.timeoutMs);
        let response: Response;
        try {
          response = await this.fetchImpl(method === 'GET' ? `${endpoint}?${values}` : endpoint, {
            method,
            headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
            body: method === 'POST' ? values : undefined,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        const body = (await response.text()).slice(0, 2_000);
        const providerRejected = /\b(error|invalid|failed|failure|rejected)\b/i.test(body);
        if (response.ok && !providerRejected) {
          return { status: 'accepted', providerMessageId: providerMessageId(body), attempts };
        }
        // Only retry explicit throttling responses. Transport failures and
        // timeouts are ambiguous and must not risk delivering the same OTP twice.
        const transient = response.status === 429;
        lastError = new SmsProviderError('PowerText rejected the SMS request.', `powertext_http_${response.status}`, transient, attempts);
      } catch (error) {
        const timedOut = error instanceof Error && error.name === 'AbortError';
        lastError = new SmsProviderError(
          timedOut ? 'PowerText request timed out.' : 'PowerText transport request failed.',
          timedOut ? 'powertext_timeout' : 'powertext_transport',
          false,
          attempts,
          'unknown',
        );
      }

      if (!lastError.transient || attempts > env.sms.maxRetries) break;
      await delay(env.sms.retryBaseDelayMs * (2 ** (attempts - 1)));
    }
    throw lastError ?? new SmsProviderError('PowerText request failed.', 'powertext_unknown', false, attempts);
  }
}
