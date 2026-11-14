import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Menu } from 'lucide-react';
import Sidebar, { AdminPage } from './Sidebar';
import Dashboard from './pages/Dashboard';
import GuardList from './pages/GuardList';
import AddGuard from './pages/AddGuard';
import EmployerManagement from './pages/EmployerManagement';
import JobApprovals from './pages/JobApprovals';
import AttendanceAdmin from './pages/AttendanceAdmin';
import HiringWorkflow from './pages/HiringWorkflow';
import WalletPayments from './pages/WalletPayments';
import Reports from './pages/Reports';
import EmailLogs from './pages/EmailLogs';
import AdminEmployeeRoles from './pages/AdminEmployeeRoles';
import AdminEmployees from './pages/AdminEmployees';
import CompanyDepartments from './pages/CompanyDepartments';
import { canOpenAdminPage } from './adminAccess';
import RoleMaster from './pages/RoleMaster';
import AssociateTypeMaster from './pages/AssociateTypeMaster';
import LocationMaster from './pages/LocationMaster';
import LwfMaster from './pages/LwfMaster';
import MinimumWageManagement from './pages/MinimumWageManagement';
import SettingsPage from './pages/SettingsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';
import NotificationBell from '../components/NotificationBell';
import { apiClient } from '../lib/apiClient';

interface AdminAppProps {
  onLogout: () => void;
}

const PAGE_TITLES: Record<AdminPage, string> = {
  dashboard: 'Dashboard',
  guards: 'Manage Associates',
  'add-guard': 'Add New Associate',
  employers: 'Manage Employers',
  jobs: 'Manage Jobs',
  attendance: 'Attendance',
  hiring: 'Hiring Workflow',
  wallet: 'Wallet & Payments',
  reports: 'Reports',
  'email-logs': 'Email Logs',
  roles: 'Employer Company Roles',
  'employee-roles': 'Granvia Employee Roles',
  employees: 'Granvia Employees',
  'company-allocations': 'Company Staff Allocation',
  'managed-companies': 'My Company Departments',
  'company-profile': 'Company Profile',
  'company-jobs': 'Manage Jobs',
  'company-associates': 'Hired / Current Associates',
  'company-sites': 'Manage Sites',
  'company-attendance': 'Attendance Verification',
  'company-billing': 'Billing Details',
  'company-invoices': 'Invoices / Receipts',
  'associate-types': 'Associate Types',
  locations: 'City & State Master',
  'lwf-master': 'LWF Master',
  'minimum-wages': 'Minimum Wage Management',
  settings: 'Settings',
};

function getAdminPageFromPath(pathname: string): AdminPage {
  if (pathname === '/admin/email-logs' || pathname === '/admin/email-logs/') return 'email-logs';
  if (pathname === '/admin/guards/add' || pathname === '/admin/add-guard') return 'add-guard';
  if (pathname === '/admin/guards') return 'guards';
  if (pathname === '/admin/employers') return 'employers';
  if (pathname === '/admin/jobs') return 'jobs';
  if (pathname === '/admin/attendance') return 'attendance';
  if (pathname === '/admin/hiring') return 'hiring';
  if (pathname === '/admin/wallet') return 'wallet';
  if (pathname === '/admin/reports') return 'reports';
  if (pathname === '/admin/employee-roles') return 'employee-roles';
  if (pathname === '/admin/company-allocations') return 'employees';
  if (pathname === '/admin/managed-companies') return 'managed-companies';
  if (pathname === '/admin/company-profile') return 'company-profile';
  if (pathname === '/admin/company-jobs') return 'company-jobs';
  if (pathname === '/admin/company-associates') return 'company-associates';
  if (pathname === '/admin/company-sites') return 'company-sites';
  if (pathname === '/admin/company-attendance') return 'company-attendance';
  if (pathname === '/admin/company-billing') return 'company-billing';
  if (pathname === '/admin/company-invoices') return 'company-invoices';
  if (pathname === '/admin/employees') return 'employees';
  if (pathname === '/admin/roles') return 'roles';
  if (pathname === '/admin/associate-types') return 'associate-types';
  if (pathname === '/admin/locations') return 'locations';
  if (pathname === '/admin/lwf-master') return 'lwf-master';
  if (pathname === '/admin/minimum-wages') return 'minimum-wages';
  if (pathname === '/admin/settings') return 'settings';
  return 'dashboard';
}

function getAdminPath(page: AdminPage): string {
  if (page === 'email-logs') return '/admin/email-logs';
  if (page === 'roles') return '/admin/roles';
  if (page === 'associate-types') return '/admin/associate-types';
  if (page === 'locations') return '/admin/locations';
  if (page === 'lwf-master') return '/admin/lwf-master';
  if (page === 'minimum-wages') return '/admin/minimum-wages';
  if (page === 'guards' || page === 'add-guard') return page === 'guards' ? '/admin/guards' : '/admin/guards/add';
  return page === 'dashboard' ? '/admin' : `/admin/${page}`;
}

