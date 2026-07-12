import { Request, Response } from 'express';
import { prisma } from '../prisma';

// Port of App\Http\Controllers\ReportController.

/** GET /employer/reports/counts */
export async function counts(req: Request, res: Response) {
  const employerUserId = req.user!.id;
  const companyId = req.query.company_id as string | undefined;
  const withCompany = companyId ? { companyId } : {};

  const [jobs, applications, attendance, payments] = await Promise.all([
    prisma.jobPost.count({ where: { employerUserId, ...withCompany } }),
    prisma.jobApplication.count({ where: { employerUserId, ...withCompany } }),
    prisma.attendanceRecord.count({ where: { employerUserId, ...withCompany } }),
    prisma.payment.count({
      where: { employerUserId, ...(companyId ? { job: { companyId } } : {}) },
    }),
  ]);

  return res.json({ jobs, applications, attendance, payments });
}

/** GET /admin/reports/counts (shared with admin routes). */
export async function adminCounts(_req: Request, res: Response) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = new Date(`${todayIso}T00:00:00.000Z`);

  const [guards, employers, jobs, activeJobs, pendingJobs, applications, attendanceToday, payments] =
    await Promise.all([
      prisma.user.count({ where: { role: 'guard' } }),
      prisma.user.count({ where: { role: 'employer' } }),
      prisma.jobPost.count(),
      prisma.jobPost.count({ where: { status: 'active' } }),
      prisma.jobPost.count({ where: { status: 'pending_approval' } }),
      prisma.jobApplication.count(),
      prisma.attendanceRecord.count({ where: { attendanceDate: today } }),
      prisma.payment.count(),
    ]);

  return res.json({
    guards,
    employers,
    jobs,
    active_jobs: activeJobs,
    pending_jobs: pendingJobs,
    applications,
    attendance_today: attendanceToday,
    payments,
  });
}
