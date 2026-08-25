import { apiClient } from '../lib/apiClient';

export async function listCompanySites(companyId: string) {
  const { data } = await apiClient.get(`/employer/companies/${companyId}/sites`);
  return data;
}

export async function createCompanySite(input: Record<string, unknown> & { company_id: string; site_name: string }) {
  const { data } = await apiClient.post('/employer/sites', input);
  return data;
}

export async function updateCompanySite(siteId: string, updates: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/employer/sites/${siteId}`, updates);
  return data;
}

export async function deleteCompanySite(siteId: string) {
  const { data } = await apiClient.delete(`/employer/sites/${siteId}`);
  return data;
}
