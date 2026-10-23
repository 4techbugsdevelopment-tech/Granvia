import type { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';

export const ADMIN_EMPLOYER_HEADER = 'x-admin-employer-id';

/** Authenticate the real actor first; the target ID alone never grants access. */
export async function applyAdminEmployerAccess(req: Request) {
  const target = req.header(ADMIN_EMPLOYER_HEADER);
  if (target === undefined) return;
  const actor = req.user;
  if (actor?.role !== 'super_admin' || actor.accountStatus !== 'active') {
    throw new HttpError(403, 'Only an active Super Admin can manage an employer account directly.');
  }
  const path = req.originalUrl.split('?')[0].replace(/^\/api(?=\/)/, '');
  if (!/^\/(employer|me)(\/|$)/.test(path) && path !== '/auth/me') {
    throw new HttpError(403, 'Employer management access is limited to the employer workspace.');
  }
  const employerId = z.string().uuid().parse(target);
  const employer = await prisma.user.findFirst({ where: { id: employerId, role: 'employer' } });
  if (!employer) throw new HttpError(404, 'Employer account not found.');
  req.adminEmployerAccess = {
    actor_id: actor.id, actor_name: actor.fullName, employer_id: employer.id,
    employer_name: employer.fullName, employer_status: employer.accountStatus,
  };
  // Keep all existing employer ownership filters and business rules. Admin may
  // manage inactive/blocked accounts without changing their actual saved status.
  req.user = { ...employer, accountStatus: 'active' };
}
