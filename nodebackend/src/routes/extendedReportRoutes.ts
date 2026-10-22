import { Router } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { requireRole } from '../middleware/role';
import { asyncHandler, HttpError } from '../utils/http';
import { EXTENDED_REPORTS, extendedReport, extendedReportDefinitions, extendedReportOptions, type ReportingRole } from '../reporting/extendedReports';

/** Mount only behind the existing portal authentication guard. */
export function createExtendedReportRouter(db: PrismaClient, role: ReportingRole) {
  const router = Router();
  router.use(requireRole(role));
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/', (_req, res) => res.json({ reports: extendedReportDefinitions(role) }));
  router.get('/options', asyncHandler(async (req, res) => res.json(await db.$transaction(tx => extendedReportOptions(tx, req.user ?? undefined, role, req.query), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }))));
  for (const definition of EXTENDED_REPORTS[role]) for (const exporting of [false, true]) {
    router.get(`/${definition.kind}${exporting ? '/export' : ''}`, asyncHandler(async (req, res) => {
      try {
        const result = await db.$transaction(tx => extendedReport(tx, req.user ?? undefined, role, definition.kind, req.query, exporting), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
        if ('csv' in result) {
          res.setHeader('Content-Disposition', `attachment; filename="${definition.kind}.csv"`);
          return res.type('text/csv; charset=utf-8').send(result.csv);
        }
        return res.json(result);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2021', 'P2022'].includes(error.code)) throw new HttpError(503, 'This report is unavailable because a required database update is missing.');
        throw error;
      }
    }));
  }
  return router;
}
