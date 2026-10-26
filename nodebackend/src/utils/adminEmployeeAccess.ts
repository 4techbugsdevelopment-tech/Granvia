export const ADMIN_EMPLOYEE_MODULES = [
  'Dashboard', 'Associate Management', 'Employer Management', 'Job Management',
  'Attendance', 'Hiring Workflow', 'Wallet & Payments', 'Reports', 'Email Logs',
  'Associate Types', 'City & State Master',
  'Company HR', 'Company Sales', 'Company Operations', 'Company Accounts',
] as const;

export function adminEmployeeModules(path: string, method: string): string[] {
  const resource = path.split('/').filter(Boolean)[0];
  if (resource === 'reports') {
    if (method === 'GET' && /^\/reports\/counts\/?$/.test(path)) return ['Dashboard', 'Reports'];
    return ['Reports'];
  }
  // Applicant actions are also embedded in the Job Management screen.
  if (resource === 'applications') return ['Job Management', 'Hiring Workflow'];
  const modules: Record<string, string> = {
    guards: 'Associate Management', 'guard-documents': 'Associate Management',
    employers: 'Employer Management', 'company-documents': 'Employer Management',
    jobs: 'Job Management', attendance: 'Attendance',
    hiring: 'Hiring Workflow', wallets: 'Wallet & Payments', 'email-logs': 'Email Logs',
    'associate-types': 'Associate Types', location: 'City & State Master',
  };
  // Money allocation is a separate permission even from Employer Management.
  if (/^\/employers\/[^/]+\/wallet-credit\/?$/.test(path)) return ['Wallet & Payments'];
  return modules[resource] ? [modules[resource]] : [];
}

export function hasAdminEmployeeAccess(permissions: string[], path: string, method: string) {
  return adminEmployeeModules(path, method).some(module => permissions.includes(module));
}

export function parseAdminPermissions(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && (ADMIN_EMPLOYEE_MODULES as readonly string[]).includes(item)) : [];
  } catch { return []; }
}
