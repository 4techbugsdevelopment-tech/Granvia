import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { snakeKeys, toPrismaData } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';

// Port of App\Http\Controllers\PaymentController.

const createSchema = z.object({
  guard_user_id: z.string().uuid().nullish(),
  job_id: z.string().uuid().nullish(),
  application_id: z.string().uuid().nullish(),
  amount: z.coerce.number(),
  payment_method: z.string().nullish(),
  payment_status: z.string().nullish(),
  payment_date: z.coerce.date().nullish(),
});

/** GET /employer/payments */
export async function index(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const rows = await prisma.payment.findMany({
    where: {
      employerUserId: req.user!.id,
      ...(companyId ? { job: { companyId } } : {}),
    },
    include: { job: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const shaped = snakeKeys(rows) as Array<Record<string, unknown> & { guard_user_id?: string }>;
  return res.json(await attachGuardProfiles(shaped));
}

/** POST /employer/payments */
export async function store(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const created = await prisma.payment.create({
    data: {
      ...toPrismaData(data),
      employerUserId: req.user!.id,
      paymentStatus: data.payment_status ?? 'pending',
    } as never,
  });
  return res.status(201).json(snakeKeys(created));
}
