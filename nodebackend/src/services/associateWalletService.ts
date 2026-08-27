import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

/**
 * Imports legacy completed Payment rows into the Associate ledger exactly once.
 * Serializable isolation prevents two simultaneous wallet reads from crediting
 * the same legacy payment twice.
 */
export async function syncAssociateWallet(guardUserId: string) {
  return prisma.$transaction(async (tx) => {
    let wallet = await tx.associateWallet.upsert({
      where: { guardUserId },
      create: { guardUserId },
      update: {},
    });

    const payments = await tx.payment.findMany({
      where: { guardUserId, paymentStatus: 'completed' },
      select: { id: true, amount: true, jobId: true },
    });
    const paymentIds = payments.map((payment) => payment.id);
    const imported = paymentIds.length
      ? await tx.associateWalletTransaction.findMany({
          where: { referenceType: 'payment', referenceId: { in: paymentIds } },
          select: { referenceId: true },
        })
      : [];
    const importedIds = new Set(imported.map((row) => row.referenceId));
    const missing = payments.filter((payment) => !importedIds.has(payment.id));

    if (missing.length) {
      const credit = missing.reduce((sum, payment) => sum + Number(payment.amount), 0);
      await tx.associateWalletTransaction.createMany({
        data: missing.map((payment) => ({
          walletId: wallet.id,
          transactionType: 'credit',
          amount: payment.amount,
          purpose: 'Completed shift payment',
          referenceType: 'payment',
          referenceId: payment.id,
        })),
      });
      wallet = await tx.associateWallet.update({
        where: { id: wallet.id },
        data: { availableBalance: { increment: credit } },
      });
    }

    return wallet;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
