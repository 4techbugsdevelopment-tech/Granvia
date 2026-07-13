import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SplashScreen from './web-admin/SplashScreen';
import LoginScreen from './web-admin/LoginScreen';
import AdminApp from './web-admin/AdminApp';
import MobileSplash from './mobile-guard/MobileSplash';
import MobileLogin from './mobile-guard/MobileLogin';
import MobileApp from './mobile-guard/MobileApp';
import EmployerAuth from './employer/EmployerAuth';
import EmployerApp from './employer/EmployerApp';
import SalesAuth from './sales/SalesAuth';
import SalesApp from './sales/SalesApp';
import SubAdminAuth from './subadmin/SubAdminAuth';
import SubAdminApp from './subadmin/SubAdminApp';
import GranviaLogo from './components/GranviaLogo';
import { Tilt } from './components/fx';
import { useAuth } from './hooks/useAuth';

const Globe = lazy(() => import('./components/fx/Globe'));
const ThreeScene = lazy(() => import('./components/fx/ThreeScene'));

const PORTALS = [
  { mode: 'admin', emoji: '🛡️', title: 'Admin Panel', subtitle: 'Super Admin Control Center', desc: 'Manage guards, jobs, attendance & reports', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  { mode: 'mobile', emoji: '📱', title: 'Service Partner App', subtitle: 'Mobile Service Partner Portal', desc: 'Find jobs, mark attendance & manage profile', bg: 'rgba(139,26,26,0.12)', border: 'rgba(139,26,26,0.3)' },
  { mode: 'employer', emoji: '🏢', title: 'Employer Portal', subtitle: 'Company Hiring Workspace', desc: 'Post jobs, review applicants & manage payments', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  { mode: 'sales', emoji: '📈', title: 'Sales Executive', subtitle: 'Client & Discount Management', desc: 'Manage clients, post jobs & apply discounts', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.3)' },
  { mode: 'subadmin', emoji: '🗂️', title: 'Sub Admin', subtitle: 'Regional Operations', desc: 'Manage company, staff, clients & guards', bg: 'rgba(13,148,136,0.12)', border: 'rgba(13,148,136,0.3)' },
] as const;

type AppMode = 'landing' | 'admin' | 'mobile' | 'employer' | 'sales' | 'subadmin';
type AdminState = 'splash' | 'login' | 'dashboard';
type MobileState = 'splash' | 'login' | 'app';
type EmployerState = 'login' | 'app';
type DemoPanelState = 'login' | 'app';

type GranviaWindow = Window & {
  __GRANVIA_APK__?: boolean;
};

function getModeFromPath(pathname: string): AppMode {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/guard' || pathname.startsWith('/guard/')) return 'mobile';
  if (pathname === '/employer' || pathname.startsWith('/employer/')) return 'employer';
  if (pathname === '/sales' || pathname.startsWith('/sales/')) return 'sales';
  if (pathname === '/sub-admin' || pathname.startsWith('/sub-admin/')) return 'subadmin';
  return 'landing';
}

function getPathForMode(mode: AppMode): string {
  if (mode === 'admin') return '/admin';
  if (mode === 'mobile') return '/guard';
  if (mode === 'employer') return '/employer';
  if (mode === 'sales') return '/sales';
  if (mode === 'subadmin') return '/sub-admin';
  return '/';
}

function isApkMode(): boolean {
  return !!(
    (window as GranviaWindow).__GRANVIA_APK__ ||
    navigator.userAgent.includes('wv') ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

function isMobileViewport(): boolean {
  return window.innerWidth < 768;
}

function LandingPage({ onSelect }: { onSelect: (mode: AppMode) => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f1e3c 60%, #1a0a0a 100%)' }}
    >
      <motion.div
        className="absolute rounded-full"
        style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(139,26,26,0.1) 0%, transparent 70%)', top: -200, left: -200 }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 400, height: 400, background: 'radial-gradient(circle, rgba(15,80,160,0.1) 0%, transparent 70%)', bottom: -100, right: -100 }}
        animate={{ scale: [1.1, 1, 1.1] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            background: i % 3 === 0 ? '#8b1a1a' : 'rgba(255,255,255,0.3)',
            left: `${(i * 17 + 5) % 100}%`,
            top: `${(i * 23 + 10) % 100}%`,
          }}
          animate={{ y: [-20, -80], opacity: [0, 0.7, 0] }}
          transition={{ duration: 3 + (i % 3), delay: (i % 5) * 0.6, repeat: Infinity }}
        />
      ))}

      {/* Immersive WebGL hero background (desktop). */}
      <motion.div
        aria-hidden
        className="hidden md:block absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ duration: 1.8, ease: 'easeOut' }}
      >
        <Suspense fallback={null}>
          <ThreeScene />
        </Suspense>
      </motion.div>

      {/* Ambient globe accent behind the cards. */}
      <motion.div
        aria-hidden
        className="hidden lg:block absolute pointer-events-none"
        style={{ bottom: '-160px', right: '-120px' }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 0.4, scale: 1 }}
        transition={{ duration: 1.6, ease: 'easeOut', delay: 0.4 }}
      >
        <Suspense fallback={null}>
          <Globe size={420} />
        </Suspense>
      </motion.div>

      <motion.div
        className="relative z-10 flex flex-col items-center px-4"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div className="mb-8" animate={{ y: [-4, 4, -4] }} transition={{ duration: 4, repeat: Infinity }}>
          <GranviaLogo size={72} textColor="white" accentColor="#8b1a1a" />
        </motion.div>

        <p className="text-blue-200 text-sm mb-2 opacity-70 tracking-widest">SELECT YOUR PORTAL</p>
        <p className="text-gray-400 text-xs mb-8 text-center max-w-xs">
          Choose your login portal to continue
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
          {PORTALS.map((p, i) => (
            <motion.div
              key={p.mode}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <Tilt className="rounded-3xl" style={{ position: 'relative' }} max={22} lift={12}>
                <button
                  onClick={() => onSelect(p.mode)}
                  className="w-full h-full rounded-3xl p-6 text-left relative overflow-hidden mobile-touch-interactive"
                  style={{ background: p.bg, border: `1px solid ${p.border}`, backdropFilter: 'blur(10px)', transformStyle: 'preserve-3d' }}
                >
                  <div className="text-3xl mb-3" style={{ transform: 'translateZ(45px)' }}>{p.emoji}</div>
                  <h3 className="text-white font-bold text-lg" style={{ transform: 'translateZ(30px)' }}>{p.title}</h3>
                  <p className="text-gray-400 text-xs mt-1" style={{ transform: 'translateZ(20px)' }}>{p.subtitle}</p>
                  <p className="mt-3 text-xs text-gray-500" style={{ transform: 'translateZ(12px)' }}>{p.desc}</p>
                </button>
              </Tilt>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center space-y-1">
          <p className="text-gray-500 text-xs">Admin: admin@granvia.com / admin123</p>
          <p className="text-gray-500 text-xs">Service Partner: rajesh@example.com / guard123</p>
        </div>
      </motion.div>
    </div>
  );
}

function MobileFrame({ children }: { children: React.ReactNode }) {
  const [apk, setApk] = useState(isApkMode());
  const [mobile, setMobile] = useState(isMobileViewport());

  useEffect(() => {
    const onResize = () => {
      setMobile(isMobileViewport());
      setApk(isApkMode());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Full-screen mode: APK or mobile viewport
  if (apk || mobile) {
    return (
      <div className="granvia-mobile fixed inset-0 w-full h-full overflow-hidden" style={{ background: '#f1f5f9' }}>
        {children}
      </div>
    );
  }

  // Desktop preview: phone frame
  return (
    <div className="min-h-screen flex items-center justify-center py-8" style={{ background: '#e8ecf0' }}>
      <div
        className="mobile-frame-wrapper desktop-preview relative overflow-hidden"
        style={{
          width: 390,
          height: 844,
          background: '#0f1e3c',
          borderRadius: '2.5rem',
          boxShadow: '0 40px 80px rgba(0,0,0,0.4), 0 0 0 12px #1a1a1a, 0 0 0 14px #2a2a2a',
          flexShrink: 0,
        }}
      >
        <div className="mobile-notch absolute top-0 left-1/2 -translate-x-1/2 z-50 rounded-b-2xl" style={{ width: 120, height: 30, background: '#000' }} />
        <div className="absolute inset-0 overflow-hidden" style={{ background: '#f1f5f9', borderRadius: '2.5rem' }}>
          <div className="absolute inset-0 overflow-hidden" style={{ top: 30 }}>
            {children}
          </div>
        </div>
        <div className="mobile-home-indicator absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 120, height: 5, background: 'rgba(255,255,255,0.3)' }} />
      </div>
    </div>
  );
}

function App() {
  const { profile, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<AppMode>(() => getModeFromPath(window.location.pathname));
  const [adminState, setAdminState] = useState<AdminState>('splash');
  const [mobileState, setMobileState] = useState<MobileState>('splash');
  const [employerState, setEmployerState] = useState<EmployerState>('login');
  const [salesState, setSalesState] = useState<DemoPanelState>('login');
  const [subAdminState, setSubAdminState] = useState<DemoPanelState>('login');

  const setPathForMode = (nextMode: AppMode, replace = false) => {
    const nextPath = getPathForMode(nextMode);
    if (window.location.pathname === nextPath) return;
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', nextPath);
  };

  const openPortal = (nextMode: AppMode, replace = false) => {
    setPathForMode(nextMode, replace);
    setMode(nextMode);
    if (nextMode === 'admin') {
      setAdminState(profile?.role === 'super_admin' ? 'dashboard' : 'splash');
    }
    if (nextMode === 'mobile') {
      setMobileState(profile?.role === 'guard' ? 'app' : 'splash');
    }
    if (nextMode === 'employer') {
      setEmployerState(profile?.role === 'employer' ? 'app' : 'login');
    }
    if (nextMode === 'sales') {
      setSalesState(profile?.role === 'sales_executive' ? 'app' : 'login');
    }
    if (nextMode === 'subadmin') {
      setSubAdminState(profile?.role === 'sub_admin' ? 'app' : 'login');
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const applyRoute = () => {
      const routeMode = getModeFromPath(window.location.pathname);
      if (routeMode === 'admin') {
        setMode('admin');
        setAdminState(profile?.role === 'super_admin' ? 'dashboard' : 'splash');
        return;
      }

      if (routeMode === 'mobile') {
        setMode('mobile');
        setMobileState(profile?.role === 'guard' ? 'app' : 'splash');
        return;
      }

      if (routeMode === 'employer') {
        setMode('employer');
        setEmployerState(profile?.role === 'employer' ? 'app' : 'login');
        return;
      }

      if (routeMode === 'sales') {
        setMode('sales');
        setSalesState(profile?.role === 'sales_executive' ? 'app' : 'login');
        return;
      }

      if (routeMode === 'subadmin') {
        setMode('subadmin');
        setSubAdminState(profile?.role === 'sub_admin' ? 'app' : 'login');
        return;
      }

      setMode('landing');
    };

    applyRoute();
    window.addEventListener('popstate', applyRoute);
    return () => window.removeEventListener('popstate', applyRoute);
  }, [authLoading, profile?.role]);

  if (authLoading) {
    return <div className="min-h-screen grid place-items-center text-sm text-gray-500">Loading...</div>;
  }

  const handleModeSelect = (m: AppMode) => {
    openPortal(m);
  };

  if (mode === 'landing') return <LandingPage onSelect={handleModeSelect} />;

  if (mode === 'admin') {
    return (
      <AnimatePresence mode="wait">
        {adminState === 'splash' && <SplashScreen key="admin-splash" onComplete={() => setAdminState('login')} />}
        {adminState === 'login' && (
          <motion.div key="admin-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LoginScreen onLogin={() => setAdminState('dashboard')} onBackToLanding={() => openPortal('landing')} />
          </motion.div>
        )}
        {adminState === 'dashboard' && (
          <motion.div key="admin-dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AdminApp onLogout={() => { setAdminState('login'); setMode('admin'); setPathForMode('admin', true); }} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (mode === 'mobile') {
    return (
      <MobileFrame>
        <AnimatePresence mode="wait">
          {mobileState === 'splash' && <MobileSplash key="mob-splash" onComplete={() => setMobileState('login')} />}
          {mobileState === 'login' && (
            <motion.div key="mob-login" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MobileLogin onLogin={() => setMobileState('app')} onBackToLanding={() => openPortal('landing')} />
            </motion.div>
          )}
          {mobileState === 'app' && (
            <motion.div key="mob-app" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <MobileApp onLogout={() => { setMobileState('login'); setMode('mobile'); setPathForMode('mobile', true); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </MobileFrame>
    );
  }

  if (mode === 'employer') {
    return (
      <AnimatePresence mode="wait">
        {employerState === 'login' && (
          <motion.div key="emp-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmployerAuth onLogin={() => setEmployerState('app')} onBackToLanding={() => openPortal('landing')} />
          </motion.div>
        )}
        {employerState === 'app' && (
          <motion.div key="emp-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmployerApp onLogout={() => { setEmployerState('login'); setMode('employer'); setPathForMode('employer', true); }} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (mode === 'sales') {
    return (
      <AnimatePresence mode="wait">
        {salesState === 'login' && (
          <motion.div key="sales-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SalesAuth onLogin={() => setSalesState('app')} onBackToLanding={() => openPortal('landing')} />
          </motion.div>
        )}
        {salesState === 'app' && (
          <motion.div key="sales-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SalesApp onLogout={() => { setSalesState('login'); setMode('sales'); setPathForMode('sales', true); }} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (mode === 'subadmin') {
    return (
      <AnimatePresence mode="wait">
        {subAdminState === 'login' && (
          <motion.div key="sub-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SubAdminAuth onLogin={() => setSubAdminState('app')} onBackToLanding={() => openPortal('landing')} />
          </motion.div>
        )}
        {subAdminState === 'app' && (
          <motion.div key="sub-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SubAdminApp onLogout={() => { setSubAdminState('login'); setMode('subadmin'); setPathForMode('subadmin', true); }} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return null;
}

export default App;
