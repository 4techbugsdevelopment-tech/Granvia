import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Menu } from 'lucide-react';
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
import SettingsPage from './pages/SettingsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';

interface AdminAppProps {
  onLogout: () => void;
}

const PAGE_TITLES: Record<AdminPage, string> = {
  dashboard: 'Dashboard',
  guards: 'Service Partner Management',
  'add-guard': 'Add New Service Partner',
  employers: 'Employer Management',
  jobs: 'Job Management',
  attendance: 'Attendance',
  hiring: 'Hiring Workflow',
  wallet: 'Wallet & Payments',
  reports: 'Reports',
  settings: 'Settings',
};

export default function AdminApp({ onLogout }: AdminAppProps) {
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { profile } = useAuth();

  const handleLogout = () => {
    signOut().finally(onLogout);
  };

  const sidebarWidth = sidebarCollapsed ? 72 : 256;

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'guards': return <GuardList onAddGuard={() => setPage('add-guard')} />;
      case 'add-guard': return <AddGuard onSuccess={() => setPage('guards')} />;
      case 'employers': return <EmployerManagement />;
      case 'jobs': return <JobApprovals />;
      case 'attendance': return <AttendanceAdmin />;
      case 'hiring': return <HiringWorkflow />;
      case 'wallet': return <WalletPayments />;
      case 'reports': return <Reports />;
      case 'settings': return <SettingsPage />;
      default: return <PlaceholderPage page={page} />;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f1f5f9' }}>
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
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
              <p className="text-xs text-gray-400">Granvia Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              className="relative p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              <Bell size={18} />
              <motion.span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}
              >
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-gray-800">{profile?.full_name || 'Admin'}</div>
                <div className="text-xs text-gray-400">Super Admin</div>
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
