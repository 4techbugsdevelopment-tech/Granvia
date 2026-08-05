import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

/**
 * Blocks the automated/self-service Aadhaar endpoints while AADHAAR_API_ENABLED
 * is off. Verification is done manually by admins/employers in that mode.
 */
export function requireAadhaarApi(_req: Request, res: Response, next: NextFunction) {
  if (!env.aadhaarApiEnabled) {
    return res.status(403).json({
      message: 'Aadhaar self-verification is currently disabled. Verification is done manually by your administrator.',
      code: 'aadhaar_api_disabled',
    });
  }
  next();
}
