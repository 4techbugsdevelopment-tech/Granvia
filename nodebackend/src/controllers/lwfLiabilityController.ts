import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { storeFile, urlFor } from '../utils/fileStorage';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';

function employer(req: Request) {
  if (req.user!.role !== 'employer') throw new HttpError(403, 'Only an employer can manage LWF remittances.');
  return req.user!.id;
}

const liabilityInclude = { state: true, entries: { include: { payrollResult: { select: { id: true, guardUserId: true, runId: true } } }, orderBy: { createdAt: 'asc' as const } }, allocations: { include: { remittance: { select: { id: true, paymentReference: true, status: true, remittedAt: true } } } } };

export async function liabilities(req: Request, res: Response) {
  const employerUserId = employer(req);
  const rows = await prisma.lwfLiability.findMany({
    where: { employerUserId, ...(typeof req.query.state_id === 'string' ? { stateId: req.query.state_id } : {}), ...(typeof req.query.status === 'string' ? { status: req.query.status } : {}) },
    include: liabilityInclude, orderBy: [{ state: { name: 'asc' } }, { contributionPeriodKey: 'desc' }],
  });
  const totals = rows.reduce((acc, row) => ({ employee_total: acc.employee_total.add(row.employeeTotal), employer_total: acc.employer_total.add(row.employerTotal), total_payable: acc.total_payable.add(row.totalPayable), remitted_amount: acc.remitted_amount.add(row.remittedAmount), outstanding_amount: acc.outstanding_amount.add(row.outstandingAmount) }), { employee_total: new Prisma.Decimal(0), employer_total: new Prisma.Decimal(0), total_payable: new Prisma.Decimal(0), remitted_amount: new Prisma.Decimal(0), outstanding_amount: new Prisma.Decimal(0) });
  return res.json({ liabilities: snakeKeys(rows), totals: snakeKeys(totals) });
}

const money = z.union([z.string(), z.number()]).transform((raw, context) => {
  try { const value = new Prisma.Decimal(raw); if (!value.isFinite() || value.lessThanOrEqualTo(0)) throw new Error(); return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2); }
  catch { context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a positive amount.' }); return z.NEVER; }
});
const remittanceSchema = z.object({
  state_id: z.string().uuid(), amount: money, payment_reference: z.string().trim().min(3).max(255), challan_number: z.string().trim().max(255).nullish(),
  remitted_at: z.coerce.date(), notes: z.string().trim().max(1000).nullish(),
  allocations: z.array(z.object({ liability_id: z.string().uuid(), amount: money }).strict()).min(1).max(500),
}).strict();

export async function remittances(req: Request, res: Response) {
  const employerUserId = employer(req);
  const rows = await prisma.lwfRemittance.findMany({ where: { employerUserId, ...(typeof req.query.state_id === 'string' ? { stateId: req.query.state_id } : {}) }, include: { state: true, allocations: { include: { liability: true } }, attachments: true }, orderBy: { remittedAt: 'desc' } });
  return res.json(snakeKeys(rows.map(row => ({ ...row, attachments: row.attachments.map(file => ({ ...file, downloadUrl: urlFor('lwf-remittances', file.filePath) })) }))));
}

export async function createRemittance(req: Request, res: Response) {
  const employerUserId = employer(req);
  const data = remittanceSchema.parse(req.body);
  if (new Set(data.allocations.map(row => row.liability_id)).size !== data.allocations.length) throw new HttpError(422, 'Each liability may be allocated only once per remittance.');
  const allocationTotal = data.allocations.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
  if (!allocationTotal.equals(data.amount)) throw new HttpError(422, 'Allocation total must exactly equal the remittance amount.');
  const row = await prisma.$transaction(async tx => {
    const liabilities = await tx.lwfLiability.findMany({ where: { id: { in: data.allocations.map(item => item.liability_id) }, employerUserId, stateId: data.state_id } });
    if (liabilities.length !== data.allocations.length) throw new HttpError(422, 'Every allocation must belong to this employer and selected state.');
    for (const allocation of data.allocations) {
      const liability = liabilities.find(item => item.id === allocation.liability_id)!;
      if (new Prisma.Decimal(allocation.amount).greaterThan(liability.outstandingAmount)) throw new HttpError(422, `Allocation exceeds the outstanding balance for liability ${liability.id}.`);
    }
    const created = await tx.lwfRemittance.create({ data: { employerUserId, stateId: data.state_id, amount: data.amount, paymentReference: data.payment_reference, challanNumber: data.challan_number || null, remittedAt: data.remitted_at, notes: data.notes || null, createdByUserId: req.user!.id } });
    for (const allocation of data.allocations) {
      const liability = liabilities.find(item => item.id === allocation.liability_id)!;
      const allocated = new Prisma.Decimal(allocation.amount);
      const remitted = liability.remittedAmount.add(allocated).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const outstanding = liability.totalPayable.sub(remitted).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      await tx.lwfRemittanceAllocation.create({ data: { remittanceId: created.id, liabilityId: liability.id, amount: allocated } });
      await tx.lwfLiability.update({ where: { id: liability.id }, data: { remittedAmount: remitted, outstandingAmount: outstanding, status: outstanding.isZero() ? 'paid' : 'partially_paid' } });
    }
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
  return res.status(201).json(snakeKeys(row));
}

const voidSchema = z.object({ reason: z.string().trim().min(5).max(1000) }).strict();
export async function voidRemittance(req: Request, res: Response) {
  const employerUserId = employer(req);
  const data = voidSchema.parse(req.body);
  const row = await prisma.$transaction(async tx => {
    const remittance = await tx.lwfRemittance.findFirst({ where: { id: req.params.remittance, employerUserId }, include: { allocations: { include: { liability: true } } } });
    if (!remittance) throw new HttpError(404, 'Remittance not found.');
    if (remittance.status === 'void') throw new HttpError(409, 'This remittance is already void.');
    for (const allocation of remittance.allocations) {
      const remitted = allocation.liability.remittedAmount.sub(allocation.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const outstanding = allocation.liability.totalPayable.sub(remitted).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      await tx.lwfLiability.update({ where: { id: allocation.liabilityId }, data: { remittedAmount: remitted, outstandingAmount: outstanding, status: remitted.isZero() ? 'outstanding' : 'partially_paid' } });
    }
    return tx.lwfRemittance.update({ where: { id: remittance.id }, data: { status: 'void', voidedByUserId: req.user!.id, voidedAt: new Date(), voidReason: data.reason } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return res.json(snakeKeys(row));
}

export async function uploadReceipt(req: Request, res: Response) {
  const employerUserId = employer(req);
  const remittance = await prisma.lwfRemittance.findFirst({ where: { id: req.params.remittance, employerUserId } });
  if (!remittance) throw new HttpError(404, 'Remittance not found.');
  if (remittance.status === 'void') throw new HttpError(409, 'Cannot attach a receipt to a void remittance.');
  if (!req.file) throw new HttpError(422, 'Select a receipt file.');
  if (req.file.mimetype !== 'application/pdf' && !req.file.mimetype.startsWith('image/')) throw new HttpError(422, 'Receipt must be a PDF or image.');
  const stored = storeFile('lwf-remittances', remittance.id, req.file);
  const row = await prisma.lwfRemittanceAttachment.create({ data: { remittanceId: remittance.id, fileName: req.file.originalname, filePath: stored.path, mimeType: req.file.mimetype, fileSize: req.file.size, uploadedByUserId: req.user!.id } });
  return res.status(201).json(snakeKeys({ ...row, downloadUrl: urlFor('lwf-remittances', row.filePath) }));
}
