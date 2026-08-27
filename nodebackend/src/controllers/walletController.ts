import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { snakeKeys } from '../utils/serialize';
import { syncAssociateWallet } from '../services/associateWalletService';

// Port of App\Http\Controllers\WalletController.

/** GET /employer/wallet */
export async function show(req: Request, res: Response) {
  const employerUserId = req.user!.id;
  // firstOrCreate
  let wallet = await prisma.employerWallet.findUnique({ where: { employerUserId } });
  if (!wallet) {
    wallet = await prisma.employerWallet.create({
      data: { employerUserId, balance: 0, currency: 'INR', status: 'active' },
    });
  }
  return res.json(snakeKeys(wallet));
}

/** GET /employer/wallet/transactions */
export async function transactions(req: Request, res: Response) {
  const rows = await prisma.walletTransaction.findMany({
    where: { employerUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(snakeKeys(rows));
}

/** GET /guard/wallet — associate earnings balance from completed payments. */
export async function guardShow(req: Request, res: Response) {
  const wallet = await syncAssociateWallet(req.user!.id);
  const available = Number(wallet.availableBalance);
  return res.json({
    balance_coins: available,
    balance_inr: available,
    reserved_balance_inr: Number(wallet.reservedBalance),
    coin_value_inr: 1,
  });
}

/** GET /guard/wallet/transactions — completed payouts with job and attendance work details. */
export async function guardTransactions(req: Request, res: Response) {
  const payments = await prisma.payment.findMany({
    where: { guardUserId: req.user!.id, paymentStatus: 'completed' },
    include: {
      job: {
        include: {
          company: { select: { id: true, companyName: true } },
          site: { select: { id: true, siteName: true, address: true, city: true, state: true, pincode: true } },
        },
      },
    },
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });

  const jobIds = [...new Set(payments.map(payment => payment.jobId).filter(Boolean))] as string[];
  const attendance = jobIds.length
    ? await prisma.attendanceRecord.findMany({
        where: {
          guardUserId: req.user!.id,
          jobId: { in: jobIds },
          status: { in: ['approved', 'verified'] },
          outTime: { not: null },
        },
        orderBy: { attendanceDate: 'desc' },
        take: 500,
      })
    : [];

  const sessionsByJob = new Map<string, typeof attendance>();
  for (const session of attendance) {
    if (!session.jobId) continue;
    const sessions = sessionsByJob.get(session.jobId) ?? [];
    sessions.push(session);
    sessionsByJob.set(session.jobId, sessions);
  }

  const rows = payments.map(payment => {
    const sessions = payment.jobId ? (sessionsByJob.get(payment.jobId) ?? []).slice(0, 31) : [];
    const totalHours = Math.round(sessions.reduce((sum, session) => sum + Number(session.totalHours ?? 0), 0) * 100) / 100;
    const job = payment.job;
    return {
      id: payment.id,
      type: 'credit',
      amount: Number(payment.amount),
      purpose: job ? `Shift payout — ${job.title}` : 'Work payout',
      status: payment.paymentStatus,
      posted_at: payment.paymentDate ?? payment.createdAt,
      payment_method: payment.paymentMethod,
      reference: `PAY-${payment.id.slice(0, 8).toUpperCase()}`,
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
