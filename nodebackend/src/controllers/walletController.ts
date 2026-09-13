import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { snakeKeys } from '../utils/serialize';
import { syncAssociateWallet } from '../services/associateWalletService';
import { HttpError } from '../utils/http';

type WalletTx = Prisma.TransactionClient | typeof prisma;

const amountSchema = z.object({
  amount: z.coerce.number().positive().max(10000000),
  remarks: z.string().trim().max(500).optional(),
});

async function ensureEmployerWallet(db: WalletTx, employerUserId: string) {
  const wallet = await db.employerWallet.findUnique({ where: { employerUserId } });
  if (wallet) return wallet;
  return db.employerWallet.create({
    data: {
      employerUserId,
      balance: 0,
      depositBalance: 0,
      creditBalance: 0,
      totalRecharged: 0,
      totalCredited: 0,
      totalDebited: 0,
      currency: 'INR',
      status: 'active',
    } as never,
  });
}

function walletSummary(wallet: Record<string, unknown>) {
  return {
    ...snakeKeys(wallet),
    balance: Number(wallet.balance ?? 0),
    deposit_balance: Number(wallet.depositBalance ?? 0),
    credit_balance: Number(wallet.creditBalance ?? 0),
    total_recharged: Number(wallet.totalRecharged ?? 0),
    total_credited: Number(wallet.totalCredited ?? 0),
    total_debited: Number(wallet.totalDebited ?? 0),
  };
}

export async function debitEmployerWalletForPayment(
  db: Prisma.TransactionClient,
  input: {
    employerUserId: string;
    amount: number;
    paymentId: string;
    jobId?: string | null;
    guardUserId?: string | null;
    purpose: string;
    metadata?: Record<string, unknown>;
  },
) {
  const wallet = await ensureEmployerWallet(db, input.employerUserId);
  const amount = input.amount;
  const balance = Number(wallet.balance);
  if (balance < amount) {
    throw new HttpError(422, 'Insufficient employer wallet balance. Please recharge the wallet or request Super Admin credit.');
  }

  const depositBefore = Number((wallet as never as { depositBalance: Prisma.Decimal }).depositBalance ?? 0);
  const depositDebit = Math.min(depositBefore, amount);
  const creditDebit = amount - depositDebit;
  const updated = await db.employerWallet.update({
    where: { id: wallet.id },
    data: {
      balance: { decrement: amount },
      depositBalance: { decrement: depositDebit },
      creditBalance: { decrement: creditDebit },
      totalDebited: { increment: amount },
    } as never,
  });

  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      employerUserId: input.employerUserId,
      transactionType: 'debit',
      amount,
      purpose: input.purpose,
      source: 'job_payment',
      referenceType: 'payment',
      referenceId: input.paymentId,
      jobId: input.jobId ?? null,
      guardUserId: input.guardUserId ?? null,
      balanceAfter: updated.balance,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      status: 'completed',
      postedAt: new Date(),
    } as never,
  });

  return updated;
}

export async function show(req: Request, res: Response) {
  const wallet = await ensureEmployerWallet(prisma, req.user!.id);
  return res.json(walletSummary(wallet as never as Record<string, unknown>));
}

export async function transactions(req: Request, res: Response) {
  const rows = await prisma.walletTransaction.findMany({
    where: { employerUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });
  return res.json(snakeKeys(rows));
}

export async function recharge(req: Request, res: Response) {
  const data = amountSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    const wallet = await ensureEmployerWallet(tx, req.user!.id);
    const updated = await tx.employerWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: data.amount },
        depositBalance: { increment: data.amount },
        totalRecharged: { increment: data.amount },
      } as never,
    });
    const txRow = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        employerUserId: req.user!.id,
        transactionType: 'credit',
        amount: data.amount,
        purpose: data.remarks || 'Mock payment gateway recharge',
        source: 'mock_gateway_recharge',
        referenceType: 'wallet_recharge',
        referenceId: wallet.id,
        balanceAfter: updated.balance,
        status: 'completed',
        postedAt: new Date(),
        metadata: JSON.stringify({ gateway: 'mock', mode: 'temporary' }),
      } as never,
    });
    return { wallet: updated, transaction: txRow };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return res.status(201).json({
    wallet: walletSummary(result.wallet as never as Record<string, unknown>),
    transaction: snakeKeys(result.transaction),
  });
}

