import { apiClient } from '../lib/apiClient';

export interface AdminEmployeeModuleOption {
  key: string;
  label: string;
  description: string;
  scope: 'platform' | 'company';
  department?: 'hr' | 'sales' | 'operations' | 'accounts';
}
export interface AdminEmployeeRole {
  id: string; name: string; description: string | null; permissions: string[]; status: 'active' | 'inactive';
}
export interface AdminEmployee {
  id: string; full_name: string; email: string; mobile: string; account_status: 'active' | 'inactive' | 'blocked';
  role_id: string; role_name: string; role_status: string; permissions: string[]; employer_ids: string[]; company_ids: string[];
}
export interface AdminEmployerOption { id: string; fullName: string; email: string }
export const listAdminEmployeeRoles = async (): Promise<AdminEmployeeRole[]> => (await apiClient.get('/admin/employee-roles')).data;
export const listAdminEmployeeRoleModules = async (): Promise<AdminEmployeeModuleOption[]> => (await apiClient.get('/admin/employee-role-modules')).data;
export const saveAdminEmployeeRole = async (id: string | undefined, input: Omit<AdminEmployeeRole, 'id'>) => id ? apiClient.patch(`/admin/employee-roles/${id}`, input) : apiClient.post('/admin/employee-roles', input);
export const deleteAdminEmployeeRole = async (id: string) => apiClient.delete(`/admin/employee-roles/${id}`);
export const listAdminEmployees = async (): Promise<AdminEmployee[]> => (await apiClient.get('/admin/employees')).data;
export const listAdminEmployeeEmployers = async (): Promise<{ employers: AdminEmployerOption[]; companies: { id: string; companyName: string; employerUserId: string; accountStatus: string }[] }> => (await apiClient.get('/company-allocations/options')).data;
export type AdminEmployeeInput = Pick<AdminEmployee, 'full_name' | 'email' | 'mobile' | 'role_id' | 'account_status' | 'company_ids'> & { password?: string; employer_ids?: string[] };
export const saveAdminEmployee = async (id: string | undefined, input: AdminEmployeeInput) => id ? apiClient.patch(`/admin/employees/${id}`, input) : apiClient.post('/admin/employees', input);
export const deleteAdminEmployee = async (id: string) => apiClient.delete(`/admin/employees/${id}`);

export function employeeWhatsAppLink(employee: Pick<AdminEmployee, 'full_name' | 'email' | 'mobile' | 'role_name'>, password = '') {
  const mobile = employee.mobile.replace(/\D/g, '');
  const phone = mobile.length === 10 ? `91${mobile}` : mobile;
  const message = `Hello ${employee.full_name},\nYour Granvia web panel account:\nLogin: ${window.location.origin}/admin\nEmail: ${employee.email}\nRole: ${employee.role_name}${password ? `\nPassword: ${password}` : '\nUse your current password, or choose Forgot Password on the login page.'}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
