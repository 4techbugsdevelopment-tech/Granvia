import { apiClient } from '../lib/apiClient';

export interface SalesCounts {
  managed_clients: number;
  active_jobs: number;
  total_jobs: number;
  conversion_rate: number;
  active_discounts: number;
}

export interface SalesActivityItem {
  type: 'job' | 'application';
  title: string;
  subtitle: string | null;
  at: string;
}

export interface SalesClient {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  city: string | null;
  state: string | null;
  billing_status: string;
  base_hourly_rate: string | null;
  companies: number;
  sites: number;
  jobs: number;
}

export interface SalesClientDetail {
  client: { id: string; name: string; email: string; mobile: string | null; billing_status: string; base_hourly_rate: string | null };
  companies: Array<{ id: string; company_name: string; sites: Array<{ id: string; site_name: string | null }> }>;
  sites: Array<{ id: string; site_name: string | null; city: string | null }>;
  jobs: Array<{ id: string; title: string; status: string; company?: { company_name: string }; site?: { site_name: string | null } }>;
}

export interface SalesJob {
  id: string;
  employer_user_id: string;
  employer_name: string;
  title: string;
  guards_required: number;
  duty_hours: string | null;
  status: string;
  created_at: string;
  company?: { id: string; company_name: string } | null;
  site?: { id: string; site_name: string | null; city: string | null } | null;
}

export interface Discount {
  id: string;
  employer_user_id: string | null;
  label: string;
  discount_type: 'percentage' | 'flat';
  value: string;
  applies_to: string | null;
  status: 'Active' | 'Expired';
  employer?: { id: string; full_name: string } | null;
}

export interface ManpowerResult {
  radius_km: number | null;
  available_count: number;
  total_count: number;
  partners: Array<{
    id: string; name: string; city: string | null;
    latitude: number; longitude: number;
    skills: string[]; experience: string | null; distance_km: number | null;
  }>;
}

export async function getSalesCounts(): Promise<SalesCounts> {
  const { data } = await apiClient.get('/sales/reports/counts');
  return data;
}

export async function getSalesActivity(): Promise<SalesActivityItem[]> {
  const { data } = await apiClient.get('/sales/activity');
  return data;
}

export async function getSalesClients(): Promise<SalesClient[]> {
  const { data } = await apiClient.get('/sales/clients');
  return data;
}

export async function getSalesClientDetail(employerId: string): Promise<SalesClientDetail> {
  const { data } = await apiClient.get(`/sales/clients/${employerId}`);
  return data;
}

export async function requestJobOtp(employerUserId: string): Promise<{ otp_id: string; sent_to: string | null; dev_otp: string | null }> {
  const { data } = await apiClient.post('/sales/jobs/request-otp', { employer_user_id: employerUserId });
  return data;
}

export async function getSalesJobs(): Promise<SalesJob[]> {
  const { data } = await apiClient.get('/sales/jobs');
  return data ?? [];
}

export interface ProxyJobInput {
  otp_id: string;
  otp: string;
  employer_user_id: string;
  company_id: string;
  site_id?: string | null;
  title: string;
  duty_hours?: string;
  guards_required?: number;
  experience_required?: string;
  qualification_required?: string;
  language_requirements?: string[];
  salary_amount?: number;
  description?: string;
}

export async function postProxyJob(input: ProxyJobInput) {
  const { data } = await apiClient.post('/sales/jobs', input);
  return data;
}

export async function getDiscounts(): Promise<Discount[]> {
  const { data } = await apiClient.get('/sales/discounts');
  return data;
}

export async function createDiscount(input: {
  employer_user_id?: string | null; label: string; discount_type: 'percentage' | 'flat'; value: number; applies_to?: string; status?: string;
}): Promise<Discount> {
  const { data } = await apiClient.post('/sales/discounts', input);
  return data;
}

export async function updateDiscount(id: string, input: Partial<{ label: string; discount_type: 'percentage' | 'flat'; value: number; applies_to: string; status: string }>): Promise<Discount> {
  const { data } = await apiClient.patch(`/sales/discounts/${id}`, input);
  return data;
}

export async function deleteDiscount(id: string): Promise<void> {
  await apiClient.delete(`/sales/discounts/${id}`);
}

export async function getManpower(params: { lat?: number; lng?: number; radius?: number }): Promise<ManpowerResult> {
  const { data } = await apiClient.get('/sales/manpower', { params });
  return data;
}
