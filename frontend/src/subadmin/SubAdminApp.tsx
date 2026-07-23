// Sub Admin panel — branch-scoped shell + navigation.
// Data is demo/mock, scoped by branchId so this user only sees "their own" entities.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, UsersRound, BadgeCheck, Briefcase, Shield, BarChart3, LogOut,
} from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';
import { signOut } from '../services/authService';
import { NAVY_GRADIENT, PAGE_BG, BURGUNDY } from './theme';
import MobileChrome from '../universal-mobile/MobileChrome';
import DashboardPage from './pages/DashboardPage';
import CompanyPage from './pages/CompanyPage';
import StaffPage from './pages/StaffPage';
import VerificationPage from './pages/VerificationPage';
import ClientsPage from './pages/ClientsPage';
import GuardsPage from './pages/GuardsPage';
import ReportsPage from './pages/ReportsPage';

type SubPage = 'dashboard' | 'company' | 'staff' | 'verification' | 'clients' | 'guards' | 'reports';

// `master: true` → setup / master-data entries shown in the top-left drawer on mobile.
const NAV: { id: SubPage; label: string; icon: React.ReactNode; master?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'company', label: 'Company Details', icon: <Building2 size={18} />, master: true },
  { id: 'staff', label: 'Staff', icon: <UsersRound size={18} />, master: true },
  { id: 'verification', label: 'Verification Desk', icon: <BadgeCheck size={18} />, master: true },
  { id: 'clients', label: 'My Clients', icon: <Briefcase size={18} /> },
  { id: 'guards', label: 'Associates', icon: <Shield size={18} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={18} /> },
];

export default function SubAdminApp({ onLogout, layout = 'desktop' }: { onLogout: () => void; layout?: 'desktop' | 'mobile' }) {
  const [page, setPage] = useState<SubPage>('dashboard');
  const handleLogout = () => { signOut().finally(onLogout); };

  const render = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'company': return <CompanyPage />;
      case 'staff': return <StaffPage />;
      case 'verification': return <VerificationPage />;
      case 'clients': return <ClientsPage />;
      case 'guards': return <GuardsPage />;
      case 'reports': return <ReportsPage />;
    }
  };

  if (layout === 'mobile') {
    return (
      <MobileChrome
        brandLabel="Sub Admin · West Branch"
        title={NAV.find(n => n.id === page)?.label ?? 'Sub Admin'}
        navItems={NAV}
        activeId={page}
        onNavigate={id => setPage(id as SubPage)}
        onLogout={handleLogout}
        accent={BURGUNDY}
      >
        {render()}
      </MobileChrome>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: PAGE_BG }}>
      <aside className="w-64 fixed top-0 left-0 h-screen flex flex-col z-50" style={{ background: NAVY_GRADIENT }}>
        <div className="px-4 py-5 border-b border-white/10">
          <GranviaLogo size={30} textColor="white" accentColor="#7A2621" />
          <p className="text-[11px] text-white/50 mt-2 pl-0.5">Sub Admin · West Branch</p>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {NAV.map(item => {
            const active = page === item.id;
            return (
              <motion.button key={item.id} onClick={() => setPage(item.id)} whileTap={{ scale: 0.97 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: active ? 'white' : 'rgba(255,255,255,0.6)',
                  background: active ? 'linear-gradient(135deg, rgba(122,38,33,0.9), rgba(122,38,33,0.55))' : 'transparent',
                }}>
                {item.icon}{item.label}
              </motion.button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <LogOut size={18} /> Logout
          </motion.button>
        </div>
      </aside>
      <main className="flex-1 ml-64 overflow-y-auto min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {render()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
