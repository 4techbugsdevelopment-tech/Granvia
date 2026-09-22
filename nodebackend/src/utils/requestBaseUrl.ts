import { Request } from 'express';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value?.split(',')[0]?.trim();
}

export function requestBaseUrl(req: Request): string {
  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto']);
  const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host']);
  const proto = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');
  return `${proto}://${host}`;
}
