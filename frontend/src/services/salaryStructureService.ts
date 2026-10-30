import { apiClient } from '../lib/apiClient';

export type SalaryCategory = 'earning' | 'deduction' | 'employer_contribution';
export type SalaryCalculationType = 'fixed' | 'percentage';
export type SalaryBasis = 'basic_salary' | 'fixed_earnings' | 'gross_salary';
export interface SalaryComponentDraft {
  code: string; name: string; category: SalaryCategory; calculation_type: SalaryCalculationType;
  fixed_amount: string | null; percentage: string | null; percentage_basis: SalaryBasis | null;
  enabled: boolean; classification: 'optional' | 'mandatory'; statutory_code: string | null;
  applicability_min_gross: string | null; applicability_max_gross: string | null; monthly_cap: string | null;
  is_custom: boolean; sort_order: number; monthly_amount?: string;
}
export interface SalaryStructureDraft { components: SalaryComponentDraft[] }
export interface SalaryStructureRecord extends SalaryStructureDraft {
  id: string; gross_monthly: string; deductions_monthly: string; net_monthly: string;
  employer_contributions_monthly: string; employer_cost_monthly: string; annual_ctc: string;
}
export interface SalaryTemplate { id: string; name: string; description: string | null; components: SalaryComponentDraft[] }

export type SalaryApiScope = 'employer' | 'admin';
const salaryBase = (scope: SalaryApiScope) => scope === 'admin' ? '/admin/jobs/salary-templates' : '/employer/salary-templates';
export const listSalaryTemplates = async (scope: SalaryApiScope = 'employer'): Promise<SalaryTemplate[]> => (await apiClient.get(salaryBase(scope))).data;
export const createSalaryTemplate = async (input: { name: string; description?: string; components: SalaryComponentDraft[] }, scope: SalaryApiScope = 'employer'): Promise<SalaryTemplate> => (await apiClient.post(salaryBase(scope), input)).data;
export const deleteSalaryTemplate = async (id: string, scope: SalaryApiScope = 'employer') => apiClient.delete(`${salaryBase(scope)}/${id}`);

const component = (code: string, name: string, category: SalaryCategory, options: Partial<SalaryComponentDraft> = {}): SalaryComponentDraft => ({
  code, name, category, calculation_type: 'fixed', fixed_amount: '0', percentage: null, percentage_basis: null,
  enabled: code === 'BASIC_SALARY', classification: code === 'BASIC_SALARY' ? 'mandatory' : 'optional', statutory_code: null,
  applicability_min_gross: null, applicability_max_gross: null, monthly_cap: null, is_custom: false, sort_order: 0, ...options,
});

export function createDefaultSalaryStructure(basic = ''): SalaryStructureDraft {
  const rows: SalaryComponentDraft[] = [
    component('BASIC_SALARY', 'Basic Salary', 'earning', { fixed_amount: basic, enabled: true, sort_order: 10 }),
    component('HRA', 'House Rent Allowance (HRA)', 'earning', { calculation_type: 'percentage', fixed_amount: null, percentage: '0', percentage_basis: 'basic_salary', sort_order: 20 }),
    component('DA', 'Dearness Allowance (DA)', 'earning', { sort_order: 30 }), component('CONVEYANCE', 'Conveyance Allowance', 'earning', { sort_order: 40 }),
    component('MEDICAL', 'Medical Allowance', 'earning', { sort_order: 50 }), component('SPECIAL', 'Special Allowance', 'earning', { sort_order: 60 }),
    component('OVERTIME', 'Overtime Allowance', 'earning', { sort_order: 70 }), component('INCENTIVE_BONUS', 'Incentives / Bonus', 'earning', { sort_order: 80 }),
    component('OTHER_ALLOWANCE', 'Other Allowances', 'earning', { sort_order: 90 }),
    component('EMPLOYEE_PF', 'Employee Provident Fund (PF)', 'deduction', { calculation_type: 'percentage', fixed_amount: null, percentage: '0', percentage_basis: 'basic_salary', statutory_code: 'EMPLOYEE_PF', sort_order: 110 }),
    component('EMPLOYEE_ESI', 'Employee ESI', 'deduction', { calculation_type: 'percentage', fixed_amount: null, percentage: '0', percentage_basis: 'gross_salary', statutory_code: 'EMPLOYEE_ESI', sort_order: 120 }),
    component('PROFESSIONAL_TAX', 'Professional Tax', 'deduction', { statutory_code: 'PROFESSIONAL_TAX', sort_order: 130 }),
    component('TDS', 'TDS / Income Tax', 'deduction', { statutory_code: 'TDS', sort_order: 140 }), component('SALARY_ADVANCE', 'Salary Advance Recovery', 'deduction', { sort_order: 150 }),
    component('OTHER_DEDUCTION', 'Other Deductions', 'deduction', { sort_order: 160 }),
    component('EMPLOYER_PF', 'Employer PF Contribution', 'employer_contribution', { calculation_type: 'percentage', fixed_amount: null, percentage: '0', percentage_basis: 'basic_salary', statutory_code: 'EMPLOYER_PF', sort_order: 210 }),
    component('EMPLOYER_ESI', 'Employer ESI Contribution', 'employer_contribution', { calculation_type: 'percentage', fixed_amount: null, percentage: '0', percentage_basis: 'gross_salary', statutory_code: 'EMPLOYER_ESI', sort_order: 220 }),
    component('EMPLOYER_STATUTORY', 'Other Employer Statutory Costs', 'employer_contribution', { sort_order: 230 }),
  ];
  return { components: rows };
}

export const salaryDraftFromRecord = (value: SalaryStructureRecord | null | undefined): SalaryStructureDraft | null => value ? { components: value.components.map(row => ({ ...row, fixed_amount: row.fixed_amount == null ? null : String(row.fixed_amount), percentage: row.percentage == null ? null : String(row.percentage), monthly_amount: row.monthly_amount == null ? undefined : String(row.monthly_amount) })) } : null;
