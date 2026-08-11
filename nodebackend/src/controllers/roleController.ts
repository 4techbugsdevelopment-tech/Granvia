import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { serializeOut } from '../utils/serialize';

const ROLE_MODULES = [
  'Dashboard',
  'Associate Management',
  'Employer Management',
  'Job Management',
  'Attendance',
  'Hiring Workflow',
  'Wallet & Payments',
  'Reports',
  'Email Logs',
  'Role Master',
  'Settings',
  'Staff Management',
  'Sub Admin Management',
  'Company Sites',
  'Applications',
  'Interview Requests',
  'Job Offers',
  'Agreements',
  'Invoices',
  'Support Tickets',
  'Notifications',
  'Verification Queue',
  'Clients',
  'Documents',
] as const;

const roleSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullish(),
  permissions: z.array(z.enum(ROLE_MODULES)).default([]),
  status: z.enum(['active', 'inactive']).default('active'),
});

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function uniqueCode(name: string, ignoreId?: string) {
  const base = slugify(name) || 'role';
  const exists = await prisma.role.findFirst({
    where: {
      code: base,
      ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
    },
    select: { id: true },
  });
  return exists ? `${base}_${Date.now().toString(36)}` : base;
}

/** GET /admin/roles */
export async function index(_req: Request, res: Response) {
  const roles = await prisma.role.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });
  return res.json(serializeOut(roles, ['permissions']));
}

/** GET /me/roles */
export async function active(_req: Request, res: Response) {
  const roles = await prisma.role.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });
  return res.json(serializeOut(roles, ['permissions']));
}

/** POST /admin/roles */
export async function store(req: Request, res: Response) {
  const data = roleSchema.parse(req.body);
  const existing = await prisma.role.findFirst({ where: { name: data.name } });
  if (existing) throw new HttpError(422, 'The role name has already been taken.');

  const role = await prisma.role.create({
    data: {
      code: await uniqueCode(data.name),
      name: data.name,
      description: data.description ?? null,
      permissions: JSON.stringify(data.permissions ?? []),
      status: data.status,
      createdByUserId: req.user?.id ?? null,
    } as never,
  });
  return res.status(201).json(serializeOut(role, ['permissions']));
}

/** PATCH /admin/roles/:role */
export async function update(req: Request, res: Response) {
  const role = await prisma.role.findUnique({ where: { id: req.params.role } });
  if (!role) throw new HttpError(404, 'Role not found.');

  const data = roleSchema.partial().parse(req.body);
  if (data.name) {
    const exists = await prisma.role.findFirst({
      where: { name: data.name, NOT: { id: role.id } },
      select: { id: true },
    });
    if (exists) throw new HttpError(422, 'The role name has already been taken.');
  }

  const updated = await prisma.role.update({
    where: { id: role.id },
    data: {
      ...(data.name !== undefined ? { name: data.name, code: await uniqueCode(data.name, role.id) } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.permissions !== undefined ? { permissions: JSON.stringify(data.permissions ?? []) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    } as never,
  });
  return res.json(serializeOut(updated, ['permissions']));
}

/** DELETE /admin/roles/:role */
export async function destroy(req: Request, res: Response) {
  const role = await prisma.role.findUnique({ where: { id: req.params.role } });
  if (!role) throw new HttpError(404, 'Role not found.');

  const updated = await prisma.role.update({
    where: { id: role.id },
    data: { status: 'inactive' },
  });
  return res.json(serializeOut(updated, ['permissions']));
}
