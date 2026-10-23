import { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma';
import { hasAdminEmployeeAccess, parseAdminPermissions } from '../utils/adminEmployeeAccess';

/** Only mounted on /admin. Unknown resources and account-management APIs fail closed. */
export async function requireAdminPanel(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || user.accountStatus !== 'active') return res.status(403).json({ message: 'Account is not active.' });
  if (user.role === 'super_admin') return next();
  if (user.role !== 'admin_employee') return res.status(403).json({ message: 'Forbidden.' });
  const employee = await prisma.adminEmployee.findUnique({ where: { userId: user.id }, include: { role: true } });
  const owner = employee ? await prisma.user.findUnique({ where: { id: employee.ownerUserId } }) : null;
  if (!employee || employee.role.ownerUserId !== employee.ownerUserId || employee.role.status !== 'active' || owner?.role !== 'super_admin' || owner.accountStatus !== 'active' ||
      !hasAdminEmployeeAccess(parseAdminPermissions(employee.role.permissions), req.path, req.method)) {
    return res.status(403).json({ message: 'You do not have access to this module.' });
  }
  // Existing admin handlers/report scopes expect super_admin. This request-only
  // projection happens AFTER module authorization; the stored login role stays
  // admin_employee. Never use it outside the /admin router.
  req.user = { ...user, role: 'super_admin' };
  next();
}
