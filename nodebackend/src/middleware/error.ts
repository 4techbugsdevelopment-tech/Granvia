import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http';

/** Formats a ZodError into Laravel's 422 validation-error shape. */
function zodToLaravel(err: ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const field = issue.path.join('.') || 'value';
    (errors[field] ??= []).push(issue.message);
  }
  const first = Object.values(errors)[0]?.[0] ?? 'The given data was invalid.';
  return { message: first, errors };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json(zodToLaravel(err));
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json(err.payload);
  }

  console.error('[unhandled error]', err);
  return res.status(500).json({ message: 'Server error.' });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: 'Not found.' });
}
