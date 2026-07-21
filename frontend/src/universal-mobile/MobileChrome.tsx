// Shared mobile chrome for the universal app.
//
// Layout rules (per product spec):
//  - Nav items flagged `master: true` are "master entry" links → they move into
//    a top-left breadcrumb / drawer menu (opened via the hamburger).
//  - All remaining items live in the fixed bottom navigation bar, which scrolls
//    horizontally when the items exceed the screen width.
//  - Logout always lives in the drawer.
//
// Every role's existing App reuses this component in its `layout="mobile"`
// branch, so no page markup is duplicated — only the chrome is swapped.
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, ChevronRight } from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';

export interface MobileNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** When true, the item is a "master entry" and is shown in the top-left drawer. */
  master?: boolean;
}

interface MobileChromeProps {
  /** Short role label shown in the top bar / drawer header (e.g. "Sub Admin"). */
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const masterItems = navItems.filter(i => i.master);
  const bottomItems = navItems.filter(i => !i.master);

  const go = (id: string) => {
    onNavigate(id);
    setDrawerOpen(false);
  };

  return (
    <div className="granvia-mobile flex flex-col w-full h-full" style={{ background: '#f1f5f9' }}>
      {/* Top bar with breadcrumb menu button */}
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
          onClick={() => setDrawerOpen(true)}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center rounded-xl mobile-touch-interactive"
          style={{ width: 38, height: 38, background: '#f4f6fa', color: '#0f1e3c' }}
          aria-label="Open menu"
        >
          <Menu size={19} />
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden mobile-scroll" style={{ paddingBottom: bottomItems.length ? 78 : 12 }}>
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

      {/* Bottom navigation — horizontally scrollable when items overflow */}
      {bottomItems.length > 0 && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center overflow-x-auto mobile-scroll no-scrollbar"
          style={{
            background: 'white',
            boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
            borderTop: '1px solid #f1f5f9',
            paddingTop: 6,
            paddingBottom: 'max(env(safe-area-inset-bottom, 6px), 6px)',
            minHeight: 64,
          }}
        >
          <div className="flex items-center gap-0.5 px-1 mx-auto" style={{ minWidth: '100%', justifyContent: bottomItems.length <= 5 ? 'space-around' : 'flex-start' }}>
            {bottomItems.map(item => {
              const active = activeId === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  whileTap={{ scale: 0.88 }}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-2xl relative flex-shrink-0 mobile-touch-interactive"
                  style={{
                    minWidth: 60,
                    minHeight: 48,
                    background: active ? 'rgba(15,30,60,0.07)' : 'transparent',
                    borderRadius: 16,
                    padding: '6px 8px',
                  }}
                >
                  <span style={{ color: active ? accent : '#94a3b8', transition: 'color 0.15s' }}>{item.icon}</span>
                  <span className="font-semibold text-center leading-tight" style={{ color: active ? '#0f1e3c' : '#94a3b8', fontSize: 10 }}>
                    {item.label}
                  </span>
                  {active && (
                    <motion.div
                      className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: accent }}
                      layoutId="universalNavDot"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Top-left breadcrumb / master-entry drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[70]">
            <motion.div
              className="absolute inset-0"
              style={{ background: 'rgba(10,22,40,0.5)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="absolute top-0 left-0 h-full flex flex-col"
              style={{ width: 'min(82%, 320px)', background: 'linear-gradient(180deg, #0a1628, #0f1e3c 60%, #120a0a)' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}>
                <div>
                  <GranviaLogo size={26} textColor="white" accentColor={accent} />
                  <p className="text-[11px] text-white/50 mt-1.5 pl-0.5">{brandLabel}</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="text-white/60 hover:text-white -mr-1"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {masterItems.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 px-2 pt-1 pb-1">Master Entry</p>
                )}
                {masterItems.map(item => {
                  const active = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                      style={{
                        color: active ? 'white' : 'rgba(255,255,255,0.6)',
                        background: active ? `linear-gradient(135deg, ${accent}, ${accent}88)` : 'transparent',
                      }}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="truncate text-left flex-1">{item.label}</span>
                      <ChevronRight size={15} className="opacity-40" />
                    </button>
                  );
                })}

                {bottomItems.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 px-2 pt-3 pb-1">Quick Access</p>
                    {bottomItems.map(item => {
                      const active = activeId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => go(item.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                          style={{
                            color: active ? 'white' : 'rgba(255,255,255,0.55)',
                            background: active ? `linear-gradient(135deg, ${accent}, ${accent}88)` : 'transparent',
                          }}
                        >
                          <span className="flex-shrink-0">{item.icon}</span>
                          <span className="truncate text-left flex-1">{item.label}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              <div className="p-3 border-t border-white/10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)' }}>
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-red-900/30">
                  <LogOut size={18} /> Logout
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
