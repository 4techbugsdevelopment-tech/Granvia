// Universal mobile app — one entry for every role except super_admin.
//
// Flow:  splash → shared login → role detected from profile → role's own App
// rendered in its mobile layout (bottom nav + top-left master-entry drawer).
//
// Each role reuses its existing pages via the `layout="mobile"` branch, so this
// shell only orchestrates auth + role routing — it duplicates no page markup.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';
import MobileSplash from '../mobile-guard/MobileSplash';
import MobileApp from '../mobile-guard/MobileApp';
import EmployerApp from '../employer/EmployerApp';
import SalesApp from '../sales/SalesApp';
import SubAdminApp from '../subadmin/SubAdminApp';
import UniversalLogin from './UniversalLogin';

type ShellState = 'splash' | 'login' | 'app';

const KNOWN_ROLES = ['guard', 'employer', 'sales_executive', 'sub_admin'];

export default function UniversalMobileApp() {
  const { profile } = useAuth();
  // If already authenticated as a supported role, skip splash/login.
  const initial: ShellState = profile && KNOWN_ROLES.includes(profile.role) ? 'app' : 'splash';
  const [state, setState] = useState<ShellState>(initial);

  const backToLogin = () => setState('login');
  const handleLogout = () => { signOut().finally(backToLogin); };

  if (state === 'splash') {
    return <MobileSplash onComplete={() => setState('login')} />;
  }

  if (state === 'login') {
    return (
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <UniversalLogin onLogin={() => setState('app')} />
      </motion.div>
    );
  }

  // state === 'app' — pick the shell by the account's own role.
  const role = profile?.role;

  const renderByRole = () => {
    switch (role) {
      case 'guard':
        return <MobileApp onLogout={handleLogout} />;
      case 'employer':
        return <EmployerApp onLogout={handleLogout} layout="mobile" />;
      case 'sales_executive':
        return <SalesApp onLogout={handleLogout} layout="mobile" />;
      case 'sub_admin':
        return <SubAdminApp onLogout={handleLogout} layout="mobile" />;
      case 'super_admin':
        return <UnsupportedRole message="The Super Admin console is available on desktop only." onLogout={handleLogout} />;
      default:
        return <UnsupportedRole message="Your account role is not supported in the app yet." onLogout={handleLogout} />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div key={role ?? 'none'} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {renderByRole()}
      </motion.div>
    </AnimatePresence>
  );
}

function UnsupportedRole({ message, onLogout }: { message: string; onLogout: () => void }) {
  return (
    <div className="granvia-mobile flex flex-col items-center justify-center w-full h-full px-8 text-center gap-4" style={{ background: '#f1f5f9' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,26,26,0.1)', color: '#8b1a1a' }}>
        <ShieldAlert size={30} />
      </div>
      <p className="font-bold text-gray-800">Not available here</p>
      <p className="text-sm text-gray-500">{message}</p>
      <button
        onClick={onLogout}
        className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
