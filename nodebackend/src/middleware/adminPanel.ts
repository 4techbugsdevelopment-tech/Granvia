import { NextFunction, Request, Response } from 'express';
import { adminEmployeeSession } from '../services/adminEmployeeSession';
import { adminEmployeeModules, hasAdminEmployeeAccess, type GranviaEmployeePermission } from '../utils/adminEmployeeAccess';
import { HttpError } from '../utils/http';

async function delegatedSession(req: Request, res: Response) {
  try { return await adminEmployeeSession(req.user!); }
  catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      res.status(403).json(error.payload);
      return null;
    }
    throw error;
  }
}

function elevateDelegatedAdmin(req: Request, session: Awaited<ReturnType<typeof adminEmployeeSession>>) {
  req.delegatedAdminOwnerId = 'adminOwnerUserId' in session ? session.adminOwnerUserId : undefined;
  req.delegatedAdminPermissions = session.adminPermissions;
  // Permission is checked before this clone. Downstream admin controllers and
  // report routers can then reuse their existing Super Admin scope.
  req.user = { ...session, role: 'super_admin' } as unknown as NonNullable<Request['user']>;
}

export function requireAdminModule(...allowed: GranviaEmployeePermission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || user.accountStatus !== 'active') return res.status(403).json({ message: 'Account is not active.' });
    if (user.role === 'super_admin') return next();
    if (user.role !== 'admin_employee') return res.status(403).json({ message: 'Forbidden.' });
    const session = await delegatedSession(req, res);
    if (!session) return;
    if (!allowed.some(permission => session.adminPermissions?.includes(permission))) return res.status(403).json({ message: 'You do not have access to this Granvia module.' });
    elevateDelegatedAdmin(req, session);
    return next();
  };
}

/** Mounted on /admin. Unknown resources and unassigned modules fail closed. */
export async function requireAdminPanel(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || user.accountStatus !== 'active') return res.status(403).json({ message: 'Account is not active.' });
  if (user.role === 'super_admin') return next();
  if (user.role !== 'admin_employee') return res.status(403).json({ message: 'Forbidden.' });
  const session = await delegatedSession(req, res);
  if (!session) return;
  const originalPath = (req.originalUrl || req.path || '/').split('?')[0];
  const adminAt = originalPath.indexOf('/admin');
  const modulePath = adminAt >= 0 ? originalPath.slice(adminAt + '/admin'.length) || '/' : req.path;
  if (!adminEmployeeModules(modulePath, req.method).length || !hasAdminEmployeeAccess(session.adminPermissions ?? [], modulePath, req.method)) {
    return res.status(403).json({ message: 'You do not have access to this Granvia module.' });
  }
  elevateDelegatedAdmin(req, session);
  return next();
}
