// Shared mobile chrome for the universal app.
//
// Layout rules (per product spec):
//  - Four primary links live in a floating card-style bottom navigation bar.
//  - A fifth "More" action opens a touch-first icon-card menu for every
//    remaining/master link and Logout.
//  - The top-left app-grid button opens that same mobile menu; no desktop-style
//    side drawer is used in the app shell.
//
// Every role's existing App reuses this component in its `layout="mobile"`
// branch, so no page markup is duplicated — only the chrome is swapped.
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid3X3, MoreHorizontal, X, LogOut } from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';

export interface MobileNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** When true, the item is shown in the More icon-card menu. */
  master?: boolean;
}

interface MobileChromeProps {
  /** Short role label shown in the top bar / app-menu header (e.g. "Sub Admin"). */
  brandLabel: string;
  /** Title of the currently active page. */
  title: string;
  /** Optional subtitle under the title (e.g. active company). */
  subtitle?: string;
  navItems: MobileNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  /** Accent colour for the active state — keeps each role's palette. */
  accent?: string;
  /** Optional element rendered on the right of the top bar (e.g. company switcher). */
  headerRight?: ReactNode;
  children: ReactNode;
}

export default function MobileChrome({
  brandLabel,
  title,
  subtitle,
  navItems,
  activeId,
  onNavigate,
  onLogout,
  accent = '#8b1a1a',
  headerRight,
  children,
}: MobileChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const masterItems = navItems.filter(i => i.master);
  const bottomItems = navItems.filter(i => !i.master);
  const primaryItems = bottomItems.slice(0, 4);
  const menuItems = [...bottomItems.slice(4), ...masterItems];
  const menuIsActive = menuItems.some(item => item.id === activeId);

  const go = (id: string) => {
    onNavigate(id);
    setMenuOpen(false);
  };

  return (
    <div className="granvia-mobile flex flex-col w-full h-full" style={{ background: '#f1f5f9' }}>
      {/* Compact app top bar; the grid button opens the same menu as More. */}
      <header
        className="flex items-center gap-2 px-3 flex-shrink-0 z-40"
        style={{
          background: 'white',
          borderBottom: '1px solid #eef2f7',
          paddingTop: 'max(env(safe-area-inset-top, 8px), 8px)',
          paddingBottom: 8,
          minHeight: 52,
        }}
      >
        <motion.button
          onClick={() => setMenuOpen(true)}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center rounded-xl mobile-touch-interactive"
          style={{ width: 38, height: 38, background: '#f4f6fa', color: '#0f1e3c' }}
          aria-label="Open app menu"
        >
          <Grid3X3 size={18} />
        </motion.button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold truncate" style={{ color: '#0f1e3c' }}>{title}</div>
          <div className="text-[10px] truncate" style={{ color: '#94a3b8' }}>
            {subtitle ?? brandLabel}
          </div>
        </div>
        {headerRight}
      </header>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden mobile-scroll" style={{ paddingBottom: primaryItems.length ? 94 : 12 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating app-style bottom navigation. */}
      {primaryItems.length > 0 && (
        <nav
          className="fixed bottom-2 left-3 right-3 z-40 flex items-center rounded-3xl border border-white/80 bg-white/95 px-1.5 py-1.5 backdrop-blur-xl"
          style={{
            boxShadow: '0 10px 32px rgba(15,30,60,0.18)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 6px), 6px)',
          }}
        >
          {primaryItems.map(item => {
            const active = activeId === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                whileTap={{ scale: 0.9 }}
                className="mobile-touch-interactive flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5"
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-xl"
                  style={{ background: active ? `${accent}14` : '#f8fafc', color: active ? accent : '#94a3b8' }}
                >
                  {item.icon}
                </span>
                <span className="max-w-full truncate text-[9px] font-bold" style={{ color: active ? '#0f1e3c' : '#94a3b8' }}>{item.label}</span>
              </motion.button>
            );
          })}
          <motion.button
            onClick={() => setMenuOpen(true)}
            whileTap={{ scale: 0.9 }}
            className="mobile-touch-interactive flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: menuIsActive ? `${accent}14` : '#f8fafc', color: menuIsActive ? accent : '#94a3b8' }}>
              <MoreHorizontal size={20} />
            </span>
            <span className="text-[9px] font-bold" style={{ color: menuIsActive ? '#0f1e3c' : '#94a3b8' }}>More</span>
          </motion.button>
        </nav>
      )}

      {/* Mobile app menu — icon cards instead of a desktop-style side drawer. */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-[70] flex items-end">
            <motion.button
              aria-label="Close menu"
              className="absolute inset-0 h-full w-full"
              style={{ background: 'rgba(10,22,40,0.48)', backdropFilter: 'blur(3px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.section
              className="relative w-full overflow-y-auto rounded-t-[28px] bg-[#f8fafc] px-4 pb-4"
              style={{ maxHeight: '86vh', paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)', boxShadow: '0 -18px 50px rgba(15,30,60,0.22)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="flex justify-center py-3"><div className="h-1 w-10 rounded-full bg-slate-300" /></div>
              <div className="mb-4 flex items-center justify-between">
                <div><GranviaLogo size={25} accentColor={accent} /><p className="mt-1 text-xs text-slate-500">{brandLabel} options</p></div>
                <button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-500 shadow-sm"><X size={19} /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {menuItems.map(item => {
                  const active = activeId === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => go(item.id)}
                      whileTap={{ scale: 0.96 }}
                      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-3 text-center shadow-sm"
                      style={{ borderColor: active ? `${accent}55` : '#eef2f7' }}
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: active ? `${accent}14` : '#f1f5f9', color: active ? accent : '#475569' }}>{item.icon}</span>
                      <span className="line-clamp-2 text-[11px] font-bold leading-tight text-slate-700">{item.label}</span>
                    </motion.button>
                  );
                })}
                <motion.button onClick={onLogout} whileTap={{ scale: 0.96 }} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white p-3 text-center shadow-sm">
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
