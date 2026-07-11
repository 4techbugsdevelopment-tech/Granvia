// Admin settings (demo — settings persistence API pending)
import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Percent } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Card } from './_adminUi';

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="w-11 h-6 rounded-full relative transition-colors" style={{ background: on ? '#166534' : '#cbd5e1' }}>
      <motion.div className="w-5 h-5 rounded-full bg-white absolute top-0.5" animate={{ left: on ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
    </button>
  );
}

export default function SettingsPage() {
  const { profile } = useAuth();
  const [toggles, setToggles] = useState({ emailAlerts: true, smsAlerts: false, twoFactor: false, autoApproveJobs: false });
  const [commission, setCommission] = useState('12');
  const flip = (k: keyof typeof toggles) => setToggles(t => ({ ...t, [k]: !t[k] }));

  return (
    <motion.div className="p-6 max-w-3xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Settings" subtitle="Admin profile and platform configuration" />

      <Card className="mb-5">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><User size={16} style={{ color: '#8b1a1a' }} /> Admin Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><div className="text-xs text-gray-400">Name</div><div className="text-sm font-semibold text-gray-800 mt-0.5">{profile?.full_name || 'Super Admin'}</div></div>
          <div><div className="text-xs text-gray-400">Email</div><div className="text-sm font-semibold text-gray-800 mt-0.5">{profile?.email || '—'}</div></div>
          <div><div className="text-xs text-gray-400">Role</div><div className="text-sm font-semibold text-gray-800 mt-0.5">Super Admin</div></div>
          <div><div className="text-xs text-gray-400">Mobile</div><div className="text-sm font-semibold text-gray-800 mt-0.5">{profile?.mobile || '—'}</div></div>
        </div>
      </Card>

      <Card className="mb-5">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Bell size={16} style={{ color: '#8b1a1a' }} /> Notifications</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><span className="text-sm text-gray-700">Email alerts</span><Toggle on={toggles.emailAlerts} onChange={() => flip('emailAlerts')} /></div>
          <div className="flex items-center justify-between"><span className="text-sm text-gray-700">SMS alerts</span><Toggle on={toggles.smsAlerts} onChange={() => flip('smsAlerts')} /></div>
        </div>
      </Card>

      <Card className="mb-5">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Shield size={16} style={{ color: '#8b1a1a' }} /> Security</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><span className="text-sm text-gray-700">Two-factor authentication</span><Toggle on={toggles.twoFactor} onChange={() => flip('twoFactor')} /></div>
          <div className="flex items-center justify-between"><span className="text-sm text-gray-700">Auto-approve new jobs</span><Toggle on={toggles.autoApproveJobs} onChange={() => flip('autoApproveJobs')} /></div>
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Percent size={16} style={{ color: '#8b1a1a' }} /> Platform Configuration</h2>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Default commission rate (%)</label>
        <div className="flex items-center gap-3">
          <input value={commission} onChange={e => setCommission(e.target.value)} type="number"
            className="w-32 px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />
          <button className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>Save</button>
        </div>
      </Card>
    </motion.div>
  );
}