export default function AdminApp({ onLogout }: AdminAppProps) {
  const [page, setPage] = useState<AdminPage>(() => getAdminPageFromPath(window.location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [managedCompanies, setManagedCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [managedCompanyId, setManagedCompanyId] = useState(() => sessionStorage.getItem('granvia_managed_company_id') || '');
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.role !== 'admin_employee' || !(profile.admin_permissions ?? []).some(permission => permission.startsWith('company.') || permission.startsWith('Company '))) { setManagedCompanies([]); return; }
    apiClient.get<Array<{ companyId: string; company: { companyName: string } }>>('/managed-companies').then(({ data }) => {
      const companies = [...new Map(data.map(row => [row.companyId, { id: row.companyId, name: row.company.companyName }])).values()];
      setManagedCompanies(companies);
      const next = companies.some(company => company.id === managedCompanyId) ? managedCompanyId : companies[0]?.id || '';
      setManagedCompanyId(next);
      if (next) sessionStorage.setItem('granvia_managed_company_id', next);
    }).catch(() => setManagedCompanies([]));
  }, [profile?.id, profile?.role, profile?.admin_permissions, managedCompanyId]);

  const switchManagedCompany = (companyId: string) => {
    setManagedCompanyId(companyId);
    sessionStorage.setItem('granvia_managed_company_id', companyId);
    window.dispatchEvent(new CustomEvent('granvia-company-change', { detail: companyId }));
  };

  const handleLogout = () => {
    signOut().finally(onLogout);
  };

  const navigate = (nextPage: AdminPage) => {
    if (!canOpenAdminPage(profile, nextPage)) return;
    setPage(nextPage);
    const nextPath = getAdminPath(nextPage);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  useEffect(() => {
    if (profile?.role === 'admin_employee' && !canOpenAdminPage(profile, page)) {
      const first = (Object.keys(PAGE_TITLES) as AdminPage[]).find(item => canOpenAdminPage(profile, item));
      if (first) {
        setPage(first);
        const nextPath = getAdminPath(first);
        if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
      }
    }
  }, [profile, page]);

  const sidebarWidth = sidebarCollapsed ? 72 : 256;

  const renderPage = () => {
    if (!canOpenAdminPage(profile, page)) return <div className="p-8 text-gray-600">You do not have access to this module. Select an assigned module from the menu, or contact your Super Admin.</div>;
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'guards': return <GuardList onAddGuard={() => navigate('add-guard')} />;
      case 'add-guard': return <AddGuard onSuccess={() => navigate('guards')} />;
      case 'employers': return <EmployerManagement />;
      case 'jobs': return <JobApprovals />;
      case 'attendance': return <AttendanceAdmin />;
      case 'hiring': return <HiringWorkflow />;
      case 'wallet': return <WalletPayments />;
      case 'reports': return <Reports />;
      case 'email-logs': return <EmailLogs />;
      case 'employee-roles': return <AdminEmployeeRoles />;
      case 'employees': return <AdminEmployees />;
      case 'company-allocations': return <CompanyDepartments allocation />;
      case 'company-profile': return <CompanyDepartments view="profile" />;
      case 'company-jobs': return <CompanyDepartments view="jobs" />;
      case 'company-associates': return <CompanyDepartments view="associates" />;
      case 'company-sites': return <CompanyDepartments view="sites" />;
      case 'company-attendance': return <CompanyDepartments view="attendance" />;
      case 'company-billing': return <CompanyDepartments view="billing" />;
      case 'company-invoices': return <CompanyDepartments view="invoices" />;
      case 'roles': return <RoleMaster />;
      case 'associate-types': return <AssociateTypeMaster />;
      case 'locations': return <LocationMaster />;
      case 'lwf-master': return <LwfMaster />;
      case 'minimum-wages': return <MinimumWageManagement />;
      case 'settings': return <SettingsPage />;
      default: return <PlaceholderPage page={page} />;
    }
  };

  useEffect(() => {
    const syncPage = () => setPage(getAdminPageFromPath(window.location.pathname));
    window.addEventListener('popstate', syncPage);
    return () => window.removeEventListener('popstate', syncPage);
  }, []);

  useEffect(() => {
    const nextPath = getAdminPath(page);
    if (window.location.pathname !== nextPath) {
      window.history.replaceState({}, '', nextPath);
    }
  }, [page]);

  return (
    <div className="min-h-screen flex" style={{ background: '#f1f5f9' }}>
      <Sidebar
        currentPage={page}
        onNavigate={navigate}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content */}
      <motion.main
        className="flex-1 flex flex-col min-h-screen overflow-hidden"
        animate={{ marginLeft: sidebarWidth }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Top bar */}
        <div
          className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 border-b"
          style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">{PAGE_TITLES[page]}</h2>
              <p className="text-xs text-gray-400">{profile?.role === 'admin_employee' ? 'Assigned Company Workspace' : 'Granvia Admin Panel'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.role === 'admin_employee' && managedCompanies.length > 0 && <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5"><Building2 size={15} className="hidden shrink-0 text-slate-500 sm:block"/><span className="sr-only">Working company</span><select aria-label="Working company" value={managedCompanyId} onChange={event => switchManagedCompany(event.target.value)} className="w-32 truncate bg-transparent text-sm font-semibold text-slate-700 outline-none sm:w-auto sm:max-w-52">{managedCompanies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
            <NotificationBell />
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}
              >
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-gray-800">{profile?.full_name || 'Admin'}</div>
                <div className="text-xs text-gray-400">{profile?.admin_role_name || 'Super Admin'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
}
