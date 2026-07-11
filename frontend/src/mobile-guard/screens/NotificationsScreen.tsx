// NotificationsScreen — guard notifications (demo data; API pending)
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Briefcase, Wallet, ShieldCheck, Info, CheckCheck } from 'lucide-react';
import { demoNotifications, DemoNotification } from '../../lib/demoData';

const ICONS: Record<DemoNotification['kind'], JSX.Element> = {
  job: <Briefcase size={16} />,
  payment: <Wallet size={16} />,
  verification: <ShieldCheck size={16} />,
  system: <Info size={16} />,
};
const COLORS: Record<DemoNotification['kind'], string> = {
  job: '#1d4ed8', payment: '#166534', verification: '#7c2d12', system: '#0f1e3c',
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<DemoNotification[]>(demoNotifications);

  const markAllRead = () => setItems(prev => prev.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const unread = items.filter(n => !n.read).length;

  return (
    <div className="pb-6">
      <div
        className="px-4 pt-5 pb-6"
        style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)', paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl mb-1">Notifications</h1>
            <p className="text-blue-200 text-xs">{unread} unread</p>
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-2">
        {items.map((n, i) => (
          <motion.button
            key={n.id}
            onClick={() => markRead(n.id)}
            className="w-full flex gap-3 items-start rounded-2xl p-4 text-left"
            style={{ background: n.read ? 'white' : '#f0f6ff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${COLORS[n.kind]}15`, color: COLORS[n.kind] }}>
              {ICONS[n.kind]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">{n.title}</p>
                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>
              <p className="text-xs text-gray-400 mt-1">{n.time}</p>
            </div>
          </motion.button>
        ))}
        {items.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}
