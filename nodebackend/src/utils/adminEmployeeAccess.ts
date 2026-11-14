export const GRANVIA_EMPLOYEE_PERMISSIONS = [
  'platform.dashboard', 'platform.associates', 'platform.employers', 'platform.jobs',
  'platform.attendance', 'platform.hiring', 'platform.wallet', 'platform.reports',
  'platform.email_logs', 'platform.access', 'platform.employer_roles',
  'platform.associate_types', 'platform.locations', 'platform.lwf',
  'platform.minimum_wages', 'platform.settings',
  'company.profile', 'company.jobs', 'company.associates', 'company.sites',
  'company.attendance', 'company.billing', 'company.invoices',
] as const;

export type GranviaEmployeePermission = typeof GRANVIA_EMPLOYEE_PERMISSIONS[number];
export type CompanyDepartment = 'hr' | 'sales' | 'operations' | 'accounts';
export type GranviaModuleScope = 'platform' | 'company';
export const GRANVIA_EMPLOYEE_MODULE_CATALOG: ReadonlyArray<{
  key: GranviaEmployeePermission;
  label: string;
  description: string;
  scope: GranviaModuleScope;
  department?: CompanyDepartment;
}> = [
  { key: 'platform.dashboard', label: 'Dashboard', description: 'View platform totals and current activity.', scope: 'platform' },
  { key: 'platform.associates', label: 'Manage Associates', description: 'Create, edit, verify, reset and remove associates.', scope: 'platform' },
  { key: 'platform.employers', label: 'Manage Employers', description: 'Create, edit, verify and remove employer accounts.', scope: 'platform' },
  { key: 'platform.jobs', label: 'Manage Platform Jobs', description: 'Review, create, edit, approve, close and remove jobs.', scope: 'platform' },
  { key: 'platform.attendance', label: 'Attendance', description: 'Review and decide attendance across the platform.', scope: 'platform' },
  { key: 'platform.hiring', label: 'Hiring Workflow', description: 'Review applications, interviews and hiring workflow.', scope: 'platform' },
  { key: 'platform.wallet', label: 'Wallet & Payments', description: 'Manage wallet balances, credits and recharge completion.', scope: 'platform' },
  { key: 'platform.reports', label: 'Reports', description: 'Open, filter and export platform reports.', scope: 'platform' },
  { key: 'platform.email_logs', label: 'Email Logs', description: 'Review platform email delivery logs.', scope: 'platform' },
  { key: 'platform.access', label: 'Granvia Employee Access', description: 'Manage Granvia employee roles, logins and company allocation.', scope: 'platform' },
  { key: 'platform.employer_roles', label: 'Employer Company Roles', description: 'Create, edit and remove employer staff roles.', scope: 'platform' },
  { key: 'platform.associate_types', label: 'Associate Types', description: 'Create, edit and remove associate types.', scope: 'platform' },
  { key: 'platform.locations', label: 'City & State Master', description: 'Create, edit and remove states and cities.', scope: 'platform' },
  { key: 'platform.lwf', label: 'LWF Master', description: 'Manage LWF master rates and policy versions.', scope: 'platform' },
  { key: 'platform.minimum_wages', label: 'Minimum Wage', description: 'Manage minimum-wage mappings, notifications and compliance.', scope: 'platform' },
  { key: 'platform.settings', label: 'Settings', description: 'Open the current platform settings screen.', scope: 'platform' },
  { key: 'company.profile', label: 'Company Profile', description: 'View and edit the selected company profile.', scope: 'company', department: 'sales' },
  { key: 'company.jobs', label: 'Manage Company Jobs', description: 'Create, edit, publish, close and remove company jobs.', scope: 'company', department: 'hr' },
  { key: 'company.associates', label: 'Hired / Current Associates', description: 'Review applicants, interviews and hiring actions for the selected company.', scope: 'company', department: 'hr' },
  { key: 'company.sites', label: 'Manage Company Sites', description: 'Create, edit, activate, deactivate and remove company sites.', scope: 'company', department: 'operations' },
  { key: 'company.attendance', label: 'Company Attendance Verification', description: 'Review and decide attendance for the selected company.', scope: 'company', department: 'operations' },
  { key: 'company.billing', label: 'Company Billing Details', description: 'View and update company billing and GST details.', scope: 'company', department: 'accounts' },
  { key: 'company.invoices', label: 'Company Invoices / Receipts', description: 'View company-linked invoices and receipts.', scope: 'company', department: 'accounts' },
];

