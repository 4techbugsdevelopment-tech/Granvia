import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Search, Clock, User, MoreHorizontal, LogOut, ClipboardList, Wallet, CalendarDays, Bell, LifeBuoy, FileSignature, X } from 'lucide-react';
import MobileDashboard from './screens/MobileDashboard';
import JobSearch from './screens/JobSearch';
import AttendanceScreen from './screens/AttendanceScreen';
import ProfileScreen from './screens/ProfileScreen';
import ApplicationsScreen from './screens/ApplicationsScreen';
import WalletScreen from './screens/WalletScreen';
import AvailabilityScreen from './screens/AvailabilityScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SupportScreen from './screens/SupportScreen';
import MobilePlaceholder from './screens/MobilePlaceholder';
import AadhaarMockTestScreen from './screens/AadhaarMockTestScreen';
import AgreementScreen from './screens/AgreementScreen';
import { signOut } from '../services/authService';

interface MobileAppProps {
  onLogout: () => void;
}

type Screen =
  | 'dashboard' | 'jobs' | 'attendance' | 'profile' | 'applications'
  | 'wallet' | 'availability' | 'notifications' | 'support' | 'settings' | 'accepted-jobs' | 'agreement' | 'transactions'
  | 'aadhaar-mock-test';

function initialScreen(): Screen {
  if (window.location.pathname === '/guard/aadhaar/mock-test') return 'aadhaar-mock-test';
  if (new URLSearchParams(window.location.search).has('esign_return')) return 'agreement';
  return 'dashboard';
}

const NAV_ITEMS = [
  { id: 'dashboard' as Screen, icon: <LayoutDashboard size={20} />, label: 'Home' },
  { id: 'jobs' as Screen, icon: <Search size={20} />, label: 'Jobs' },
  { id: 'attendance' as Screen, icon: <Clock size={20} />, label: 'Attend.' },
  { id: 'profile' as Screen, icon: <User size={20} />, label: 'Profile' },
];

const MORE_ITEMS = [
  { id: 'applications' as Screen, icon: <ClipboardList size={20} />, label: 'Applications' },
  { id: 'wallet' as Screen, icon: <Wallet size={20} />, label: 'Wallet' },
  { id: 'availability' as Screen, icon: <CalendarDays size={20} />, label: 'Availability' },
  { id: 'notifications' as Screen, icon: <Bell size={20} />, label: 'Notifications' },
  { id: 'support' as Screen, icon: <LifeBuoy size={20} />, label: 'Support' },
  { id: 'agreement' as Screen, icon: <FileSignature size={20} />, label: 'Agreement' },
];

export default function MobileApp({ onLogout }: MobileAppProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [screen]);

  const handleLogout = () => {
    signOut().finally(onLogout);
  };

  const goTo = (next: Screen) => {
    setScreen(next);
    setMenuOpen(false);
  };

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard': return <MobileDashboard onNavigate={s => setScreen(s as Screen)} />;
      case 'jobs': return <JobSearch />;
      case 'attendance': return <AttendanceScreen />;
      case 'profile': return <ProfileScreen />;
      case 'applications': return <ApplicationsScreen />;
      case 'wallet': return <WalletScreen />;
      case 'availability': return <AvailabilityScreen />;
      case 'notifications': return <NotificationsScreen />;
      case 'support': return <SupportScreen />;
      case 'aadhaar-mock-test': return <AadhaarMockTestScreen />;
      case 'agreement': return <AgreementScreen />;
      default: return <MobilePlaceholder screen={screen} />;
    }
  };

  return (
    <div className="granvia-mobile flex flex-col w-full h-full" style={{ background: '#f1f5f9' }}>
      {/* Scrollable content area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto mobile-scroll"
        style={{ paddingBottom: 94 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating mobile-app navigation: four primary icons plus More. */}
      <nav
        className="mobile-bottom-nav fixed bottom-2 left-3 right-3 z-50 grid grid-cols-5 items-center rounded-3xl border border-white/80 bg-white/95 px-1.5 py-1.5 backdrop-blur-xl"
        style={{ boxShadow: '0 10px 32px rgba(15,30,60,0.18)', paddingBottom: 'max(env(safe-area-inset-bottom, 6px), 6px)' }}
      >
        {NAV_ITEMS.map(item => {
          const active = screen === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => goTo(item.id)}
              className="mobile-touch-interactive flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5"
              whileTap={{ scale: 0.9 }}
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: active ? 'rgba(139,26,26,0.08)' : '#f8fafc', color: active ? '#8b1a1a' : '#94a3b8' }}>{item.icon}</span>
              <span className="max-w-full truncate text-[9px] font-bold" style={{ color: active ? '#0f1e3c' : '#94a3b8' }}>{item.label}</span>
            </motion.button>
          );
        })}
        <motion.button
          onClick={() => setMenuOpen(true)}
          className="mobile-touch-interactive flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5"
          whileTap={{ scale: 0.9 }}
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: MORE_ITEMS.some(item => item.id === screen) ? 'rgba(139,26,26,0.08)' : '#f8fafc', color: MORE_ITEMS.some(item => item.id === screen) ? '#8b1a1a' : '#94a3b8' }}><MoreHorizontal size={20} /></span>
          <span className="text-[9px] font-bold" style={{ color: MORE_ITEMS.some(item => item.id === screen) ? '#0f1e3c' : '#94a3b8' }}>More</span>
        </motion.button>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-[70] flex items-end">
            <motion.button aria-label="Close menu" className="absolute inset-0 h-full w-full" style={{ background: 'rgba(10,22,40,0.48)', backdropFilter: 'blur(3px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
            <motion.section
              className="relative w-full overflow-y-auto rounded-t-[28px] bg-[#f8fafc] px-4 pb-4"
              style={{ maxHeight: '86vh', paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)', boxShadow: '0 -18px 50px rgba(15,30,60,0.22)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="flex justify-center py-3"><div className="h-1 w-10 rounded-full bg-slate-300" /></div>
              <div className="mb-4 flex items-center justify-between">
                <div><h2 className="text-lg font-bold text-slate-900">More options</h2><p className="text-xs text-slate-500">Associate Partner app</p></div>
                <button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-500 shadow-sm"><X size={19} /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {MORE_ITEMS.map(item => {
                  const active = screen === item.id;
                  return (
                    <motion.button key={item.id} onClick={() => goTo(item.id)} whileTap={{ scale: 0.96 }} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-3 text-center shadow-sm" style={{ borderColor: active ? 'rgba(139,26,26,0.35)' : '#eef2f7' }}>
                      <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: active ? 'rgba(139,26,26,0.08)' : '#f1f5f9', color: active ? '#8b1a1a' : '#475569' }}>{item.icon}</span>
                      <span className="line-clamp-2 text-[11px] font-bold leading-tight text-slate-700">{item.label}</span>
                    </motion.button>
                  );
                })}
                <motion.button onClick={handleLogout} whileTap={{ scale: 0.96 }} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white p-3 text-center shadow-sm">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-700"><LogOut size={20} /></span>
                  <span className="text-[11px] font-bold text-red-700">Logout</span>
                </motion.button>
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
