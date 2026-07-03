import { apiClient } from '../lib/apiClient';

export async function getEmployerReportCounts(companyId?: string) {
  const { data } = await apiClient.get('/employer/reports/counts', { params: { company_id: companyId } });
  return data;
}
