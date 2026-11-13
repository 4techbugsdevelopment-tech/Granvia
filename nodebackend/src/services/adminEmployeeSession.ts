import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { parseAdminPermissions } from '../utils/adminEmployeeAccess';
import { assertAdminEmployeeClient } from './adminEmployeeStorage';

export async function adminEmployeeSession<T extends { id: string; role: string }>(user: T) {
  if (user.role === 'employer_employee') {
    const member = await prisma.staffMember.findUnique({ where: { userId: user.id }, include: { roleMaster: true, company: true } });
    const employer = member?.employerUserId ? await prisma.user.findUnique({ where: { id: member.employerUserId } }) : null;
    if (!member || !member.roleMaster || !member.company || member.status !== 'Active' || member.roleMaster.status !== 'active' || employer?.role !== 'employer' || employer.accountStatus !== 'active' || member.company.accountStatus !== 'active' || member.company.employerUserId !== employer.id) {
      throw new HttpError(403, 'Your company employee role is unavailable. Contact your Employer.');
    }
    let permissions: string[] = [];
    try { const parsed = JSON.parse(member.roleMaster.permissions ?? '[]'); permissions = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []; } catch { permissions = []; }
    return { ...user, adminPermissions: permissions, adminRoleName: member.roleMaster.name };
  }
  if (user.role !== 'admin_employee') return { ...user, adminPermissions: undefined, adminRoleName: undefined };
  assertAdminEmployeeClient();
  const employee = await prisma.adminEmployee.findUnique({ where: { userId: user.id }, include: { role: true } });
  const owner = employee ? await prisma.user.findUnique({ where: { id: employee.ownerUserId } }) : null;
  if (!employee || employee.role.ownerUserId !== employee.ownerUserId || employee.role.status !== 'active' || owner?.role !== 'super_admin' || owner.accountStatus !== 'active') {
    throw new HttpError(403, 'Your employee role is unavailable. Contact your Super Admin.');
  }
  return { ...user, adminPermissions: parseAdminPermissions(employee.role.permissions), adminRoleName: employee.role.name };
}