const LEGACY_PERMISSION_MAP: Record<string, GranviaEmployeePermission[]> = {
  Dashboard: ['platform.dashboard'],
  'Associate Management': ['platform.associates'],
  'Employer Management': ['platform.employers'],
  'Job Management': ['platform.jobs'],
  'Minimum Wage Compliance': ['platform.minimum_wages'],
  Attendance: ['platform.attendance'],
  'Hiring Workflow': ['platform.hiring'],
  'Wallet & Payments': ['platform.wallet'],
  Reports: ['platform.reports'],
  'Email Logs': ['platform.email_logs'],
  'Associate Types': ['platform.associate_types'],
  'City & State Master': ['platform.locations'],
  'Company Sales': ['company.profile'],
  'Company HR': ['company.jobs', 'company.associates'],
  'Company Operations': ['company.sites', 'company.attendance'],
  'Company Accounts': ['company.billing', 'company.invoices'],
};

export function normalizeGranviaPermissions(values: readonly string[]): GranviaEmployeePermission[] {
  const allowed = new Set<string>(GRANVIA_EMPLOYEE_PERMISSIONS);
  return [...new Set(values.flatMap(value => LEGACY_PERMISSION_MAP[value] ?? (allowed.has(value) ? [value as GranviaEmployeePermission] : [])))];
}

export function companyDepartmentsForPermissions(values: readonly string[]): CompanyDepartment[] {
  const permissions = normalizeGranviaPermissions(values);
  return [...new Set(GRANVIA_EMPLOYEE_MODULE_CATALOG.filter(module => module.department && permissions.includes(module.key)).map(module => module.department!))];
}

export function companyModulesForDepartment(department: string): GranviaEmployeePermission[] {
  return GRANVIA_EMPLOYEE_MODULE_CATALOG.filter(module => module.department === department).map(module => module.key);
}

export function adminEmployeeModules(path: string, method: string): GranviaEmployeePermission[] {
  const normalizedPath = `/${path.split('?')[0].split('/').filter(Boolean).join('/')}`;
  const resource = normalizedPath.split('/').filter(Boolean)[0];
  if (resource === 'reports') {
    if (method === 'GET' && /^\/reports\/counts\/?$/.test(normalizedPath)) return ['platform.dashboard', 'platform.reports'];
    return ['platform.reports'];
  }
  if (resource === 'employee-role-modules' || resource === 'employee-roles' || resource === 'employees') return ['platform.access'];
  if (resource === 'applications') return ['platform.jobs', 'platform.hiring'];
  if (resource === 'lwf-effective' || resource === 'lwf-policy-preview') return ['platform.jobs', 'platform.lwf'];
  if (resource === 'lwf-master' || resource === 'lwf-policies') return ['platform.lwf'];
  if (resource === 'internal-staff') return ['platform.access'];
  if (resource === 'jobs' && /\/(validate-minimum-wage|minimum-wage-compliance)\/?$/.test(normalizedPath)) return ['platform.jobs', 'platform.minimum_wages'];
  if (resource === 'guards' && method === 'GET' && /^\/guards\/?$/.test(normalizedPath)) return ['platform.associates', 'platform.dashboard'];
  if (resource === 'jobs' && method === 'GET' && /^\/jobs\/?$/.test(normalizedPath)) return ['platform.jobs', 'platform.dashboard'];
  if (/^\/employers\/[^/]+\/wallet-credit\/?$/.test(normalizedPath)) return ['platform.wallet'];
  const modules: Record<string, GranviaEmployeePermission> = {
    guards: 'platform.associates', 'guard-documents': 'platform.associates',
    employers: 'platform.employers', 'company-documents': 'platform.employers',
    jobs: 'platform.jobs', 'minimum-wages': 'platform.minimum_wages', attendance: 'platform.attendance',
    hiring: 'platform.hiring', wallets: 'platform.wallet', 'wallet-recharge-requests': 'platform.wallet',
    'email-logs': 'platform.email_logs', roles: 'platform.employer_roles',
    'associate-types': 'platform.associate_types', location: 'platform.locations',
  };
  return modules[resource] ? [modules[resource]] : [];
}

export function hasAdminEmployeeAccess(permissions: readonly string[], path: string, method: string) {
  const normalized = normalizeGranviaPermissions(permissions);
  return adminEmployeeModules(path, method).some(module => normalized.includes(module));
}

export function parseAdminPermissions(value: string | null | undefined): GranviaEmployeePermission[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? normalizeGranviaPermissions(parsed.filter((item): item is string => typeof item === 'string')) : [];
  } catch { return []; }
}
