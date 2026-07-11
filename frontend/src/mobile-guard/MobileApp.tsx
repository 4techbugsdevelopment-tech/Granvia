import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Search, Clock, User, MoreHorizontal, LogOut } from 'lucide-react';
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
import { signOut } from '../services/authService';

interface MobileAppProps {
  onLogout: () => void;
}

type Screen =
  | 'dashboard' | 'jobs' | 'attendance' | 'profile' | 'applications'
  | 'wallet' | 'availability' | 'notifications' | 'support' | 'settings' | 'accepted-jobs' | 'agreement' | 'transactions';

const NAV_ITEMS = [
  { id: 'dashboard' as Screen, icon: <LayoutDashboard size={20} />, label: 'Home' },
  { id: 'jobs' as Screen, icon: <Search size={20} />, label: 'Jobs' },
  { id: 'attendance' as Screen, icon: <Clock size={20} />, label: 'Attend.' },
  { id: 'profile' as Screen, icon: <User size={20} />, label: 'Profile' },
  { id: 'applications' as Screen, icon: <MoreHorizontal size={20} />, label: 'Applied' },
];

export default function MobileApp({ onLogout }: MobileAppProps) {
  const [screen, setScreen] = useState<Screen>('dashboard');

  const handleLogout = () => {
    signOut().finally(onLogout);
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
      default: return <MobilePlaceholder screen={screen} />;
    }
  };

  return (
    <div className="granvia-mobile flex flex-col w-full h-full" style={{ background: '#f1f5f9' }}>
      {/* Scrollable content area */}
      <div
        className="flex-1 overflow-y-auto mobile-scroll"
        style={{ paddingBottom: 80 }}
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

      {/* Fixed bottom navigation */}
      <div
        className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1"
        style={{
          background: 'white',
          boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
          borderTop: '1px solid #f1f5f9',
          paddingTop: 6,
          paddingBottom: 'max(env(safe-area-inset-bottom, 6px), 6px)',
          height: 'auto',
          minHeight: 64,
        }}
      >
        {NAV_ITEMS.map(item => {
          const active = screen === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-2xl relative mobile-touch-interactive"
              whileTap={{ scale: 0.88 }}
              style={{
                minWidth: 56,
                minHeight: 48,
                background: active ? 'rgba(15,30,60,0.07)' : 'transparent',
                borderRadius: 16,
                padding: '6px 8px',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ color: active ? '#0f1e3c' : '#94a3b8', transition: 'color 0.15s' }}>{item.icon}</span>
              <span
                className="font-semibold"
                style={{ color: active ? '#0f1e3c' : '#94a3b8', fontSize: 10, transition: 'color 0.15s' }}
              >
                {item.label}
              </span>
              {active && (
                <motion.div
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: '#8b1a1a' }}
                  layoutId="navDot"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
        <motion.button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl mobile-touch-interactive"
          whileTap={{ scale: 0.88 }}
          style={{ minWidth: 56, minHeight: 48, padding: '6px 8px' }}
        >
          <LogOut size={20} style={{ color: '#94a3b8' }} />
          <span className="font-semibold" style={{ color: '#94a3b8', fontSize: 10 }}>Logout</span>
        </motion.button>
      </div>
    </div>
  );
}
