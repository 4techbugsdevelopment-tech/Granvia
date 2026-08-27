// Universal mobile app — one entry for every role except super_admin.
//
// Canonical routes:
//   /universal-app
//   /universal-app/login
//   /universal-app/associate
//   /universal-app/employer
//   /universal-app/sales
//   /universal-app/sub-admin
//   /universal-app/unauthorized
//
// Each role reuses its existing pages via the `layout="mobile"` branch, so this
// shell only orchestrates auth, route resolution and role-based access.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';
import MobileSplash from '../mobile-guard/MobileSplash';
import MobileApp from '../mobile-guard/MobileApp';
import EmployerApp from '../employer/EmployerApp';
import SalesApp from '../sales/SalesApp';
import SubAdminApp from '../subadmin/SubAdminApp';
import OperationsApp from '../operations/OperationsApp';
import FinanceApp from '../finance/FinanceApp';
import UniversalLogin from './UniversalLogin';
import UniversalUnauthorized from './UniversalUnauthorized';
import {
  UNIVERSAL_APP_BASE_PATH,
  UNIVERSAL_APP_LOGIN_PATH,
  getUnsupportedRoleMessage,
  getUniversalPathFromProfile,
  isSupportedUniversalRole,
  normalizeUniversalAppPath,
  resolveUniversalRoute,
} from './roleRouting';

export default function UniversalMobileApp() {
  const { profile, loading } = useAuth();
  const [pathname, setPathname] = useState(() => normalizeUniversalAppPath(window.location.pathname));
  const route = useMemo(() => resolveUniversalRoute(pathname), [pathname]);

  const profileRole = profile?.role ?? null;
  const supportedRole = isSupportedUniversalRole(profileRole) ? profileRole : null;

  useEffect(() => {
    const syncPath = () => setPathname(normalizeUniversalAppPath(window.location.pathname));
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    if (loading || !profile) return;
    const nextPath = getUniversalPathFromProfile(profile);
    if (normalizeUniversalAppPath(window.location.pathname) !== nextPath) {
      window.history.replaceState({}, '', nextPath);
      setPathname(nextPath);
    }
  }, [loading, profile]);

  const goTo = (nextPath: string) => {
    window.history.replaceState({}, '', nextPath);
    setPathname(nextPath);
  };

  const handleLogout = () => {
    signOut().finally(() => goTo(UNIVERSAL_APP_LOGIN_PATH));
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-gray-500">Loading workspace...</div>;
  }

  if (route.kind === 'unauthorized') {
    return (
      <UniversalUnauthorized
        title="Access denied"
        message={getUnsupportedRoleMessage(profileRole)}
        actionLabel={profile ? 'Back to My Portal' : 'Go to Login'}
        onAction={() => goTo(profile ? getUniversalPathFromProfile(profile) : UNIVERSAL_APP_LOGIN_PATH)}
        onLogout={handleLogout}
      />
    );
  }

  if (route.kind === 'portal' && profile && profileRole !== route.role) {
    return (
      <UniversalUnauthorized
        title="Access denied"
        message={getUnsupportedRoleMessage(profileRole)}
        actionLabel="Go to My Portal"
        onAction={() => goTo(getUniversalPathFromProfile(profile))}
        onLogout={handleLogout}
      />
    );
  }

  if (route.kind === 'portal' && !profile) {
    return (
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <UniversalLogin onLogin={() => goTo(UNIVERSAL_APP_BASE_PATH)} />
      </motion.div>
    );
  }

  if (route.kind === 'login') {
    return (
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <UniversalLogin
          onLogin={() => {
            if (profile) {
              goTo(getUniversalPathFromProfile(profile));
            } else {
              goTo(UNIVERSAL_APP_BASE_PATH);
            }
          }}
        />
      </motion.div>
    );
  }

  if (route.kind === 'root' && !profile) {
    return <MobileSplash onComplete={() => goTo(UNIVERSAL_APP_LOGIN_PATH)} />;
  }

  const renderByRole = () => {
    switch (supportedRole) {
      case 'guard':
        return <MobileApp onLogout={handleLogout} />;
      case 'employer':
        return <EmployerApp onLogout={handleLogout} layout="mobile" />;
      case 'sales_executive':
        return <SalesApp onLogout={handleLogout} layout="mobile" />;
      case 'sub_admin':
        return <SubAdminApp onLogout={handleLogout} layout="mobile" />;
      case 'operations':
        return <OperationsApp onLogout={handleLogout} />;
      case 'finance':
        return <FinanceApp onLogout={handleLogout} />;
      default:
        return (
          <UniversalUnauthorized
            title="Access denied"
            message={getUnsupportedRoleMessage(profileRole)}
            actionLabel="Go to Login"
            onAction={() => goTo(UNIVERSAL_APP_LOGIN_PATH)}
            onLogout={handleLogout}
          />
        );
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div key={`${pathname}:${profileRole ?? 'none'}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {renderByRole()}
      </motion.div>
    </AnimatePresence>
  );
}
