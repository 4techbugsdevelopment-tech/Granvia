import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/http';
import { requireRole } from '../middleware/role';
import { employerReport, employerReportOptions, REPORT_KINDS } from '../reporting/employerReports';
import { financialReport, financialReportOptions, EMPLOYER_FINANCIAL_KINDS } from '../reporting/financialReports';

/** Mounted behind the existing /employer authentication guard. Injectable for API tests. */
export function createEmployerReportRouter(db: PrismaClient) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(requireRole('employer'));
  router.get('/financial-options', asyncHandler(async (req, res) => res.json(await db.$transaction(tx => financialReportOptions(tx, req.user ?? undefined, 'employer', req.query), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }))));
  for (const kind of EMPLOYER_FINANCIAL_KINDS) for (const exporting of [false, true]) router.get(`/${kind}${exporting ? '/export' : ''}`, asyncHandler(async (req, res) => {
    const result = await db.$transaction(tx => financialReport(tx, req.user ?? undefined, 'employer', kind, req.query, exporting), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    if ('csv' in result) { res.setHeader('Content-Disposition', `attachment; filename="${kind}.csv"`); return res.type('text/csv; charset=utf-8').send(result.csv); }
    return res.json(result);
  }));
  router.get('/options', asyncHandler(async (req, res) => {
    const result = await db.$transaction(tx => employerReportOptions(tx, req.user ?? undefined, req.query), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(result);
  }));
  for (const kind of REPORT_KINDS) {
    for (const exporting of [false, true]) {
      router.get(`/${kind}${exporting ? '/export' : ''}`, asyncHandler(async (req, res) => {
        const result = await db.$transaction(tx => employerReport(tx, req.user ?? undefined, kind, req.query, exporting), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000,
        });
        res.setHeader('Cache-Control', 'no-store');
        if ('csv' in result) {
          res.setHeader('Content-Disposition', `attachment; filename="${kind}.csv"`);
          return res.type('text/csv; charset=utf-8').send(result.csv);
        }
        return res.json(result);
      }));
    }
  }
  return router;
}
