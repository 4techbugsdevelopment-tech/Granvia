import { NextFunction, Request, Response } from 'express';

/**
 * Role-check middleware for route protection.
 * Must run after requireAuth.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    if (user.accountStatus === 'blocked' || user.accountStatus === 'inactive') {
      return res.status(403).json({ message: 'Account is not active.' });
    }

    next();
  };
}
