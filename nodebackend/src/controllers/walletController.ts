import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { snakeKeys } from '../utils/serialize';

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
