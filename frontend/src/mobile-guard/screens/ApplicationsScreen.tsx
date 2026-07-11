// ApplicationsScreen — guard's job applications backed by the Laravel API
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, Clock, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';
import { listMyApplications } from '../../services/applicationService';

const STATUS_CONFIG: Record<string, { icon: JSX.Element; color: string; bg: string; label: string }> = {
  applied: { icon: <Loader size={14} />, color: '#854d0e', bg: '#fef9c3', label: 'Applied' },
  viewed: { icon: <Loader size={14} />, color: '#075985', bg: '#e0f2fe', label: 'Viewed' },
  shortlisted: { icon: <CheckCircle size={14} />, color: '#1d4ed8', bg: '#dbeafe', label: 'Shortlisted' },
  selected: { icon: <CheckCircle size={14} />, color: '#166534', bg: '#dcfce7', label: 'Selected' },
  offer_sent: { icon: <CheckCircle size={14} />, color: '#166534', bg: '#dcfce7', label: 'Offer Sent' },
  accepted: { icon: <CheckCircle size={14} />, color: '#166534', bg: '#dcfce7', label: 'Accepted' },
  joined: { icon: <CheckCircle size={14} />, color: '#166534', bg: '#dcfce7', label: 'Joined' },
  completed: { icon: <CheckCircle size={14} />, color: '#166534', bg: '#dcfce7', label: 'Completed' },
  declined: { icon: <XCircle size={14} />, color: '#7c2d12', bg: '#fee2e2', label: 'Declined' },
  cancelled: { icon: <XCircle size={14} />, color: '#7c2d12', bg: '#fee2e2', label: 'Cancelled' },
  rejected: { icon: <XCircle size={14} />, color: '#7c2d12', bg: '#fee2e2', label: 'Rejected' },
};

const FALLBACK_STATUS = { icon: <Loader size={14} />, color: '#64748b', bg: '#f1f5f9', label: 'Pending' };

export default function ApplicationsScreen() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyApplications()
      .then(data => setApps(data ?? []))
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-6">
      {/* Header */}
      <div
        className="px-4 pt-5 pb-5"
        style={{
          background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)',
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        }}
      >
        <h1 className="text-white font-bold text-xl">My Applications</h1>
        <p className="text-blue-200 text-xs mt-1">
          {loading ? 'Loading…' : `${apps.length} application${apps.length !== 1 ? 's' : ''} submitted`}
        </p>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs">
          <AlertCircle size={13} className="flex-shrink-0" />{error}
        </div>
      )}

      <div className="px-4 mt-4 space-y-2.5">
        {loading ? (
          <div className="text-center py-16">
            <motion.div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600 mx-auto" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
            <p className="text-gray-400 text-sm mt-3">Loading applications…</p>
          </div>
        ) : apps.length === 0 ? (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Briefcase size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 font-medium">No applications yet</p>
            <p className="text-gray-300 text-sm mt-1">Browse jobs and apply to get started</p>
          </motion.div>
        ) : (
          apps.map((app, i) => {
            const job = app.job ?? {};
            const company = job.company?.company_name ?? '—';
            const city = job.site?.city ?? job.site?.site_name ?? '—';
            const statusCfg = STATUS_CONFIG[String(app.status ?? '').toLowerCase()] ?? FALLBACK_STATUS;
            return (
              <motion.div
                key={app.id}
                className="rounded-2xl p-4"
                style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-bold text-gray-900 truncate">{job.title ?? 'Job removed'}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{company}</p>
                  </div>
                  <span
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: statusCfg.bg, color: statusCfg.color }}
                  >
                    {statusCfg.icon}
                    {statusCfg.label}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1"><MapPin size={10} />{city}</span>
                  {job.shift_type && <span className="flex items-center gap-1"><Clock size={10} />{job.shift_type} Shift</span>}
                  {job.salary_amount && (
                    <span className="font-bold" style={{ color: '#166534' }}>
                      ₹{job.salary_amount}/{job.payment_type === 'Monthly' ? 'mo' : 'day'}
                    </span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                  Applied: {app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  {app.notes && <span className="ml-2 text-gray-500">· {app.notes}</span>}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
