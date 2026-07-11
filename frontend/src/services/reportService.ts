import { apiClient } from '../lib/apiClient';

export async function getEmployerReportCounts(companyId?: string) {
  const { data } = await apiClient.get('/employer/reports/counts', { params: { company_id: companyId } });
  return data;
}

export type AdminReportCounts = {
  guards: number;
  employers: number;
  jobs: number;
  active_jobs: number;
  pending_jobs: number;
  applications: number;
  attendance_today: number;
  payments: number;
};

export async function getAdminReportCounts(): Promise<AdminReportCounts> {
  const { data } = await apiClient.get('/admin/reports/counts');
  return data;
}
