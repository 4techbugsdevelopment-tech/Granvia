import { Request } from 'express';
import { env } from '../config/env';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value?.split(',')[0]?.trim();
}

export function requestBaseUrl(req: Request): string {
  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto']);
  const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host']);
  const forwardedSsl = firstHeaderValue(req.headers['x-forwarded-ssl']);
  const forwardedPort = firstHeaderValue(req.headers['x-forwarded-port']);
  const proto = forwardedProto || req.protocol;
  const effectiveProto = forwardedSsl === 'on' ? 'https' : proto;
  const host = forwardedHost || req.get('host');
  const derivedBaseUrl = host && forwardedPort && !host.includes(':') && !['80', '443'].includes(forwardedPort)
    ? `${effectiveProto}://${host}:${forwardedPort}`
    : `${effectiveProto}://${host}`;
  return isLocalBaseUrl(derivedBaseUrl) && !isLocalBaseUrl(env.publicApiUrl)
    ? env.publicApiUrl
    : derivedBaseUrl;
}

function isLocalBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['127.0.0.1', 'localhost', '0.0.0.0', '10.0.2.2'].includes(url.hostname);
  } catch {
    return false;
  }
}
