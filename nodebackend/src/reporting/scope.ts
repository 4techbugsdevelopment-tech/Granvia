import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../utils/http';

export type ReportActor = { id: string; role: string; accountStatus: string };
export type ReportScopeFilters = { employer_id?: string; company_id?: string; site_id?: string; job_id?: string };
type ScopeReader = Pick<PrismaClient, 'employerCompany' | 'companySite' | 'jobPost' | 'user'>;

export function assertReportRole(actor: ReportActor | null | undefined, role: 'employer' | 'super_admin') {
  if (!actor) throw new HttpError(401, 'Unauthenticated.');
  if (actor.role !== role || ['blocked', 'inactive'].includes(actor.accountStatus)) {
    throw new HttpError(403, 'Forbidden.');
  }
  return actor;
}

/** Only reads. Resolve parents so a job/site filter cannot bypass tenant ownership. */
export async function resolveReportScope(
  db: ScopeReader,
  actor: ReportActor | null | undefined,
  role: 'employer' | 'super_admin',
  filters: ReportScopeFilters,
  kind: 'operational' | 'wallet' = 'operational',
) {
  const user = assertReportRole(actor, role);
  if (role === 'employer' && filters.employer_id) {
    throw new HttpError(422, 'Employer scope comes from your signed-in account.');
  }
  if (kind === 'wallet' && (filters.company_id || filters.site_id || filters.job_id)) {
    throw new HttpError(422, 'Wallet balances are employer-account-wide. Use a movement report for job filters.');
  }
  let employerUserId = role === 'employer' ? user.id : filters.employer_id;
  let companyId = filters.company_id;
  let siteId = filters.site_id;
  const unavailable = () => new HttpError(404, 'Record not found in the report scope.');
  if (employerUserId && role === 'super_admin') {
    const employer = await db.user.findFirst({ where: { id: employerUserId, role: 'employer' }, select: { id: true } });
    if (!employer) throw unavailable();
  }
  if (filters.job_id) {
    const job = await db.jobPost.findUnique({ where: { id: filters.job_id }, select: { employerUserId: true, companyId: true, siteId: true } });
    if (!job || (employerUserId && employerUserId !== job.employerUserId)
      || (companyId && companyId !== job.companyId) || (siteId && siteId !== job.siteId)) throw unavailable();
    employerUserId = job.employerUserId;
    companyId = companyId ?? job.companyId ?? undefined;
    siteId = siteId ?? job.siteId ?? undefined;
  }
  if (siteId) {
    const site = await db.companySite.findUnique({ where: { id: siteId }, select: { companyId: true, employerUserId: true } });
    if (!site || (companyId && companyId !== site.companyId)
      || (employerUserId && site.employerUserId && employerUserId !== site.employerUserId)) throw unavailable();
    companyId = site.companyId;
    employerUserId = employerUserId ?? site.employerUserId ?? undefined;
    // Company owner below is authoritative when legacy site employer ID is null.
  }
  if (companyId) {
    const company = await db.employerCompany.findUnique({ where: { id: companyId }, select: { employerUserId: true } });
    if (!company || (employerUserId && employerUserId !== company.employerUserId)) throw unavailable();
    employerUserId = company.employerUserId;
  }
  return {
    ...(employerUserId ? { employerUserId } : {}),
    ...(companyId ? { companyId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(filters.job_id ? { jobId: filters.job_id } : {}),
  };
}
