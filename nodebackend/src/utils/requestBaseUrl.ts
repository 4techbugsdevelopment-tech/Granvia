import { Request } from 'express';

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
  if (host && forwardedPort && !host.includes(':') && !['80', '443'].includes(forwardedPort)) {
    return `${effectiveProto}://${host}:${forwardedPort}`;
  }
  return `${effectiveProto}://${host}`;
}
