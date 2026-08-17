import { NextFunction, Request, Response } from 'express';

const buckets = new Map<string, { count: number; resetsAt: number }>();

/** Lightweight process-local protection. Use the deployment gateway/shared
 * rate limiter as the authoritative control in multi-instance production. */
export function simpleRateLimit(options: { windowMs: number; max: number; key: (req: Request) => string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = options.key(req);
    const current = buckets.get(key);
    const bucket = !current || current.resetsAt <= now ? { count: 0, resetsAt: now + options.windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetsAt - now) / 1000)));
      return res.status(429).json({ message: 'Too many requests. Please try again shortly.' });
    }
    next();
  };
}
