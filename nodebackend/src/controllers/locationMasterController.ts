import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { serializeOut } from '../utils/serialize';

const statusSchema = z.enum(['active', 'inactive']);

const stateSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(150),
  type: z.enum(['state', 'union_territory']).default('state'),
  status: statusSchema.default('active'),
});

const citySchema = z.object({
  state_id: z.string().uuid(),
  name: z.string().trim().min(2).max(150),
  status: statusSchema.default('active'),
});

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

async function assertActiveStateByName(state?: string | null) {
  const name = normalizeName(state ?? '');
  if (!name) return;
  const row = await prisma.stateMaster.findFirst({ where: { name, status: 'active' }, select: { id: true } });
  if (!row) throw new HttpError(422, 'Select a valid active state.', { errors: { state: ['Select a valid active state.'] } });
}

export async function assertActiveCityState(city?: string | null, state?: string | null) {
  const cityName = normalizeName(city ?? '');
  const stateName = normalizeName(state ?? '');
  if (!cityName && !stateName) return;
  if (!cityName) return assertActiveStateByName(stateName);
  if (!stateName) throw new HttpError(422, 'Select a valid active state for the city.', { errors: { state: ['Select a valid active state for the city.'] } });

  const row = await prisma.cityMaster.findFirst({
    where: { name: cityName, status: 'active', state: { name: stateName, status: 'active' } },
    select: { id: true },
  });
  if (!row) {
    throw new HttpError(422, 'Select a valid active city and state from the master.', {
      errors: { city: ['Select a valid active city and state from the master.'] },
    });
  }
}

/** GET /location-master/states */
export async function activeStates(_req: Request, res: Response) {
  const rows = await prisma.stateMaster.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });
  return res.json(serializeOut(rows));
}

/** GET /location-master/cities */
export async function activeCities(req: Request, res: Response) {
  const stateId = typeof req.query.state_id === 'string' ? req.query.state_id : undefined;
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = await prisma.cityMaster.findMany({
    where: {
      status: 'active',
      ...(stateId ? { stateId } : {}),
      ...(search ? { name: { contains: search } } : {}),
      state: { status: 'active' },
    },
    include: { state: true },
    orderBy: [{ name: 'asc' }],
    take: 250,
  });
  return res.json(serializeOut(rows));
}

/** GET /admin/location/states */
export async function adminStates(_req: Request, res: Response) {
  const rows = await prisma.stateMaster.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] });
  return res.json(serializeOut(rows));
}

/** POST /admin/location/states */
export async function storeState(req: Request, res: Response) {
  const data = stateSchema.parse(req.body);
  const exists = await prisma.stateMaster.findFirst({
    where: { OR: [{ code: data.code.toUpperCase() }, { name: normalizeName(data.name) }] },
    select: { id: true },
  });
  if (exists) throw new HttpError(422, 'State code or name already exists.');
  const row = await prisma.stateMaster.create({
    data: {
      code: data.code.toUpperCase(),
      name: normalizeName(data.name),
      type: data.type,
      status: data.status,
      createdByUserId: req.user?.id ?? null,
    },
  });
  return res.status(201).json(serializeOut(row));
}

/** PATCH /admin/location/states/:state */
export async function updateState(req: Request, res: Response) {
  const row = await prisma.stateMaster.findUnique({ where: { id: req.params.state } });
  if (!row) throw new HttpError(404, 'State not found.');
  const data = stateSchema.partial().parse(req.body);
  const nextCode = data.code?.toUpperCase();
  const nextName = data.name ? normalizeName(data.name) : undefined;
  if (nextCode || nextName) {
    const exists = await prisma.stateMaster.findFirst({
      where: { NOT: { id: row.id }, OR: [...(nextCode ? [{ code: nextCode }] : []), ...(nextName ? [{ name: nextName }] : [])] },
      select: { id: true },
    });
    if (exists) throw new HttpError(422, 'State code or name already exists.');
  }
  const updated = await prisma.stateMaster.update({
    where: { id: row.id },
    data: {
      ...(nextCode ? { code: nextCode } : {}),
      ...(nextName ? { name: nextName } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
  });
  return res.json(serializeOut(updated));
}

/** DELETE /admin/location/states/:state */
export async function destroyState(req: Request, res: Response) {
  const row = await prisma.stateMaster.findUnique({ where: { id: req.params.state } });
  if (!row) throw new HttpError(404, 'State not found.');
  const cityCount = await prisma.cityMaster.count({ where: { stateId: row.id } });
  if (cityCount) throw new HttpError(409, 'This state has cities. Mark it inactive instead of deleting it.');
  await prisma.stateMaster.delete({ where: { id: row.id } });
  return res.json({ message: 'State deleted successfully.' });
}

/** GET /admin/location/cities */
export async function adminCities(req: Request, res: Response) {
  const stateId = typeof req.query.state_id === 'string' ? req.query.state_id : undefined;
  const rows = await prisma.cityMaster.findMany({
    where: { ...(stateId ? { stateId } : {}) },
    include: { state: true },
    orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }],
  });
  return res.json(serializeOut(rows));
}

/** POST /admin/location/cities */
export async function storeCity(req: Request, res: Response) {
  const data = citySchema.parse(req.body);
  const state = await prisma.stateMaster.findUnique({ where: { id: data.state_id } });
  if (!state) throw new HttpError(422, 'Select a valid state.');
  const name = normalizeName(data.name);
  const exists = await prisma.cityMaster.findFirst({ where: { stateId: data.state_id, name }, select: { id: true } });
  if (exists) throw new HttpError(422, 'City already exists for this state.');
  const row = await prisma.cityMaster.create({
    data: { stateId: data.state_id, name, status: data.status, createdByUserId: req.user?.id ?? null },
    include: { state: true },
  });
  return res.status(201).json(serializeOut(row));
}

/** PATCH /admin/location/cities/:city */
export async function updateCity(req: Request, res: Response) {
  const row = await prisma.cityMaster.findUnique({ where: { id: req.params.city } });
  if (!row) throw new HttpError(404, 'City not found.');
  const data = citySchema.partial().parse(req.body);
  const stateId = data.state_id ?? row.stateId;
  if (data.state_id) {
    const state = await prisma.stateMaster.findUnique({ where: { id: data.state_id } });
    if (!state) throw new HttpError(422, 'Select a valid state.');
  }
  const name = data.name ? normalizeName(data.name) : row.name;
  const exists = await prisma.cityMaster.findFirst({ where: { NOT: { id: row.id }, stateId, name }, select: { id: true } });
  if (exists) throw new HttpError(422, 'City already exists for this state.');
  const updated = await prisma.cityMaster.update({
    where: { id: row.id },
    data: {
      ...(data.state_id ? { stateId: data.state_id } : {}),
      ...(data.name ? { name } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    include: { state: true },
  });
  return res.json(serializeOut(updated));
}

/** DELETE /admin/location/cities/:city */
export async function destroyCity(req: Request, res: Response) {
  const row = await prisma.cityMaster.findUnique({ where: { id: req.params.city } });
  if (!row) throw new HttpError(404, 'City not found.');
  await prisma.cityMaster.delete({ where: { id: row.id } });
  return res.json({ message: 'City deleted successfully.' });
}
