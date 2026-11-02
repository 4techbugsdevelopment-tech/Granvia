import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { resolveEffectiveLwfSetting } from '../services/lwfService';

const amount = z.union([z.string(), z.number()]).transform((raw, context) => {
  try {
    const value = new Prisma.Decimal(raw);
    if (!value.isFinite() || value.isNegative() || value.greaterThan('9999999999.99')) throw new Error();
    return value.toFixed(2);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid non-negative LWF amount.' });
    return z.NEVER;
  }
});

const settingSchema = z.object({
  employee_amount: amount,
  employer_amount: amount,
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().trim().max(500).nullish(),
}).strict();

async function assertPersistedSuperAdmin(userId: string) {
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, accountStatus: true } });
  if (!actor || actor.role !== 'super_admin' || actor.accountStatus !== 'active') throw new HttpError(403, 'Only an active Super Admin can manage the standard LWF rates.');
}

/** GET /admin/lwf-master */
export async function master(req: Request, res: Response) {
  await assertPersistedSuperAdmin(req.user!.id);
  const row = await prisma.lwfMasterSetting.findUnique({ where: { scopeKey: 'STANDARD' } });
  return res.json({ setting: snakeKeys(row) });
}

/** GET /admin/lwf-effective/:employer -- preview the policy that will apply to an employer. */
export async function adminEffective(req: Request, res: Response) {
  const employer = await prisma.user.findUnique({ where: { id: req.params.employer }, select: { role: true } });
  if (!employer || employer.role !== 'employer') throw new HttpError(404, 'Employer account not found.');
  return res.json({ effective: snakeKeys(await resolveEffectiveLwfSetting(prisma, req.params.employer)) });
}

/** POST /admin/lwf-master -- create or replace the platform standard. */
export async function saveMaster(req: Request, res: Response) {
  await assertPersistedSuperAdmin(req.user!.id);
  const data = settingSchema.parse(req.body);
  const payload = {
    employeeAmount: new Prisma.Decimal(data.employee_amount),
    employerAmount: new Prisma.Decimal(data.employer_amount),
    status: data.status,
    notes: data.notes || null,
    updatedByUserId: req.user!.id,
  };
  const row = await prisma.lwfMasterSetting.upsert({
    where: { scopeKey: 'STANDARD' },
    create: { scopeKey: 'STANDARD', ...payload, createdByUserId: req.user!.id },
    update: payload,
  });
  return res.json({ setting: snakeKeys(row) });
}

/** GET /employer/lwf-setting */
export async function employerSetting(req: Request, res: Response) {
  const [masterRow, override, effective] = await Promise.all([
    prisma.lwfMasterSetting.findUnique({ where: { scopeKey: 'STANDARD' } }),
    prisma.employerLwfSetting.findUnique({ where: { employerUserId: req.user!.id } }),
    resolveEffectiveLwfSetting(prisma, req.user!.id),
  ]);
  return res.json({
    master: snakeKeys(masterRow),
    override: snakeKeys(override),
    effective: snakeKeys(effective),
  });
}

/** POST /employer/lwf-setting -- employer-only override of the platform standard. */
export async function saveEmployerSetting(req: Request, res: Response) {
  const masterRow = await prisma.lwfMasterSetting.findUnique({ where: { scopeKey: 'STANDARD' }, select: { id: true } });
  if (!masterRow) throw new HttpError(422, 'The Super Admin must configure the standard LWF rates before an employer can create an override.');
  const data = settingSchema.parse(req.body);
  const payload = {
    employeeAmount: new Prisma.Decimal(data.employee_amount),
    employerAmount: new Prisma.Decimal(data.employer_amount),
    status: data.status,
    notes: data.notes || null,
  };
  const row = await prisma.employerLwfSetting.upsert({
    where: { employerUserId: req.user!.id },
    create: { employerUserId: req.user!.id, ...payload },
    update: payload,
  });
  return res.json({ override: snakeKeys(row) });
}

/** DELETE /employer/lwf-setting -- revert to the Super Admin standard. */
export async function resetEmployerSetting(req: Request, res: Response) {
  await prisma.employerLwfSetting.deleteMany({ where: { employerUserId: req.user!.id } });
  return res.json({ message: 'Employer LWF override removed. The Super Admin standard now applies.' });
}
