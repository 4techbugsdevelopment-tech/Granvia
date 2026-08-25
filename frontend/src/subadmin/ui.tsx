// Shared presentational primitives for the Sub Admin module.
//
// These primitives are **layout-aware**: in the desktop web portal they render
// the classic admin chrome (right slide-over panels, big page titles); inside the
// universal mobile app (`/app`) they render the guide's mobile patterns (bottom
// sheets, compact headers that don't duplicate MobileChrome's top bar). The role's
// navy/burgundy brand palette is kept in both — only the structure adapts.
// See docs/UNIVERSAL_APP_UI_GUIDE.md.
import { createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { BROWN, NAVY, statusTone } from './theme';

/** Which shell the sub-admin pages are rendering inside. */
export type AppLayout = 'desktop' | 'mobile';
const LayoutContext = createContext<AppLayout>('desktop');

/** Wrap the page tree so the primitives below know which shell they're in. */
export function AppLayoutProvider({ value, children }: { value: AppLayout; children: ReactNode }) {
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

/** Read the active layout ('desktop' by default). */
export function useAppLayout(): AppLayout {
  return useContext(LayoutContext);
}

/** Button with a subtle scale-down on tap. */
export function TapButton({
  children, onClick, disabled, variant = 'primary', className = '', style, type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'navy' | 'ghost' | 'danger';
  className?: string;
  style?: React.CSSProperties;
  type?: 'button' | 'submit';
}) {
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg, #7A2621, #99332b)', color: 'white' },
    navy: { background: NAVY, color: 'white' },
    danger: { background: 'linear-gradient(135deg, #7A2621, #99332b)', color: 'white' },
    ghost: { background: 'transparent', color: BROWN, border: `1.5px solid rgba(75,46,42,0.25)` },
  };
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ ...variants[variant], ...style }}
    >
      {children}
    </motion.button>
  );
}

/** Frosted "glassmorphism" stat widget. */
export function GlassStat({ label, value, sub, icon, accent = NAVY, onClick }: {
  label: string; value: string; sub?: string; icon?: ReactNode; accent?: string; onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -3, scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Open ${label}` : undefined}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      className={`relative overflow-hidden rounded-2xl p-5 ${onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2' : ''}`}
      style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 8px 30px rgba(26,43,86,0.10)',
        ...(onClick ? { outlineColor: accent } : {}),
      }}
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ background: accent, opacity: 0.10 }} />
      {icon && (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: accent, color: 'white' }}>
          {icon}
        </div>
      )}
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(75,46,42,0.6)' }}>{label}</div>
      <div className="text-2xl font-extrabold mt-1" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'rgba(75,46,42,0.55)' }}>{sub}</div>}
    </motion.div>
  );
}

/** Plain white content card. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 md:p-6 ${className}`} style={{ background: 'white', boxShadow: '0 2px 16px rgba(26,43,86,0.06)', border: '1px solid #ece7e3' }}>
      {children}
    </div>
  );
}

export function Pill({ label }: { label: string }) {
  const t = statusTone(label);
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ color: t.color, background: t.bg }}>{label}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const layout = useAppLayout();

  // On mobile the page title already lives in MobileChrome's top bar, so we skip
  // the big duplicate <h1> and render only the subtitle + action as a compact row.
  if (layout === 'mobile') {
    if (!subtitle && !action) return null;
    return (
      <div className="flex flex-col items-stretch justify-between gap-3 mb-4 sm:flex-row sm:items-center [&_button]:w-full sm:[&_button]:w-auto">
        {subtitle ? (
          <p className="text-xs leading-snug" style={{ color: 'rgba(75,46,42,0.6)' }}>{subtitle}</p>
        ) : <span />}
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: 'rgba(75,46,42,0.6)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 2px 16px rgba(26,43,86,0.06)', border: '1px solid #ece7e3' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#faf8f6', borderBottom: '1px solid #ece7e3' }}>
              {headers.map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'rgba(75,46,42,0.55)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Page wrapper: tighter padding on mobile (guide §3), roomy on the desktop portal. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const layout = useAppLayout();
  return <div className={`${layout === 'mobile' ? 'px-4 py-4' : 'p-6'} ${className}`}>{children}</div>;
}

export interface DataColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Mobile: this column is the card's bold title. Desktop: rendered bold-navy. */
  primary?: boolean;
  /** Mobile: rendered as a full-width footer row (no label) — for row action buttons. */
  actions?: boolean;
  /** Mobile: value spans both grid columns (for chip lists / long text). */
  wide?: boolean;
}

/**
 * Layout-aware data collection. Renders the classic desktop table in the web
 * portal and reflows into the guide's list-card pattern (§5.4) on mobile — one
 * card per row: primary column as the title, the rest as a label/value grid, and
 * any `actions` column as a full-width footer. Keeps the role's navy/brown palette.
 */
