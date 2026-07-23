import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys, toPrismaData } from '../utils/serialize';
import { serializeUserRow, serializeGuardProfile } from '../serializers/userSerializer';
import { storeFile, IncomingFile } from '../utils/fileStorage';

// Port of App\Http\Controllers\ProfileController (shared /me routes).

const GUARD_JSON = ['skills', 'languages'];

const updateUserSchema = z.object({
  full_name: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'The mobile format is invalid.'),
}).partial();

const guardProfileSchema = z
  .object({
    full_name: z.string().min(2),
    mobile: z.string().regex(/^[6-9]\d{9}$/, 'The mobile format is invalid.'),
    gender: z.string().nullish(),
    dob: z.coerce.date().nullish(),
    address: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    pincode: z.string().regex(/^\d{6}$/).nullish(),
    latitude: z.coerce.number().min(-90).max(90).nullish(),
    longitude: z.coerce.number().min(-180).max(180).nullish(),
    search_radius_km: z.coerce.number().int().min(1).max(100),
    qualification: z.string().nullish(),
    skills: z.array(z.string()),
    languages: z.array(z.string()),
    experience: z.string().nullish(),
    bank_account_number: z.string().regex(/^\d{9,18}$/).nullish(),
    bank_ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).nullish(),
    bank_name: z.string().nullish(),
    account_holder_name: z.string().nullish(),
  })
  .partial();

const employerProfileSchema = z
  .object({
    contact_person_name: z.string(),
    designation: z.string().nullish(),
    city: z.string(),
    state: z.string(),
    pincode: z.string().regex(/^\d{6}$/),
  })
  .partial();

/** GET /me/profile */
export async function show(req: Request, res: Response) {
  return res.json(serializeUserRow(req.user as unknown as Record<string, unknown>));
}

/** PATCH /me/profile */
export async function update(req: Request, res: Response) {
  const data = updateUserSchema.parse(req.body);
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: toPrismaData(data),
  });
  return res.json(serializeUserRow(updated as unknown as Record<string, unknown>));
}

/** POST /me/avatar */
export async function uploadAvatar(req: Request, res: Response) {
  const file = req.file as IncomingFile | undefined;
  if (!file) {
    throw new HttpError(422, 'The file field is required.', { errors: { file: ['The file field is required.'] } });
  }
  if (!file.mimetype.startsWith('image/')) {
    throw new HttpError(422, 'The file must be an image.', { errors: { file: ['The file must be an image.'] } });
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new HttpError(422, 'The file must not be greater than 5120 kilobytes.', { errors: { file: ['The file must not be greater than 5120 kilobytes.'] } });
  }

  const stored = storeFile('profile-images', req.user!.id, file);
  const updated = await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: stored.url } });
  return res.json(serializeUserRow(updated as unknown as Record<string, unknown>));
}

/** GET /me/guard-profile */
export async function showGuardProfile(req: Request, res: Response) {
  const profile = await prisma.guardProfile.findUnique({ where: { userId: req.user!.id } });
  return res.json(serializeGuardProfile(profile as unknown as Record<string, unknown> | null));
}

/** PATCH /me/guard-profile */
export async function updateGuardProfile(req: Request, res: Response) {
  const data = guardProfileSchema.parse(req.body);
  const profile = await prisma.guardProfile.findUnique({ where: { userId: req.user!.id } });
  if (!profile) throw new HttpError(404, 'Associate profile not found.');

  const updated = await prisma.guardProfile.update({
    where: { userId: req.user!.id },
    data: toPrismaData(data, GUARD_JSON) as never,
  });
  return res.json(serializeGuardProfile(updated as unknown as Record<string, unknown>));
}

/** GET /me/employer-profile */
export async function showEmployerProfile(req: Request, res: Response) {
  const profile = await prisma.employerProfile.findUnique({ where: { userId: req.user!.id } });
  return res.json(profile ? snakeKeys(profile) : null);
}

/** PATCH /me/employer-profile */
export async function updateEmployerProfile(req: Request, res: Response) {
  const data = employerProfileSchema.parse(req.body);
  const profile = await prisma.employerProfile.findUnique({ where: { userId: req.user!.id } });
  if (!profile) throw new HttpError(404, 'Employer profile not found.');

  const updated = await prisma.employerProfile.update({
    where: { userId: req.user!.id },
    data: toPrismaData(data) as never,
  });
  return res.json(snakeKeys(updated));
}
