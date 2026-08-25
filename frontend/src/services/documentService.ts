import { apiClient } from '../lib/apiClient';

export async function listCompanyDocuments(companyId: string) {
  const { data } = await apiClient.get(`/employer/companies/${companyId}/documents`);
  return data ?? [];
}

export async function createDocumentRecord(companyId: string, documentType: string, file: File) {
  const formData = new FormData();
  formData.append('document_type', documentType);
  formData.append('file', file);
  const { data } = await apiClient.post(`/employer/companies/${companyId}/documents`, formData);
  return data;
}

export async function updateDocumentRecord(companyId: string, documentId: string, documentType: string) {
  const { data } = await apiClient.patch(`/employer/companies/${companyId}/documents/${documentId}`, { document_type: documentType });
  return data;
}

export async function deleteDocumentRecord(companyId: string, documentId: string) {
  await apiClient.delete(`/employer/companies/${companyId}/documents/${documentId}`);
}