export async function adminIndex(_req: Request, res: Response) {
  const [employers, wallets, transactions] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'employer' },
      select: { id: true, fullName: true, email: true, mobile: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.employerWallet.findMany({
      include: { user: { select: { id: true, fullName: true, email: true, mobile: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.walletTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
  ]);

  const walletsByEmployer = new Map(wallets.map((wallet) => [wallet.employerUserId, wallet]));
  const summaries = employers.map((employer) => {
    const wallet = walletsByEmployer.get(employer.id);
    if (wallet) {
      return {
        ...walletSummary(wallet as never as Record<string, unknown>),
        employer,
      };
    }
    return {
      id: `new-${employer.id}`,
      employer_user_id: employer.id,
      balance: 0,
      deposit_balance: 0,
      credit_balance: 0,
      total_recharged: 0,
      total_credited: 0,
      total_debited: 0,
      currency: 'INR',
      status: 'active',
      employer,
    };
  });

  const guardIds = [...new Set(transactions.map((tx) => tx.guardUserId).filter(Boolean))] as string[];
  const jobIds = [...new Set(transactions.map((tx) => tx.jobId).filter(Boolean))] as string[];
  const [guards, jobs] = await Promise.all([
    guardIds.length
      ? prisma.user.findMany({ where: { id: { in: guardIds } }, select: { id: true, fullName: true, email: true } })
      : Promise.resolve([]),
    jobIds.length
      ? prisma.jobPost.findMany({ where: { id: { in: jobIds } }, select: { id: true, title: true } })
      : Promise.resolve([]),
  ]);
  const guardsById = new Map(guards.map((guard) => [guard.id, guard]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  return res.json({
    totals: {
      balance: summaries.reduce((sum, wallet) => sum + wallet.balance, 0),
      deposit_balance: summaries.reduce((sum, wallet) => sum + wallet.deposit_balance, 0),
      credit_balance: summaries.reduce((sum, wallet) => sum + wallet.credit_balance, 0),
      total_recharged: summaries.reduce((sum, wallet) => sum + wallet.total_recharged, 0),
      total_credited: summaries.reduce((sum, wallet) => sum + wallet.total_credited, 0),
      total_debited: summaries.reduce((sum, wallet) => sum + wallet.total_debited, 0),
    },
    wallets: snakeKeys(summaries),
    transactions: snakeKeys(transactions.map((tx) => ({
      ...tx,
      associate: tx.guardUserId ? guardsById.get(tx.guardUserId) ?? null : null,
      job: tx.jobId ? jobsById.get(tx.jobId) ?? null : null,
    }))),
  });
}

export async function adminGrantCredit(req: Request, res: Response) {
  const data = amountSchema.parse(req.body);
  const employer = await prisma.user.findUnique({ where: { id: req.params.employer } });
  if (!employer || employer.role !== 'employer') throw new HttpError(404, 'Employer account not found.');

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await ensureEmployerWallet(tx, employer.id);
    const updated = await tx.employerWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: data.amount },
        creditBalance: { increment: data.amount },
        totalCredited: { increment: data.amount },
      } as never,
    });
    const txRow = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        employerUserId: employer.id,
        transactionType: 'credit',
        amount: data.amount,
        purpose: data.remarks || 'Super Admin credit',
        source: 'admin_credit',
        referenceType: 'admin_credit',
        referenceId: req.user!.id,
        balanceAfter: updated.balance,
        status: 'completed',
        postedAt: new Date(),
        metadata: JSON.stringify({ admin_user_id: req.user!.id }),
      } as never,
    });
    return { wallet: updated, transaction: txRow };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return res.status(201).json({
    wallet: walletSummary(result.wallet as never as Record<string, unknown>),
    transaction: snakeKeys(result.transaction),
  });
}

