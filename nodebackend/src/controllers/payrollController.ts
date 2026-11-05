import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { createAdjustmentRun, approvePayrollRun, createPayrollPreview, finalizePayrollRun } from '../services/payrollService';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';

const dateOnly = z.coerce.date();
const periodSchema = z.object({ label: z.string().trim().min(2).max(120), period_start: dateOnly, period_end: dateOnly }).strict().superRefine((value, context) => {
  if (value.period_end < value.period_start) context.addIssue({ code: z.ZodIssueCode.custom, path: ['period_end'], message: 'Period end cannot be before period start.' });
});
const previewSchema = z.object({ period_id: z.string().uuid(), idempotency_key: z.string().trim().min(8).max(120), application_ids: z.array(z.string().uuid()).max(500).optional(), full_period_confirmed: z.literal(true) }).strict();
const reasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) }).strict();
const adjustmentSchema = z.object({
  idempotency_key: z.string().trim().min(8).max(120), reason: z.string().trim().min(5).max(1000),
  adjustments: z.array(z.object({ original_result_id: z.string().uuid(), lines: z.array(z.object({ code: z.string().trim().min(2).max(80).transform(value => value.toUpperCase()), name: z.string().trim().min(2).max(180), category: z.enum(['earning', 'deduction', 'employer_contribution']), amount: z.union([z.string(), z.number()]).transform((raw, context) => { try { return new Prisma.Decimal(raw).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2); } catch { context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid signed adjustment amount.' }); return z.NEVER; } }) }).strict()).min(1).max(50) }).strict()).min(1).max(500),
}).strict();

function actorEmployer(req: Request) {
  if (req.user!.role !== 'employer') throw new HttpError(403, 'Only an employer can manage payroll.');
  return req.user!.id;
}

const runInclude = { period: true, results: { include: { lines: { orderBy: [{ category: 'asc' as const }, { code: 'asc' as const }] }, payment: true } }, auditEvents: { orderBy: { createdAt: 'desc' as const } } };

export async function periods(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const rows = await prisma.payrollPeriod.findMany({ where: { employerUserId }, include: { runs: { select: { id: true, status: true, runType: true, createdAt: true } } }, orderBy: { periodStart: 'desc' } });
  return res.json(snakeKeys(rows));
}

export async function createPeriod(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const data = periodSchema.parse(req.body);
  const overlap = await prisma.payrollPeriod.findFirst({ where: { employerUserId, periodStart: { lte: data.period_end }, periodEnd: { gte: data.period_start } } });
  if (overlap) throw new HttpError(409, 'This payroll period overlaps an existing period.');
  const row = await prisma.payrollPeriod.create({ data: { employerUserId, label: data.label, periodStart: data.period_start, periodEnd: data.period_end, createdByUserId: req.user!.id } });
  return res.status(201).json(snakeKeys(row));
}

export async function runs(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const rows = await prisma.payrollRun.findMany({ where: { employerUserId, ...(typeof req.query.period_id === 'string' ? { periodId: req.query.period_id } : {}) }, include: runInclude, orderBy: { createdAt: 'desc' } });
  return res.json(snakeKeys(rows));
}

export async function showRun(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const row = await prisma.payrollRun.findFirst({ where: { id: req.params.run, employerUserId }, include: runInclude });
  if (!row) throw new HttpError(404, 'Payroll run not found.');
  return res.json(snakeKeys(row));
}

export async function preview(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const data = previewSchema.parse(req.body);
  const row = await prisma.$transaction(tx => createPayrollPreview(tx, { periodId: data.period_id, employerUserId, actorUserId: req.user!.id, idempotencyKey: data.idempotency_key, applicationIds: data.application_ids, fullPeriodConfirmed: data.full_period_confirmed }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
  return res.status(201).json(snakeKeys(row));
}

export async function approve(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const row = await prisma.$transaction(tx => approvePayrollRun(tx, req.params.run, employerUserId, req.user!.id), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return res.json(snakeKeys(row));
}

export async function finalize(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const row = await prisma.$transaction(tx => finalizePayrollRun(tx, req.params.run, employerUserId, req.user!.id), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
  return res.json(snakeKeys(row));
}

export async function correction(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const data = adjustmentSchema.parse(req.body);
  const row = await prisma.$transaction(tx => createAdjustmentRun(tx, { originalRunId: req.params.run, employerUserId, actorUserId: req.user!.id, idempotencyKey: data.idempotency_key, reason: data.reason, runType: 'correction', adjustments: data.adjustments.map(item => ({ originalResultId: item.original_result_id, lines: item.lines })) }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
  return res.status(201).json(snakeKeys(row));
}

export async function reversal(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const data = reasonSchema.extend({ idempotency_key: z.string().trim().min(8).max(120) }).parse(req.body);
  const row = await prisma.$transaction(tx => createAdjustmentRun(tx, { originalRunId: req.params.run, employerUserId, actorUserId: req.user!.id, idempotencyKey: data.idempotency_key, reason: data.reason, runType: 'reversal' }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
  return res.status(201).json(snakeKeys(row));
}

const payslipInclude = { run: { include: { period: true } }, lines: { orderBy: [{ category: 'asc' as const }, { code: 'asc' as const }] }, payment: true, job: { select: { id: true, title: true } } };
export async function payslips(req: Request, res: Response) {
  const guardUserId = req.user!.role === 'guard' ? req.user!.id : typeof req.query.guard_id === 'string' ? req.query.guard_id : undefined;
  const employerUserId = req.user!.role === 'employer' ? req.user!.id : undefined;
  if (!guardUserId && !employerUserId) throw new HttpError(403, 'Payslip scope is required.');
  const rows = await prisma.payrollResult.findMany({ where: { status: 'finalized', ...(guardUserId ? { guardUserId } : {}), ...(employerUserId ? { run: { employerUserId } } : {}) }, include: payslipInclude, orderBy: { createdAt: 'desc' } });
  return res.json(snakeKeys(rows));
}

export async function payslip(req: Request, res: Response) {
  const row = await prisma.payrollResult.findUnique({ where: { id: req.params.result }, include: payslipInclude });
  if (!row || row.status !== 'finalized') throw new HttpError(404, 'Finalized payslip not found.');
  const allowed = req.user!.role === 'guard' ? row.guardUserId === req.user!.id : req.user!.role === 'employer' ? row.run.employerUserId === req.user!.id : false;
  if (!allowed) throw new HttpError(403, 'Forbidden.');
  return res.json(snakeKeys(row));
}

const paymentCreateSchema = z.object({ idempotency_key: z.string().trim().min(8).max(120), payment_method: z.string().trim().max(80).nullish() }).strict();
export async function createPayment(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const data = paymentCreateSchema.parse(req.body);
  const result = await prisma.payrollResult.findFirst({ where: { id: req.params.result, status: 'finalized', run: { employerUserId } }, include: { payment: true } });
  if (!result) throw new HttpError(404, 'Finalized payroll result not found.');
  if (result.netPayable.isNegative()) throw new HttpError(422, 'A negative payroll correction cannot create a salary payment. Record recovery separately.');
  if (result.payment) return res.json(snakeKeys(result.payment));
  const row = await prisma.payrollPayment.create({ data: { payrollResultId: result.id, employerUserId, guardUserId: result.guardUserId, amount: result.netPayable, idempotencyKey: data.idempotency_key, paymentMethod: data.payment_method || null, createdByUserId: req.user!.id } });
  return res.status(201).json(snakeKeys(row));
}

const paymentStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('completed'), external_reference: z.string().trim().min(3).max(255), payment_method: z.string().trim().max(80).nullish() }).strict(),
  z.object({ status: z.literal('failed'), failure_reason: z.string().trim().min(3).max(1000) }).strict(),
  z.object({ status: z.literal('pending'), payment_method: z.string().trim().max(80).nullish() }).strict(),
  z.object({ status: z.literal('cancelled'), failure_reason: z.string().trim().min(3).max(1000) }).strict(),
]);
export async function updatePayment(req: Request, res: Response) {
  const employerUserId = actorEmployer(req);
  const data = paymentStatusSchema.parse(req.body);
  const payment = await prisma.payrollPayment.findFirst({ where: { id: req.params.payment, employerUserId } });
  if (!payment) throw new HttpError(404, 'Payroll payment not found.');
  if (payment.status === 'completed') throw new HttpError(409, 'A completed payroll payment is immutable.');
  const row = await prisma.payrollPayment.update({ where: { id: payment.id }, data: data.status === 'completed'
    ? { status: 'completed', externalReference: data.external_reference, paymentMethod: data.payment_method || payment.paymentMethod, failureReason: null, paidAt: new Date() }
    : data.status === 'failed' || data.status === 'cancelled'
      ? { status: data.status, failureReason: data.failure_reason }
      : { status: 'pending', paymentMethod: data.payment_method || payment.paymentMethod, failureReason: null, attemptCount: { increment: 1 } } });
  return res.json(snakeKeys(row));
}
