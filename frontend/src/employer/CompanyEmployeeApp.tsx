import { Building2, LogOut } from 'lucide-react';
import CompanyDepartments from '../web-admin/pages/CompanyDepartments';
import GranviaLogo from '../components/GranviaLogo';
import { signOut } from '../services/authService';
import { useAuth } from '../hooks/useAuth';

export default function CompanyEmployeeApp({ onLogout }: { onLogout: () => void }) {
  const { profile } = useAuth();
  const logout = () => signOut().finally(onLogout);
  return <div className="min-h-screen bg-slate-100">
    <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-6">
      <div className="flex items-center gap-4">
        <GranviaLogo size={32} />
        <div className="hidden h-8 w-px bg-slate-200 sm:block" />
        <div><p className="text-sm font-bold text-slate-900">Company Employee Workspace</p><p className="text-xs text-slate-500">{profile?.admin_role_name || 'Assigned company role'}</p></div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:flex"><Building2 size={16}/>{profile?.full_name}</span>
        <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><LogOut size={16}/> Logout</button>
      </div>
    </header>
    <main><CompanyDepartments employeePortal /></main>
  </div>;
}
