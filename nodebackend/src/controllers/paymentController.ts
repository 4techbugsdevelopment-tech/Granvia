import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { snakeKeys, toPrismaData } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';
import { HttpError } from '../utils/http';
import { issueOtp, verifyOtp } from '../services/otpService';

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

// --- cash payment OTP confirmation ----------------------------------------

async function loadOwnedPayment(paymentId: string, employerId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new HttpError(404, 'Not found.');
  if (payment.employerUserId !== employerId) throw new HttpError(403, 'Forbidden.');
  return payment;
}

/** POST /employer/payments/:payment/request-otp — email a cash-payment code to the guard. */
export async function requestCashOtp(req: Request, res: Response) {
  const payment = await loadOwnedPayment(req.params.payment, req.user!.id);
  if (payment.paymentStatus === 'completed') {
    throw new HttpError(422, 'This payment is already completed.');
  }
  if (!payment.guardUserId) {
    throw new HttpError(422, 'This payment has no associated guard.');
  }

  const guard = await prisma.user.findUnique({ where: { id: payment.guardUserId } });
  if (!guard) throw new HttpError(422, 'Guard account not found.');

  const otp = await issueOtp({
    email: guard.email,
    purpose: 'cash_payment',
    userId: guard.id,
    referenceId: payment.id,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { paymentMethod: payment.paymentMethod ?? 'cash', paymentStatus: 'otp_sent' },
  });

  return res.json({ sent_to: guard.email, payment_id: payment.id, ...(otp.dev_otp ? { dev_otp: otp.dev_otp } : {}) });
}

/** POST /employer/payments/:payment/confirm-otp — verify the guard's code and mark paid. */
export async function confirmCashOtp(req: Request, res: Response) {
  const { otp } = z.object({ otp: z.string().min(4) }).parse(req.body);
  const payment = await loadOwnedPayment(req.params.payment, req.user!.id);

  const guard = payment.guardUserId ? await prisma.user.findUnique({ where: { id: payment.guardUserId } }) : null;
  if (!guard) throw new HttpError(422, 'Guard account not found.');

  await verifyOtp({ email: guard.email, purpose: 'cash_payment', otp, referenceId: payment.id });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { paymentStatus: 'completed', paymentDate: new Date() },
  });

  return res.json(snakeKeys(updated));
}
