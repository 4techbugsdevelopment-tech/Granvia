import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { parseJsonField, snakeKeys } from '../utils/serialize';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEK_MINUTES = 7 * 24 * 60;

const availabilitySchema = z.object({
  duration_hours: z.coerce.number().int().refine(value => [4, 6, 8, 12].includes(value), 'Invalid shift duration.'),
  frequency: z.enum(['Regular', 'Weekly', 'Daily']),
  days: z.array(z.enum(DAYS)).min(1, 'Select at least one day.').transform(days => [...new Set(days)]),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must use HH:mm format.'),
  active: z.boolean().optional().default(true),
});

type Slot = { days: string[]; startTime: string; durationHours: number };

function slotIntervals(slot: Slot): Array<[number, number]> {
  const [hours, minutes] = slot.startTime.split(':').map(Number);
  const startInDay = hours * 60 + minutes;
  return slot.days.map(day => {
    const dayIndex = DAYS.indexOf(day as typeof DAYS[number]);
    const start = dayIndex * 1440 + startInDay;
    return [start, start + slot.durationHours * 60];
  });
}

function overlaps(a: Slot, b: Slot): boolean {
  const aIntervals = slotIntervals(a);
  const bIntervals = slotIntervals(b);
  return aIntervals.some(([aStart, aEnd]) =>
    bIntervals.some(([baseStart, baseEnd]) =>
      [-WEEK_MINUTES, 0, WEEK_MINUTES].some(shift => {
        const bStart = baseStart + shift;
        const bEnd = baseEnd + shift;
        return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
      })
    )
  );
}

function serialize(row: Record<string, unknown>) {
  const out = snakeKeys(row) as Record<string, unknown>;
  out.days = parseJsonField(out.days);
  return out;
}

async function assertNoConflict(
  guardUserId: string,
  candidate: Slot,
  excludeId?: string
) {
  const existing = await prisma.guardAvailability.findMany({
    where: {
      guardUserId,
      active: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  const conflict = existing.find(row => overlaps(candidate, {
    days: (parseJsonField(row.days) as string[]) ?? [],
    startTime: row.startTime,
    durationHours: row.durationHours,
  }));

  if (conflict) {
    const conflictDays = (parseJsonField(conflict.days) as string[]).join(', ');
    throw new HttpError(422, `This schedule overlaps your ${conflict.durationHours}hr ${conflict.frequency} availability at ${conflict.startTime} on ${conflictDays}.`);
  }
}

export async function index(req: Request, res: Response) {
  const rows = await prisma.guardAvailability.findMany({
    where: { guardUserId: req.user!.id },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
  });
  return res.json(rows.map(row => serialize(row as unknown as Record<string, unknown>)));
}

export async function store(req: Request, res: Response) {
  const data = availabilitySchema.parse(req.body);
  if (data.active) {
    await assertNoConflict(req.user!.id, {
      days: data.days,
      startTime: data.start_time,
      durationHours: data.duration_hours,
    });
  }
  const row = await prisma.guardAvailability.create({
    data: {
      guardUserId: req.user!.id,
      durationHours: data.duration_hours,
      frequency: data.frequency,
      days: JSON.stringify(data.days),
      startTime: data.start_time,
      active: data.active,
    },
  });
  return res.status(201).json(serialize(row as unknown as Record<string, unknown>));
}

export async function update(req: Request, res: Response) {
  const row = await prisma.guardAvailability.findUnique({ where: { id: req.params.availability } });
  if (!row) throw new HttpError(404, 'Availability not found.');
  if (row.guardUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const currentDays = (parseJsonField(row.days) as string[]) ?? [];
  const data = availabilitySchema.partial().parse(req.body);
  const candidate = {
    days: data.days ?? currentDays,
    startTime: data.start_time ?? row.startTime,
    durationHours: data.duration_hours ?? row.durationHours,
  };
  const active = data.active ?? row.active;
  if (active) await assertNoConflict(req.user!.id, candidate, row.id);

  const updated = await prisma.guardAvailability.update({
    where: { id: row.id },
    data: {
      ...(data.duration_hours !== undefined ? { durationHours: data.duration_hours } : {}),
      ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
      ...(data.days !== undefined ? { days: JSON.stringify(data.days) } : {}),
      ...(data.start_time !== undefined ? { startTime: data.start_time } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
  return res.json(serialize(updated as unknown as Record<string, unknown>));
}

export async function destroy(req: Request, res: Response) {
  const row = await prisma.guardAvailability.findUnique({ where: { id: req.params.availability } });
  if (!row) throw new HttpError(404, 'Availability not found.');
  if (row.guardUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');
  await prisma.guardAvailability.delete({ where: { id: row.id } });
  return res.status(204).send();
}
