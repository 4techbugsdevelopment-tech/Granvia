import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/role';
import { asyncHandler, HttpError } from '../utils/http';
import { adminReport, adminReportOptions, ADMIN_REPORT_KINDS } from '../reporting/adminReports';
import { financialReport, financialReportOptions, ADMIN_FINANCIAL_KINDS } from '../reporting/financialReports';

export function createAdminReportRouter(db: PrismaClient) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(requireRole('super_admin'));
  router.get('/financial-options', asyncHandler(async (req, res) => res.json(await db.$transaction(tx => financialReportOptions(tx, req.user ?? undefined, 'super_admin', req.query), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }))));
  for (const kind of ADMIN_FINANCIAL_KINDS) for (const exporting of [false, true]) router.get(`/${kind}${exporting ? '/export' : ''}`, asyncHandler(async (req, res) => {
    const result = await db.$transaction(tx => financialReport(tx, req.user ?? undefined, 'super_admin', kind, req.query, exporting), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    if ('csv' in result) { res.setHeader('Content-Disposition', `attachment; filename="${kind}.csv"`); return res.type('text/csv; charset=utf-8').send(result.csv); }
    return res.json(result);
  }));
  router.get('/options', asyncHandler(async (req, res) => res.json(await db.$transaction(tx => adminReportOptions(tx, req.user ?? undefined, req.query), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }))));
  for (const kind of ADMIN_REPORT_KINDS) for (const exporting of [false, true]) router.get(`/${kind}${exporting ? '/export' : ''}`, asyncHandler(async (req, res) => {
    try {
      const result = await db.$transaction(tx => adminReport(tx, req.user ?? undefined, kind, req.query, exporting), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
      if ('csv' in result) { res.setHeader('Content-Disposition', `attachment; filename="${kind}.csv"`); return res.type('text/csv; charset=utf-8').send(result.csv); }
      return res.json(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2021', 'P2022'].includes(error.code)) throw new HttpError(503, 'This report is unavailable because a required database update is missing.');
      throw error;
    }
  }));
  return router;
}
