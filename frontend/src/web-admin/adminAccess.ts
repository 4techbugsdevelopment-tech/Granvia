import type { ProfileRow } from '../lib/apiTypes';
import type { AdminPage } from './Sidebar';

const PAGE_MODULES: Partial<Record<AdminPage, string>> = {
  dashboard: 'Dashboard', guards: 'Associate Management', 'add-guard': 'Associate Management', employers: 'Employer Management',
  jobs: 'Job Management', attendance: 'Attendance', hiring: 'Hiring Workflow', wallet: 'Wallet & Payments', reports: 'Reports',
  'email-logs': 'Email Logs', 'associate-types': 'Associate Types', locations: 'City & State Master',
};
export function canOpenAdminPage(profile: ProfileRow | null, page: AdminPage) {
  if (profile?.role === 'super_admin') return true;
  if (profile?.role !== 'admin_employee' || profile.account_status !== 'active') return false;
  const module = PAGE_MODULES[page];
  return !!module && (profile.admin_permissions ?? []).includes(module);
}
