import { apiClient } from '../lib/apiClient';

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  role_id: string | null;
  email: string | null;
  mobile: string | null;
  status: 'Active' | 'Inactive';
  permissions: string[] | null;
}

export interface EmployerSubAdmin {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  account_status: 'active' | 'inactive' | 'blocked' | 'pending';
  branch_name: string;
  contact_email: string | null;
  phone: string | null;
  employer_user_id: string | null;
}

export async function listEmployerStaff(): Promise<StaffMember[]> {
  const { data } = await apiClient.get('/employer/staff');
  return data;
}

export async function createEmployerStaff(input: Omit<StaffMember, 'id'> & { role_id: string }) {
  const { data } = await apiClient.post('/employer/staff', input);
  return data as StaffMember;
}

export async function updateEmployerStaff(id: string, input: Partial<Omit<StaffMember, 'id'>>) {
  const { data } = await apiClient.patch(`/employer/staff/${id}`, input);
  return data as StaffMember;
}

export async function deleteEmployerStaff(id: string) {
  await apiClient.delete(`/employer/staff/${id}`);
}

export async function listEmployerSubAdmins(): Promise<EmployerSubAdmin[]> {
  const { data } = await apiClient.get('/employer/subadmins');
  return data;
}

export async function createEmployerSubAdmin(input: {
  full_name: string;
  email: string;
  mobile?: string;
  password?: string;
  branch_name?: string;
  status?: 'active' | 'inactive';
}) {
  const { data } = await apiClient.post('/employer/subadmins', input);
  return data as { sub_admin: EmployerSubAdmin; temporary_password: string | null };
}

export async function updateEmployerSubAdmin(id: string, input: Partial<{
  full_name: string;
  email: string;
  mobile: string | null;
  branch_name: string;
  status: 'active' | 'inactive';
}>) {
  const { data } = await apiClient.patch(`/employer/subadmins/${id}`, input);
  return data as EmployerSubAdmin;
}

export async function deleteEmployerSubAdmin(id: string) {
  await apiClient.delete(`/employer/subadmins/${id}`);
}
