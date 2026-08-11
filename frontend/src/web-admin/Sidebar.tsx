import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Briefcase, Clock, GitBranch,
  Wallet, BarChart3, Settings, LogOut, ChevronDown, Shield, Mail
} from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';

export type AdminPage =
  | 'dashboard'
  | 'guards'
  | 'add-guard'
  | 'employers'
  | 'jobs'
  | 'attendance'
  | 'hiring'
  | 'wallet'
  | 'reports'
  | 'email-logs'
  | 'roles'
  | 'settings';

interface SidebarProps {
  currentPage: AdminPage;
  onNavigate: (page: AdminPage) => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  id: AdminPage;
  label: string;
  icon: React.ReactNode;
  children?: { id: AdminPage; label: string }[];
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  {
    id: 'guards', label: 'Associate Management', icon: <Shield size={18} />,
    children: [
      { id: 'guards', label: 'Associate List' },
      { id: 'add-guard', label: 'Add Associate' },
    ],
  },
  { id: 'employers', label: 'Employer Management', icon: <Building2 size={18} /> },
  { id: 'jobs', label: 'Job Management', icon: <Briefcase size={18} /> },
  { id: 'attendance', label: 'Attendance', icon: <Clock size={18} /> },
  { id: 'hiring', label: 'Hiring Workflow', icon: <GitBranch size={18} /> },
  { id: 'wallet', label: 'Wallet & Payments', icon: <Wallet size={18} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={18} /> },
  { id: 'email-logs', label: 'Email Logs', icon: <Mail size={18} /> },
  { id: 'roles', label: 'Role Master', icon: <Shield size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];

export default function Sidebar({ currentPage, onNavigate, onLogout, collapsed, onToggle }: SidebarProps) {
  const [expanded, setExpanded] = useState<string | null>('guards');

  const isActive = (id: AdminPage) => {
    if (id === 'guards') return currentPage === 'guards' || currentPage === 'add-guard';
    return currentPage === id;
  };

  return (
    <motion.aside
      className="h-screen flex flex-col fixed top-0 left-0 z-50"
      style={{
        background: 'linear-gradient(180deg, #0a1628 0%, #0f1e3c 60%, #120a0a 100%)',
        boxShadow: '4px 0 20px rgba(0,0,0,0.15)',
      }}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <GranviaLogo size={32} textColor="white" accentColor="#8b1a1a" />
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="mx-auto">
            <GranviaLogo size={28} showText={false} iconColor="white" accentColor="#8b1a1a" />
          </div>
        )}
        {!collapsed && (
          <button onClick={onToggle} className="text-white/40 hover:text-white/70 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {collapsed && (
          <button onClick={onToggle} className="absolute right-0 top-5 bg-white/10 rounded-l-none rounded-r-md p-1.5 text-white/60 hover:text-white transition-colors" style={{ right: -28 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19l7-7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map(item => (
          <div key={item.id}>
            <motion.button
              onClick={() => {
                if (item.children) {
                  setExpanded(expanded === item.id ? null : item.id);
                  if (!collapsed) return;
                }
                onNavigate(item.id);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group"
              style={{
                color: isActive(item.id) ? 'white' : 'rgba(255,255,255,0.55)',
                background: isActive(item.id) ? 'linear-gradient(135deg, rgba(139,26,26,0.6), rgba(139,26,26,0.3))' : 'transparent',
              }}
              whileHover={{
                background: isActive(item.id)
                  ? 'linear-gradient(135deg, rgba(139,26,26,0.7), rgba(139,26,26,0.4))'
                  : 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              {/* Active indicator */}
              {isActive(item.id) && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-red-400"
                  layoutId="activeIndicator"
                />
              )}

              <span className="flex-shrink-0">{item.icon}</span>

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    className="flex-1 text-left truncate"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {!collapsed && item.badge && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-700 text-white font-bold">
                  {item.badge}
                </span>
              )}

              {!collapsed && item.children && (
                <motion.span
                  animate={{ rotate: expanded === item.id ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={14} />
                </motion.span>
              )}

              {/* Tooltip when collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                  style={{ background: '#0f1e3c', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  {item.label}
                </div>
              )}
            </motion.button>

            {/* Sub items */}
            <AnimatePresence>
              {!collapsed && item.children && expanded === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden ml-6 mt-0.5 space-y-0.5"
                >
                  {item.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => onNavigate(child.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                      style={{
                        color: currentPage === child.id ? 'white' : 'rgba(255,255,255,0.45)',
                        background: currentPage === child.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = currentPage === child.id ? 'rgba(255,255,255,0.1)' : 'transparent'; (e.target as HTMLElement).style.color = currentPage === child.id ? 'white' : 'rgba(255,255,255,0.45)'; }}
                    >
                      <div className="w-1 h-1 rounded-full bg-current opacity-60" />
                      {child.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <motion.button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          whileHover={{ background: 'rgba(139,26,26,0.3)', color: '#fca5a5' }}
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </motion.button>
      </div>
    </motion.aside>
  );
}
