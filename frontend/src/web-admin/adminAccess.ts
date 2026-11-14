import type { ProfileRow } from '../lib/apiTypes';
import type { AdminPage } from './Sidebar';

const COMPANY_PAGE_PERMISSIONS: Partial<Record<AdminPage, string>> = {
  'company-profile': 'company.profile',
  'company-jobs': 'company.jobs',
  'company-associates': 'company.associates',
  'company-sites': 'company.sites',
  'company-attendance': 'company.attendance',
  'company-billing': 'company.billing',
  'company-invoices': 'company.invoices',
};
const PLATFORM_PAGE_PERMISSIONS: Partial<Record<AdminPage, string>> = {
  dashboard: 'platform.dashboard',
  guards: 'platform.associates',
  'add-guard': 'platform.associates',
  employers: 'platform.employers',
  jobs: 'platform.jobs',
  attendance: 'platform.attendance',
  hiring: 'platform.hiring',
  wallet: 'platform.wallet',
  reports: 'platform.reports',
  'email-logs': 'platform.email_logs',
  'employee-roles': 'platform.access',
  employees: 'platform.access',
  'company-allocations': 'platform.access',
  roles: 'platform.employer_roles',
  'associate-types': 'platform.associate_types',
  locations: 'platform.locations',
  'lwf-master': 'platform.lwf',
  'minimum-wages': 'platform.minimum_wages',
  settings: 'platform.settings',
};
const LEGACY_PAGE_PERMISSIONS: Record<string, string> = {
  'platform.dashboard': 'Dashboard',
  'platform.associates': 'Associate Management',
  'platform.employers': 'Employer Management',
  'platform.jobs': 'Job Management',
  'platform.attendance': 'Attendance',
  'platform.hiring': 'Hiring Workflow',
  'platform.wallet': 'Wallet & Payments',
  'platform.reports': 'Reports',
  'platform.email_logs': 'Email Logs',
  'platform.employer_roles': 'Employer Company Roles',
  'platform.associate_types': 'Associate Types',
  'platform.locations': 'City & State Master',
  'platform.minimum_wages': 'Minimum Wage Compliance',
  'company.profile': 'Company Sales',
  'company.jobs': 'Company HR',
  'company.associates': 'Company HR',
  'company.sites': 'Company Operations',
  'company.attendance': 'Company Operations',
  'company.billing': 'Company Accounts',
  'company.invoices': 'Company Accounts',
};
export const isCompanyEmployeePage = (page: AdminPage) => page in COMPANY_PAGE_PERMISSIONS;
export function canOpenAdminPage(profile: ProfileRow | null, page: AdminPage) {
  if ((page === 'managed-companies' || isCompanyEmployeePage(page)) && profile?.role === 'super_admin') return false;
  if (profile?.role === 'super_admin') return true;
  if (profile?.role !== 'admin_employee' || profile.account_status !== 'active') return false;
  const permission = COMPANY_PAGE_PERMISSIONS[page] ?? PLATFORM_PAGE_PERMISSIONS[page];
  const permissions = profile.admin_permissions ?? [];
  return !!permission && (permissions.includes(permission) || permissions.includes(LEGACY_PAGE_PERMISSIONS[permission]));
}
