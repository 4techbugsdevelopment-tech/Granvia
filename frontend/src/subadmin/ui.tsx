// Shared presentational primitives for the Sub Admin module.
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { BROWN, NAVY, statusTone } from './theme';

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
export function GlassStat({ label, value, sub, icon, accent = NAVY }: {
  label: string; value: string; sub?: string; icon?: ReactNode; accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 8px 30px rgba(26,43,86,0.10)',
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
    <div className={`rounded-2xl p-6 ${className}`} style={{ background: 'white', boxShadow: '0 2px 16px rgba(26,43,86,0.06)', border: '1px solid #ece7e3' }}>
      {children}
    </div>
  );
}

export function Pill({ label }: { label: string }) {
  const t = statusTone(label);
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ color: t.color, background: t.bg }}>{label}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
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

/**
 * "Information Sliding" right-hand panel — used for CRUD forms and document viewers.
 * Slides in from the right over a dimmed backdrop.
 */
export function SlideOver({ open, onClose, title, subtitle, width = 460, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
}) {
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
