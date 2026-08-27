import crypto from 'crypto';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { syncAssociateWallet } from '../services/associateWalletService';

const requestSchema = z.object({ amount: z.coerce.number().positive().max(1_000_000) });
const decisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve'), remarks: z.string().max(2000).nullish() }),
  z.object({ decision: z.literal('reject'), reason: z.string().trim().min(3).max(2000) }),
]);

async function notifyRole(role: string, title: string, message: string) {
  const users = await prisma.user.findMany({ where: { role, accountStatus: 'active' }, select: { id: true } });
  if (users.length) {
    await prisma.notification.createMany({
      data: users.map((user) => ({ userId: user.id, title, message, type: 'withdrawal' })),
    });
  }
}

export async function mine(req: Request, res: Response) {
  const rows = await prisma.withdrawalRequest.findMany({
    where: { guardUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(snakeKeys(rows));
}

export async function requestWithdrawal(req: Request, res: Response) {
  const { amount } = requestSchema.parse(req.body);
  const profile = await prisma.guardProfile.findUnique({ where: { userId: req.user!.id } });
  if (!profile?.bankAccountNumber || !profile.bankIfsc) {
    throw new HttpError(422, 'Add a valid bank account number and IFSC before requesting a withdrawal.');
  }

  await syncAssociateWallet(req.user!.id);
  const id = crypto.randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    const wallet = await tx.associateWallet.findUnique({ where: { guardUserId: req.user!.id } });
    if (!wallet || Number(wallet.availableBalance) < amount) {
      throw new HttpError(422, 'Insufficient available wallet balance.');
    }

    const request = await tx.withdrawalRequest.create({
      data: {
        id,
        guardUserId: req.user!.id,
        walletId: wallet.id,
        amount,
        netAmount: amount,
        idempotencyKey: `withdrawal:${id}`,
      },
    });
    await tx.associateWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { decrement: amount },
        reservedBalance: { increment: amount },
      },
    });
    await tx.associateWalletTransaction.create({
      data: {
        walletId: wallet.id,
        transactionType: 'reserve',
        amount,
        purpose: 'Withdrawal requested',
        referenceType: 'withdrawal_reserve',
        referenceId: request.id,
      },
    });
    return request;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await notifyRole('finance', 'New withdrawal request', `A withdrawal request for ₹${amount.toFixed(2)} requires review.`);
  return res.status(201).json(snakeKeys(created));
}

export async function financeIndex(req: Request, res: Response) {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const rows = await prisma.withdrawalRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  const guardIds = [...new Set(rows.map((row) => row.guardUserId))];
  const guards = guardIds.length
    ? await prisma.user.findMany({
        where: { id: { in: guardIds }, role: 'guard' },
        include: { guardProfile: true },
      })
    : [];
  const byId = new Map(guards.map((guard) => [guard.id, guard]));
  return res.json(rows.map((row) => ({
    ...snakeKeys(row),
    associate: byId.get(row.guardUserId)
      ? {
          id: row.guardUserId,
          full_name: byId.get(row.guardUserId)!.fullName,
          email: byId.get(row.guardUserId)!.email,
          mobile: byId.get(row.guardUserId)!.mobile,
          bank_name: byId.get(row.guardUserId)!.guardProfile?.bankName,
          bank_account_number: byId.get(row.guardUserId)!.guardProfile?.bankAccountNumber,
          bank_ifsc: byId.get(row.guardUserId)!.guardProfile?.bankIfsc,
        }
      : null,
  })));
}

export async function decide(req: Request, res: Response) {
  const data = decisionSchema.parse(req.body);
  const existing = await prisma.withdrawalRequest.findUnique({ where: { id: req.params.withdrawal } });
  if (!existing) throw new HttpError(404, 'Withdrawal request not found.');
  if (existing.status !== 'requested') throw new HttpError(409, 'This withdrawal request has already been decided.');

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.withdrawalRequest.findUnique({ where: { id: existing.id } });
    if (!current || current.status !== 'requested') throw new HttpError(409, 'This withdrawal request has already been decided.');

    if (data.decision === 'reject') {
      await tx.associateWallet.update({
        where: { id: current.walletId },
        data: {
          availableBalance: { increment: current.amount },
          reservedBalance: { decrement: current.amount },
        },
      });
      await tx.associateWalletTransaction.create({
        data: {
          walletId: current.walletId,
          transactionType: 'release',
          amount: current.amount,
          purpose: `Withdrawal rejected: ${data.reason}`,
          referenceType: 'withdrawal_release',
          referenceId: current.id,
        },
      });
      return tx.withdrawalRequest.update({
        where: { id: current.id },
        data: {
          status: 'rejected',
          rejectionReason: data.reason,
          reviewedByUserId: req.user!.id,
          reviewedAt: new Date(),
        },
      });
    }

    return tx.withdrawalRequest.update({
      where: { id: current.id },
      data: {
        status: 'approved',
        reviewedByUserId: req.user!.id,
        reviewedAt: new Date(),
        gatewayProvider: process.env.PAYOUT_PROVIDER?.trim() || 'manual',
        gatewayStatus: 'queued',
        gatewayResponse: data.remarks ? JSON.stringify({ finance_remarks: data.remarks }) : null,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await prisma.notification.create({
    data: {
      userId: updated.guardUserId,
      title: updated.status === 'approved' ? 'Withdrawal approved' : 'Withdrawal rejected',
      message: updated.status === 'approved'
        ? 'Finance approved your withdrawal. Bank payout is queued.'
        : `Finance rejected your withdrawal: ${updated.rejectionReason}`,
      type: 'withdrawal',
    },
  });
  return res.json(snakeKeys(updated));
}

const completeSchema = z.object({ gateway_reference: z.string().trim().min(3).max(255) });

export async function complete(req: Request, res: Response) {
  const data = completeSchema.parse(req.body);
  const existing = await prisma.withdrawalRequest.findUnique({ where: { id: req.params.withdrawal } });
  if (!existing) throw new HttpError(404, 'Withdrawal request not found.');
  if (existing.status !== 'approved' && existing.status !== 'processing') {
    throw new HttpError(409, 'Only an approved or processing withdrawal can be completed.');
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.associateWallet.update({
      where: { id: existing.walletId },
      data: { reservedBalance: { decrement: existing.amount } },
    });
    await tx.associateWalletTransaction.create({
      data: {
        walletId: existing.walletId,
        transactionType: 'debit',
        amount: existing.amount,
        purpose: 'Withdrawal paid to bank',
        referenceType: 'withdrawal_paid',
        referenceId: existing.id,
      },
    });
    return tx.withdrawalRequest.update({
      where: { id: existing.id },
      data: {
        status: 'completed',
        gatewayStatus: 'completed',
        gatewayReference: data.gateway_reference,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await prisma.notification.create({
    data: { userId: updated.guardUserId, title: 'Withdrawal completed', message: 'Your bank payout is complete.', type: 'withdrawal' },
  });
  return res.json(snakeKeys(updated));
}
