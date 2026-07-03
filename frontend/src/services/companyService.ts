import { apiClient } from '../lib/apiClient';

export type CompanyInput = {
  company_name: string;
  business_type?: string;
  registration_type?: string;
  gst_number?: string;
  pan_number?: string;
  company_email?: string;
  company_phone?: string;
  website?: string;
  description?: string;
  registered_address?: string;
  billing_address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export async function listMyCompanies() {
  const { data } = await apiClient.get('/employer/companies');
  return data;
}

export async function createCompany(input: CompanyInput) {
  const { data } = await apiClient.post('/employer/companies', input);
  return data;
}

export async function updateCompany(companyId: string, input: Partial<CompanyInput> & { account_status?: string }) {
  const { data } = await apiClient.patch(`/employer/companies/${companyId}`, input);
  return data;
}

export async function uploadCompanyLogo(companyId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post(`/employer/companies/${companyId}/logo`, formData);
  return data;
}
