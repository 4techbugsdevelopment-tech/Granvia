import { apiClient } from '../lib/apiClient';
import type { SalaryComponentDraft, SalaryStructureDraft } from './salaryStructureService';

export type LwfStatus = 'active' | 'inactive';

export interface LwfSetting {
  id: string;
  employee_amount: string;
  employer_amount: string;
  status: LwfStatus;
  notes: string | null;
  source?: 'master' | 'employer';
  created_at?: string;
  updated_at?: string;
}

export type LwfSettingInput = Pick<LwfSetting, 'employee_amount' | 'employer_amount' | 'status'> & { notes?: string | null };

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

export async function getEffectiveLwfForSalary(scope: 'employer' | 'admin', employerId?: string): Promise<LwfSetting | null> {
  if (scope === 'admin') {
    if (!employerId) return null;
    const { data } = await apiClient.get(`/admin/lwf-effective/${employerId}`);
    return data.effective;
  }
  const data = await getEmployerLwfSetting();
  return data.effective;
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
