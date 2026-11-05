import { apiClient } from '../lib/apiClient';
import type { SalaryComponentDraft, SalaryStructureDraft } from './salaryStructureService';

export type LwfStatus = 'active' | 'inactive';

export interface LwfSetting {
  id: string;
  employee_amount: string;
  employer_amount: string;
  status: LwfStatus;
  notes: string | null;
  source?: 'master' | 'employer' | 'state_policy';
  resolution_status?: 'applied' | 'not_applicable' | 'not_configured' | 'ambiguous';
  resolution_reason?: string;
  is_trigger_period?: boolean;
  frequency?: LwfFrequency;
  schedule_months?: number[];
  state?: { id: string; code: string; name: string } | null;
  policy_employee_amount?: string;
  policy_employer_amount?: string;
  created_at?: string;
  updated_at?: string;
}

export type LwfSettingInput = Pick<LwfSetting, 'employee_amount' | 'employer_amount' | 'status'> & { notes?: string | null };
export type LwfFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';
export interface LwfPolicy {
  id: string; state_id: string; version_number: number; establishment_type: string | null;
  employee_amount: string; employer_amount: string; frequency: LwfFrequency; schedule_months: string | number[];
  effective_from: string; effective_to: string | null; eligibility_min_gross: string | null; eligibility_max_gross: string | null;
  eligible_employee_categories: string; exemption_codes: string; status: 'draft' | 'active' | 'inactive' | 'superseded';
  legal_reference: string | null; notes: string | null; state?: { id: string; code: string; name: string }; audit_events?: any[];
}
export interface LwfPolicyInput {
  state_id: string; establishment_type?: string | null; employee_amount: string; employer_amount: string; frequency: LwfFrequency;
  schedule_months: number[]; effective_from: string; effective_to?: string | null; eligibility_min_gross?: string | null; eligibility_max_gross?: string | null;
  eligible_employee_categories: string[]; exemption_codes: string[]; status: 'draft' | 'active'; legal_reference?: string | null; notes?: string | null;
}

export async function getLwfMaster(): Promise<LwfSetting | null> {
  const { data } = await apiClient.get('/admin/lwf-master');
  return data.setting;
}

export async function saveLwfMaster(input: LwfSettingInput): Promise<LwfSetting> {
  const { data } = await apiClient.post('/admin/lwf-master', input);
  return data.setting;
}

export async function getEmployerLwfSetting(): Promise<{ master: LwfSetting | null; override: LwfSetting | null; effective: LwfSetting | null }> {
  const { data } = await apiClient.get('/employer/lwf-setting');
  return data;
}

export async function saveEmployerLwfSetting(input: LwfSettingInput): Promise<LwfSetting> {
  const { data } = await apiClient.post('/employer/lwf-setting', input);
  return data.override;
}

export async function resetEmployerLwfSetting(): Promise<void> {
  await apiClient.delete('/employer/lwf-setting');
}

export async function listLwfPolicies(): Promise<LwfPolicy[]> {
  const { data } = await apiClient.get('/admin/lwf-policies');
  return data;
}

export async function createLwfPolicy(input: LwfPolicyInput): Promise<LwfPolicy> {
  const { data } = await apiClient.post('/admin/lwf-policies', input);
  return data;
}

export async function updateLwfPolicy(id: string, input: LwfPolicyInput): Promise<LwfPolicy> {
  const { data } = await apiClient.patch(`/admin/lwf-policies/${id}`, input);
  return data;
}

export async function closeLwfPolicy(id: string, input: { effective_to: string; reason: string }): Promise<LwfPolicy> {
  const { data } = await apiClient.post(`/admin/lwf-policies/${id}/close`, input);
  return data;
}

export async function listEmployerLwfPolicies(): Promise<LwfPolicy[]> {
  const { data } = await apiClient.get('/employer/lwf-policies');
  return data;
}

export type LwfPreviewContext = { state?: string; state_id?: string; effective_date?: string; establishment_type?: string; gross_amount?: string; employee_category?: string; exemption_code?: string };

export async function getEffectiveLwfForSalary(scope: 'employer' | 'admin', employerId?: string, context?: LwfPreviewContext): Promise<LwfSetting | null> {
  if (context?.state || context?.state_id) {
    const path = scope === 'admin' ? '/admin/lwf-policy-preview' : '/employer/lwf-policy-preview';
    const { data } = await apiClient.get(path, { params: context });
    const policy = data.policy;
    if (!policy) return { id: '', employee_amount: '0.00', employer_amount: '0.00', status: 'inactive', notes: null, source: 'state_policy', resolution_status: data.status, resolution_reason: data.reason, is_trigger_period: false, state: data.state ?? null, schedule_months: [] };
    return {
      id: policy.id, source: 'state_policy', status: 'active', notes: policy.legal_reference ?? null,
      employee_amount: data.is_trigger_period ? policy.employee_amount : '0.00', employer_amount: data.is_trigger_period ? policy.employer_amount : '0.00',
      policy_employee_amount: policy.employee_amount, policy_employer_amount: policy.employer_amount,
      resolution_status: data.status, resolution_reason: data.reason, is_trigger_period: data.is_trigger_period,
      frequency: policy.frequency, schedule_months: policy.schedule_months, state: data.state,
    };
  }
  if (scope === 'admin') {
    if (!employerId) return null;
    const { data } = await apiClient.get(`/admin/lwf-effective/${employerId}`);
    return data.effective;
  }
  const data = await getEmployerLwfSetting();
  return data.effective;
}

export function removeLwfFromSalaryDraft(draft: SalaryStructureDraft): SalaryStructureDraft {
  return { ...draft, components: draft.components.filter(component => !['EMPLOYEE_LWF', 'EMPLOYER_LWF'].includes(component.code.toUpperCase())) };
}

export function applyLwfToSalaryDraft(draft: SalaryStructureDraft, setting: LwfSetting): SalaryStructureDraft {
  const enabled = setting.status === 'active';
  const components = draft.components.map(component => ({ ...component }));
  const upsert = (code: string, name: string, category: 'deduction' | 'employer_contribution', fixedAmount: string, sortOrder: number) => {
    const normalized: SalaryComponentDraft = {
      code, name, category, calculation_type: 'fixed', fixed_amount: enabled ? fixedAmount : '0.00', percentage: null, percentage_basis: null,
      enabled, classification: 'mandatory', statutory_code: code, applicability_min_gross: null, applicability_max_gross: null,
      monthly_cap: null, is_custom: false, sort_order: sortOrder,
    };
    const index = components.findIndex(component => String(component.code || '').toUpperCase() === code);
    if (index === -1) components.push(normalized);
    else components[index] = normalized;
  };
  upsert('EMPLOYEE_LWF', 'Employee Labour Welfare Fund (LWF)', 'deduction', setting.employee_amount, 125);
  upsert('EMPLOYER_LWF', 'Employer Labour Welfare Fund (LWF)', 'employer_contribution', setting.employer_amount, 225);
  return { ...draft, components };
}
