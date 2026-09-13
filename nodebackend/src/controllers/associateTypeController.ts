import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { serializeOut } from '../utils/serialize';

const associateTypeSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullish(),
  status: z.enum(['active', 'inactive']).default('active'),
});

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function uniqueCode(name: string) {
  const base = slugify(name) || 'associate_type';
  const exists = await prisma.associateType.findFirst({
    where: { code: base },
    select: { id: true },
  });
  return exists ? `${base}_${Date.now().toString(36)}` : base;
}

/** GET /associate-types */
export async function active(_req: Request, res: Response) {
  const rows = await prisma.associateType.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });
  return res.json(serializeOut(rows));
}

/** GET /admin/associate-types */
export async function index(_req: Request, res: Response) {
  const rows = await prisma.associateType.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });
  return res.json(serializeOut(rows));
}

/** POST /admin/associate-types */
export async function store(req: Request, res: Response) {
  const data = associateTypeSchema.parse(req.body);
  const existing = await prisma.associateType.findFirst({ where: { name: data.name } });
  if (existing) throw new HttpError(422, 'The associate type name has already been taken.');

  const row = await prisma.associateType.create({
    data: {
      code: await uniqueCode(data.name),
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      createdByUserId: req.user?.id ?? null,
    },
  });
  return res.status(201).json(serializeOut(row));
}

/** PATCH /admin/associate-types/:associateType */
export async function update(req: Request, res: Response) {
  const row = await prisma.associateType.findUnique({ where: { id: req.params.associateType } });
  if (!row) throw new HttpError(404, 'Associate type not found.');

  const data = associateTypeSchema.partial().parse(req.body);
  if (data.name) {
    const exists = await prisma.associateType.findFirst({
      where: { name: data.name, NOT: { id: row.id } },
      select: { id: true },
    });
    if (exists) throw new HttpError(422, 'The associate type name has already been taken.');
  }

  const updated = await prisma.associateType.update({
    where: { id: row.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
  return res.json(serializeOut(updated));
}

/** DELETE /admin/associate-types/:associateType */
export async function destroy(req: Request, res: Response) {
  const row = await prisma.associateType.findUnique({ where: { id: req.params.associateType } });
  if (!row) throw new HttpError(404, 'Associate type not found.');

  const [users, jobs] = await Promise.all([
    prisma.user.count({ where: { role: 'guard', profileType: row.code } }),
    prisma.jobPost.count({ where: { guardType: row.code } }),
  ]);
  if (users || jobs) {
    throw new HttpError(409, 'This associate type is already in use. Mark it inactive instead of deleting it.');
  }

  await prisma.associateType.delete({ where: { id: row.id } });
  return res.json({ message: 'Associate type deleted successfully.' });
}
