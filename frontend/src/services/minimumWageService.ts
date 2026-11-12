import { apiClient } from '../lib/apiClient';
import type { SalaryStructureDraft } from './salaryStructureService';

export type MinimumWageStatus = 'VERIFIED' | 'REVIEW_REQUIRED' | 'NOT_AVAILABLE' | 'CONFLICT_DETECTED' | 'STALE_DATA' | 'INVALID_LOCATION' | 'INVALID_CLASSIFICATION';
export type MinimumWagePreviewInput = {
  state?: string; state_code?: string; district_code?: string; zone_code?: string;
  job_role_code?: string; employment_category_code?: string; occupation_code?: string; skill_category_code?: string;
  appropriate_government?: 'STATE' | 'CENTRAL'; effective_date: string; wage_unit: 'MONTHLY' | 'WEEKLY' | 'DAILY';
  salary_structure?: SalaryStructureDraft | null; payment_type?: 'Monthly' | 'Weekly' | 'Daily';
};
export type MinimumWagePreview = {
  status: MinimumWageStatus; reason: string; resolver_version: string;
  applicable_rate: null | { id: string; amount: string; currency: string; unit: string; basic: string; vda: string; other_mandatory_components: string; qualifying_component_codes: string[]; effective_from: string; effective_to: string | null };
  notification: null | { id: string; number: string; title: string; effective_from: string; source_url: string | null; last_verified_at: string | null };
  resolution: Record<string, any>;
  comparison: null | { compliance_status: 'COMPLIANT' | 'NON_COMPLIANT' | 'REVIEW_REQUIRED'; qualifying_wage: string | null; shortfall: string | null; components: Array<{ code: string; name: string; amount: string }>; reason?: string };
};

export const previewMinimumWage = async (scope: 'employer' | 'admin', input: MinimumWagePreviewInput, signal?: AbortSignal): Promise<MinimumWagePreview> => {
  const { data } = await apiClient.post(`/${scope}/minimum-wages/resolve`, input, { signal });
  return data;
};

export const listMinimumWageJurisdictions = async () => (await apiClient.get('/admin/minimum-wages/jurisdictions')).data;
export const listMinimumWageCoverage = async () => (await apiClient.get('/admin/minimum-wages/coverage')).data;
export const listMinimumWageNotifications = async () => (await apiClient.get('/admin/minimum-wages/notifications')).data;
export const listMinimumWageMappings = async () => (await apiClient.get('/admin/minimum-wages/mappings')).data;
export const listMinimumWageJobs = async () => (await apiClient.get('/admin/minimum-wages/jobs')).data;
export const listMinimumWageAudits = async () => (await apiClient.get('/admin/minimum-wages/audits')).data;
export const createMinimumWageNotification = async (input: Record<string, unknown>) => (await apiClient.post('/admin/minimum-wages/notifications', input)).data;
export const approveMinimumWageNotification = async (id: string) => (await apiClient.post(`/admin/minimum-wages/notifications/${id}/approve`)).data;
export const rejectMinimumWageNotification = async (id: string, reason: string) => (await apiClient.post(`/admin/minimum-wages/notifications/${id}/reject`, { reason })).data;
export const revokeMinimumWageNotification = async (id: string, reason: string) => (await apiClient.post(`/admin/minimum-wages/notifications/${id}/revoke`, { reason })).data;
export const createMinimumWageMapping = async (input: Record<string, unknown>) => (await apiClient.post('/admin/minimum-wages/mappings', input)).data;
export const validateJobMinimumWage = async (scope: 'employer' | 'admin', jobId: string) => (await apiClient.post(`/${scope}/jobs/${jobId}/validate-minimum-wage`)).data;
export const getJobMinimumWageHistory = async (scope: 'employer' | 'admin', jobId: string) => (await apiClient.get(`/${scope}/jobs/${jobId}/minimum-wage-compliance`)).data;