export async function guardShow(req: Request, res: Response) {
  const wallet = await syncAssociateWallet(req.user!.id);
  const available = Number(wallet.availableBalance);
  const reserved = Number(wallet.reservedBalance);
  return res.json({
    balance_coins: available,
    balance_inr: available,
    processing_balance_inr: reserved,
    reserved_balance_inr: reserved,
    total_balance_inr: available + reserved,
    coin_value_inr: 1,
  });
}

export async function guardTransactions(req: Request, res: Response) {
  const wallet = await syncAssociateWallet(req.user!.id);
  const ledger = await prisma.associateWalletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const paymentIds = [...new Set(ledger
    .filter((row) => row.referenceType === 'payment' && row.referenceId)
    .map((row) => row.referenceId!))];

  const payments = paymentIds.length
    ? await prisma.payment.findMany({
        where: { id: { in: paymentIds }, guardUserId: req.user!.id },
        include: {
          job: {
            include: {
              company: { select: { id: true, companyName: true } },
              site: { select: { id: true, siteName: true, address: true, city: true, state: true, pincode: true } },
            },
          },
        },
      })
    : [];
  const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));

  const attendanceIds = [...new Set(payments.map(payment => payment.attendanceId).filter(Boolean))] as string[];
  const attendance = attendanceIds.length
    ? await prisma.attendanceRecord.findMany({
        where: {
          guardUserId: req.user!.id,
          id: { in: attendanceIds },
        },
        orderBy: { attendanceDate: 'desc' },
        take: 500,
      })
    : [];

  const sessionsByPayment = new Map<string, typeof attendance>();
  const attendanceById = new Map(attendance.map((session) => [session.id, session]));
  for (const payment of payments) {
    if (!payment.attendanceId) continue;
    const session = attendanceById.get(payment.attendanceId);
    if (session) sessionsByPayment.set(payment.id, [session]);
  }

  const sessionsByJob = new Map<string, typeof attendance>();
  for (const session of attendance) {
    if (!session.jobId) continue;
    const sessions = sessionsByJob.get(session.jobId) ?? [];
    sessions.push(session);
    sessionsByJob.set(session.jobId, sessions);
  }

  const rows = ledger.map(row => {
    const payment = row.referenceType === 'payment' && row.referenceId ? paymentsById.get(row.referenceId) : null;
    const sessions = payment
      ? (sessionsByPayment.get(payment.id) ?? (payment.jobId ? (sessionsByJob.get(payment.jobId) ?? []).slice(0, 31) : []))
      : [];
    const totalHours = Math.round(sessions.reduce((sum, session) => sum + Number(session.totalHours ?? 0), 0) * 100) / 100;
    const job = payment?.job;
    return {
      id: row.id,
      type: row.transactionType,
      amount: Number(row.amount),
      purpose: row.purpose ?? (job ? `Shift payout - ${job.title}` : 'Wallet transaction'),
      status: row.status,
      posted_at: row.createdAt,
      payment_status: payment?.paymentStatus ?? row.status,
      payment_method: payment?.paymentMethod,
      reference: payment ? `PAY-${payment.id.slice(0, 8).toUpperCase()}` : row.referenceId,
      job: job ? snakeKeys(job) : null,
      work_summary: {
        shift_count: sessions.length,
        total_hours: totalHours,
        first_date: sessions.length ? sessions[sessions.length - 1].attendanceDate.toISOString() : null,
        last_date: sessions.length ? sessions[0].attendanceDate.toISOString() : null,
      },
      work_sessions: snakeKeys(sessions),
    };
  });

  return res.json(rows);
}
