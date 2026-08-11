import { apiClient } from '../lib/apiClient';

export const ROLE_MODULES = [
  'Dashboard',
  'Associate Management',
  'Employer Management',
  'Job Management',
  'Attendance',
  'Hiring Workflow',
  'Wallet & Payments',
  'Reports',
  'Email Logs',
  'Role Master',
  'Settings',
  'Staff Management',
  'Sub Admin Management',
  'Company Sites',
  'Applications',
  'Interview Requests',
  'Job Offers',
  'Agreements',
  'Invoices',
  'Support Tickets',
  'Notifications',
  'Verification Queue',
  'Clients',
  'Documents',
] as const;

export interface RoleOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  permissions: string[];
}

export async function listActiveRoles(): Promise<RoleOption[]> {
  const { data } = await apiClient.get('/me/roles');
  return data;
}

export async function listAllRoles(): Promise<RoleOption[]> {
  const { data } = await apiClient.get('/admin/roles');
  return data;
}

export async function createRole(input: { name: string; description?: string; status?: 'active' | 'inactive'; permissions?: string[] }) {
  const { data } = await apiClient.post('/admin/roles', input);
  return data as RoleOption;
}

export async function updateRole(roleId: string, input: Partial<{ name: string; description: string | null; status: 'active' | 'inactive'; permissions: string[] }>) {
  const { data } = await apiClient.patch(`/admin/roles/${roleId}`, input);
  return data as RoleOption;
}

export async function deleteRole(roleId: string) {
  const { data } = await apiClient.delete(`/admin/roles/${roleId}`);
  return data as RoleOption;
}
