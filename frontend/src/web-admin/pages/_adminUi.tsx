// Shared presentational helpers for admin pages.
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`} style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <motion.div
      className="rounded-2xl p-5"
      style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-xs text-gray-400 font-medium">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </motion.div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {headers.map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Pill({ label, tone }: { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'gray' }) {
  const map = {
    green: { color: '#166534', bg: '#dcfce7' },
    red: { color: '#7c2d12', bg: '#fee2e2' },
    amber: { color: '#854d0e', bg: '#fef9c3' },
    blue: { color: '#1d4ed8', bg: '#dbeafe' },
    gray: { color: '#64748b', bg: '#f1f5f9' },
  }[tone];
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: map.color, background: map.bg }}>{label}</span>;
}
