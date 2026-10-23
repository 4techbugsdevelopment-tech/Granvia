import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { parseAdminPermissions } from '../utils/adminEmployeeAccess';

export async function adminEmployeeSession<T extends { id: string; role: string }>(user: T) {
  if (user.role !== 'admin_employee') return { ...user, adminPermissions: undefined, adminRoleName: undefined };
  const employee = await prisma.adminEmployee.findUnique({ where: { userId: user.id }, include: { role: true } });
  const owner = employee ? await prisma.user.findUnique({ where: { id: employee.ownerUserId } }) : null;
  if (!employee || employee.role.ownerUserId !== employee.ownerUserId || employee.role.status !== 'active' || owner?.role !== 'super_admin' || owner.accountStatus !== 'active') {
    throw new HttpError(403, 'Your employee role is unavailable. Contact your Super Admin.');
  }
  return { ...user, adminPermissions: parseAdminPermissions(employee.role.permissions), adminRoleName: employee.role.name };
}
