// AcceptedJobsScreen — accepted / selected / joined job overview for the Associate app.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { listMyApplications } from '../../services/applicationService';

const ACTIVE_STATUSES = new Set(['selected', 'offer_sent', 'accepted', 'joined']);

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  selected: { label: 'Selected', bg: '#dbeafe', color: '#1d4ed8' },
  offer_sent: { label: 'Offer Sent', bg: '#dcfce7', color: '#166534' },
  accepted: { label: 'Accepted', bg: '#dcfce7', color: '#166534' },
  joined: { label: 'Joined', bg: '#dcfce7', color: '#166534' },
};

export default function AcceptedJobsScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyApplications()
      .then(data => setJobs((data ?? []).filter((app: any) => ACTIVE_STATUSES.has(String(app.status ?? '').toLowerCase()))))
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-6">
      <div
        className="px-4 pt-5 pb-6"
        style={{
          background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)',
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        }}
      >
        <h1 className="text-white font-bold text-xl">Accepted Jobs</h1>
        <p className="text-blue-200 text-xs mt-1">Your selected and active assignments</p>
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
            <p className="text-gray-400 text-sm mt-3">Loading accepted jobs…</p>
          </div>
        ) : jobs.length === 0 ? (
          <motion.div className="text-center py-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Briefcase size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 font-medium">No accepted jobs yet</p>
            <p className="text-gray-300 text-sm mt-1">Once you accept an offer, it will appear here.</p>
          </motion.div>
        ) : (
          jobs.map((job, index) => {
            const appJob = job.job ?? {};
            const status = String(job.status ?? '').toLowerCase();
            const style = STATUS_STYLE[status] ?? STATUS_STYLE.accepted;
            return (
              <motion.div
                key={job.id}
                className="rounded-2xl p-4"
                style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{appJob.title ?? 'Job assignment'}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{appJob.company?.company_name ?? '—'}</p>
                  </div>
                  <span
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: style.bg, color: style.color }}
                  >
                    <CheckCircle2 size={14} />
                    {style.label}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                  {appJob.site?.site_name && <span className="flex items-center gap-1"><MapPin size={10} />{appJob.site.site_name}</span>}
                  {appJob.shift_type && <span className="flex items-center gap-1"><Clock size={10} />{appJob.shift_type} Shift</span>}
                  {appJob.salary_amount && (
                    <span className="font-bold" style={{ color: '#166534' }}>
                      ₹{appJob.salary_amount}/{appJob.payment_type === 'Monthly' ? 'mo' : 'day'}
                    </span>
                  )}
                </div>
                {appJob.start_date && (
                  <p className="mt-3 text-xs text-gray-500">
                    Start date: {new Date(appJob.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                {job.notes && <p className="mt-2 text-xs text-gray-500">{job.notes}</p>}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
