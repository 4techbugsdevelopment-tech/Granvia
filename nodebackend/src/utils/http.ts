import { NextFunction, Request, Response } from 'express';

/**
 * Thrown by controllers/services to produce a specific HTTP status.
 * Mirrors Laravel's abort()/response()->json([...], status) pattern.
 */
export class HttpError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.payload = { message, ...extra };
  }
}

/** Wraps an async route handler so thrown errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
