import { apiClient } from '../lib/apiClient';

export type OperationsDashboard = {
  assigned_scopes: number;
  total_applications: number;
  new_applications: number;
  interviews: number;
  onboarding: number;
};

export async function getOperationsDashboard() {
  const { data } = await apiClient.get('/operations/dashboard');
  return data as OperationsDashboard;
}

export async function listOperationsApplications(status?: string) {
  const { data } = await apiClient.get('/operations/applications', { params: { status } });
  return (data ?? []) as any[];
}

export async function updateOperationsApplication(id: string, status: string, remarks?: string, expectedUpdatedAt?: string) {
  const { data } = await apiClient.patch(`/operations/applications/${id}/status`, {
    status,
    remarks,
    expected_updated_at: expectedUpdatedAt,
  });
  return data;
}
