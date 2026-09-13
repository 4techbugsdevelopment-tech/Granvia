import { apiClient } from '../lib/apiClient';

export interface AssociateTypeOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export async function listActiveAssociateTypes(): Promise<AssociateTypeOption[]> {
  const { data } = await apiClient.get('/associate-types');
  return data;
}

export async function listAllAssociateTypes(): Promise<AssociateTypeOption[]> {
  const { data } = await apiClient.get('/admin/associate-types');
  return data;
}

export async function createAssociateType(input: { name: string; description?: string; status?: 'active' | 'inactive' }) {
  const { data } = await apiClient.post('/admin/associate-types', input);
  return data as AssociateTypeOption;
}

export async function updateAssociateType(
  associateTypeId: string,
  input: Partial<{ name: string; description: string | null; status: 'active' | 'inactive' }>
) {
  const { data } = await apiClient.patch(`/admin/associate-types/${associateTypeId}`, input);
  return data as AssociateTypeOption;
}

export async function deleteAssociateType(associateTypeId: string) {
  const { data } = await apiClient.delete(`/admin/associate-types/${associateTypeId}`);
  return data as { message: string };
}