export function DataTable<T>({ columns, rows, rowKey, empty }: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  const layout = useAppLayout();
  const emptyMsg = empty ?? 'No records.';

  if (layout === 'mobile') {
    if (rows.length === 0) {
      return (
        <div className="rounded-2xl px-4 py-8 text-center text-sm"
          style={{ background: 'white', border: '1px solid #ece7e3', color: 'rgba(75,46,42,0.5)' }}>
          {emptyMsg}
        </div>
      );
    }
    const primary = columns.find(c => c.primary) ?? columns[0];
    const bodyCols = columns.filter(c => c !== primary && !c.actions);
    const actionCols = columns.filter(c => c.actions);
    return (
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <motion.div
            key={rowKey(row)}
            className="rounded-2xl p-4"
            style={{ background: 'white', boxShadow: '0 2px 12px rgba(26,43,86,0.07)', border: '1px solid #ece7e3' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}
          >
            <div className="text-sm font-bold mb-2.5" style={{ color: NAVY }}>{primary.cell(row)}</div>
            {bodyCols.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                {bodyCols.map((c, ci) => (
                  <div key={ci} className={`min-w-0 ${c.wide ? 'col-span-2' : ''}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(75,46,42,0.45)' }}>{c.header}</div>
                    <div className="break-words text-sm" style={{ color: BROWN }}>{c.cell(row)}</div>
                  </div>
                ))}
              </div>
            )}
            {actionCols.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #f1ece8' }}>
                {actionCols.map((c, ci) => <div key={ci} className="flex-1">{c.cell(row)}</div>)}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <Table headers={columns.map(c => c.header)}>
      {rows.length === 0 ? (
        <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>{emptyMsg}</td></tr>
      ) : rows.map(row => (
        <tr key={rowKey(row)} className="border-b hover:bg-[#faf8f6]" style={{ borderColor: '#f1ece8' }}>
          {columns.map((c, ci) => (
            <td key={ci} className={`px-4 py-3.5 text-sm ${c.primary ? 'font-semibold' : ''}`} style={{ color: c.primary ? NAVY : BROWN }}>
              {c.cell(row)}
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

/**
 * "Information Sliding" right-hand panel — used for CRUD forms and document viewers.
 * Slides in from the right over a dimmed backdrop.
 */
export function SlideOver({ open, onClose, title, subtitle, width = 460, page = false, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  page?: boolean;
  children: ReactNode;
}) {
  const layout = useAppLayout();

  if (page) {
    return (
      <AnimatePresence>
        {open && (
          <motion.section className="fixed inset-0 z-[60] overflow-y-auto bg-[#f5f1ee] mobile-scroll" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }}>
            <div className="mx-auto w-full max-w-4xl p-4 md:p-6">
              <button type="button" onClick={onClose} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold shadow-sm" style={{ color: NAVY }}><ArrowLeft size={17} /> Back to List</button>
              <Card>
                <div className="mb-5"><h1 className="text-xl font-bold" style={{ color: NAVY }}>{title}</h1>{subtitle && <p className="mt-1 text-sm" style={{ color: 'rgba(75,46,42,0.6)' }}>{subtitle}</p>}</div>
                {children}
              </Card>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    );
  }

  // Mobile: the "Information Sliding" panel becomes a bottom sheet (guide §5.6) —
  // grab handle, spring-up, tap-scrim-to-close, safe-area bottom padding.
  if (layout === 'mobile') {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end"
            style={{ background: 'rgba(15,27,56,0.45)', backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="w-full rounded-t-3xl bg-white flex flex-col"
              style={{ maxHeight: '90vh', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <div className="flex items-start justify-between px-5 pt-1 pb-3">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: NAVY }}>{title}</h2>
                  {subtitle && <p className="text-xs mt-0.5" style={{ color: 'rgba(75,46,42,0.6)' }}>{subtitle}</p>}
                </div>
                <button onClick={onClose} className="-mr-1" style={{ color: BROWN }}><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-2 mobile-scroll">{children}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(15,27,56,0.45)', backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute top-0 right-0 h-full flex flex-col bg-white shadow-2xl"
            style={{ width: `min(${width}px, 100%)` }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            <div className="flex items-start justify-between px-6 py-5" style={{ background: NAVY }}>
              <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {subtitle && <p className="text-xs mt-0.5 text-white/70">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="text-white/70 hover:text-white -mr-1"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Labeled text input matching the Sub Admin form style. */
export function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none focus:ring-2 transition-shadow"
        style={{ border: '1.5px solid #e6ddd8', background: '#faf8f6', color: BROWN }}
      />
    </div>
  );
}
