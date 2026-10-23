import { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma';
import { resolveTokenUserId } from '../utils/token';
import { adminEmployeeSession } from '../services/adminEmployeeSession';
import { applyAdminEmployerAccess } from '../services/adminEmployerAccess';

// Augment Express Request with the authenticated user + raw token.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Awaited<ReturnType<typeof prisma.user.findUnique>>;
      bearerToken?: string;
      adminEmployerAccess?: {
        actor_id: string; actor_name: string; employer_id: string;
        employer_name: string; employer_status: string;
      };
    }
  }
}

/** Bearer-token auth guard for protected routes. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  const bearer = match[1].trim();
  const userId = await resolveTokenUserId(bearer);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  req.user = user;
  if (user.role === 'admin_employee') {
    if (user.accountStatus !== 'active') return res.status(403).json({ message: 'Account is not active.' });
    try { await adminEmployeeSession(user); }
    catch (error) { return next(error); }
  }
  req.bearerToken = bearer;
  try { await applyAdminEmployerAccess(req); }
  catch (error) { return next(error); }
  if (req.adminEmployerAccess) {
    res.set('Cache-Control', 'no-store');
    const access = req.adminEmployerAccess;
    res.once('finish', () => {
      console.info('[admin-employer-access]', JSON.stringify({
        actor_id: access.actor_id, employer_id: access.employer_id,
        method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode,
      }));
    });
  }
  next();
}
