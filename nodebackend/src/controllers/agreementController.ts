import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { serializeOut, toPrismaData } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';

// Port of App\Http\Controllers\AgreementController.

const JSON_FIELDS = ['terms'];

const createSchema = z.object({
  offer_id: z.string().uuid().nullish(),
  job_id: z.string().uuid().nullish(),
  guard_user_id: z.string().uuid().nullish(),
  site_id: z.string().uuid().nullish(),
  title: z.string(),
  terms: z.array(z.any()).or(z.record(z.any())).nullish(),
  effective_from: z.coerce.date().nullish(),
  effective_until: z.coerce.date().nullish(),
});

const updateSchema = z
  .object({
    terms: z.array(z.any()).or(z.record(z.any())).nullish(),
    effective_from: z.coerce.date().nullish(),
    effective_until: z.coerce.date().nullish(),
    status: z.string(),
    employer_confirmation_status: z.string(),
    guard_confirmation_status: z.string(),
    signed_at: z.coerce.date().nullish(),
  })
  .partial();

function agreementNumber(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return `AGR-${s}`;
}

/** GET /employer/agreements */
export async function index(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const rows = await prisma.agreement.findMany({
    where: {
      employerUserId: req.user!.id,
      ...(companyId ? { job: { companyId } } : {}),
    },
    include: { job: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const shaped = serializeOut(rows, JSON_FIELDS) as Array<
    Record<string, unknown> & { guard_user_id?: string }
  >;
  return res.json(await attachGuardProfiles(shaped));
}

/** POST /employer/agreements */
export async function store(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const created = await prisma.agreement.create({
    data: {
      ...toPrismaData(data, JSON_FIELDS),
      employerUserId: req.user!.id,
      agreementNumber: agreementNumber(),
      status: 'draft',
    } as never,
  });
  return res.status(201).json(serializeOut(created, JSON_FIELDS));
}

/** PATCH /employer/agreements/:agreement */
export async function update(req: Request, res: Response) {
  const row = await prisma.agreement.findUnique({ where: { id: req.params.agreement } });
  if (!row) throw new HttpError(404, 'Not found.');
  if (row.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = updateSchema.parse(req.body);
  const updated = await prisma.agreement.update({
    where: { id: row.id },
    data: toPrismaData(data, JSON_FIELDS) as never,
  });
  return res.json(serializeOut(updated, JSON_FIELDS));
}
