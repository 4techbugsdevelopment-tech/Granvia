// ApplicationsScreen — guard's job applications backed by the API
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, MapPin, Clock, CheckCircle, XCircle, Loader, AlertCircle, X, Map as MapIcon, ChevronRight } from 'lucide-react';
import { listMyApplications } from '../../services/applicationService';
import JobRadiusMap from '../../components/map/JobRadiusMap';

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
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    listMyApplications()
      .then(data => setApps(data ?? []))
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  const closeDetails = () => {
    setSelectedApp(null);
    setShowMap(false);
  };

  const selectedJob = selectedApp?.job ?? null;
  const selectedSkills: string[] = Array.isArray(selectedJob?.required_skills)
    ? selectedJob.required_skills.filter(Boolean)
    : [];
  const selectedMapJobs = selectedJob ? [{
    id: selectedJob.id,
    title: selectedJob.title,
    company: selectedJob.company?.company_name ?? '',
    location: selectedJob.site?.site_name ?? '',
    latitude: selectedJob.site?.latitude ?? null,
    longitude: selectedJob.site?.longitude ?? null,
    address: selectedJob.site?.address ?? null,
    city: selectedJob.site?.city ?? null,
    state: selectedJob.site?.state ?? null,
    pincode: selectedJob.site?.pincode ?? null,
  }] : [];
  const selectedStatus = STATUS_CONFIG[String(selectedApp?.status ?? '').toLowerCase()] ?? FALLBACK_STATUS;
  const selectedLanguages: string[] = Array.isArray(selectedJob?.language_requirements)
    ? selectedJob.language_requirements.filter(Boolean)
    : [];

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
                className="rounded-2xl p-4 cursor-pointer mobile-touch-interactive"
                style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => { setSelectedApp(app); setShowMap(false); }}
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
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={event => { event.stopPropagation(); setSelectedApp(app); setShowMap(true); }}
                    className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <MapIcon size={13} /> View on Map
                  </button>
                  <button
                    onClick={event => { event.stopPropagation(); setSelectedApp(app); setShowMap(false); }}
                    className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    View Details <ChevronRight size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {selectedApp && selectedJob && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDetails}
          >
            <motion.div
              className="w-full rounded-t-3xl overflow-hidden flex flex-col bg-white"
              style={{ maxHeight: '88dvh', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={event => event.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pb-4 overflow-y-auto mobile-scroll flex-1 min-h-0">
                <div className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900">{selectedJob.title}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{selectedJob.company?.company_name ?? '—'}</p>
                  </div>
                  <button onClick={closeDetails} className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0" aria-label="Close application details">
                    <X size={16} />
                  </button>
                </div>

                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: selectedStatus.bg, color: selectedStatus.color }}>
                    {selectedStatus.icon}{selectedStatus.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    Applied {selectedApp.applied_at ? new Date(selectedApp.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  {[
                    { label: 'Salary', value: selectedJob.salary_amount ? `₹${selectedJob.salary_amount}/${selectedJob.payment_type === 'Monthly' ? 'mo' : 'day'}` : '—' },
                    { label: 'Shift', value: selectedJob.shift_type ?? '—' },
                    { label: 'Shift Hours', value: selectedJob.duty_hours ?? '—' },
                    { label: 'Duration', value: selectedJob.duration_type ?? '—' },
                    { label: 'Openings', value: selectedJob.guards_required ? `${selectedJob.guards_required} posts` : '—' },
                    { label: 'Experience', value: selectedJob.experience_required ?? '—' },
                    { label: 'Qualification', value: selectedJob.qualification_required ?? '—' },
                    { label: 'Location', value: selectedJob.site?.site_name ?? selectedJob.site?.city ?? '—' },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl p-3 bg-slate-50">
                      <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                      <div className="text-sm font-bold text-slate-800 break-words">{item.value}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowMap(current => !current)}
                  className="w-full py-3 rounded-xl bg-blue-900 text-white text-sm font-bold flex items-center justify-center gap-2 mb-4"
                >
                  <MapIcon size={15} /> {showMap ? 'Hide Map' : 'View on Map'}
                </button>

                {showMap && (
                  <div className="mb-4">
                    <JobRadiusMap
                      jobs={selectedMapJobs}
                      radiusKm={100}
                      selectedJobId={selectedJob.id}
                      mapHeight={240}
                    />
                  </div>
                )}

                {selectedJob.description && (
                  <section className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Description</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{selectedJob.description}</p>
                  </section>
                )}
                {selectedSkills.length > 0 && (
                  <section className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedSkills.map(skill => <span key={skill} className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium">{skill}</span>)}
                    </div>
                  </section>
                )}
                {selectedLanguages.length > 0 && (
                  <section className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Languages</h3>
                    <p className="text-sm text-gray-600">{selectedLanguages.join(', ')}</p>
                  </section>
                )}
                {selectedJob.special_instructions && (
                  <section className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Special Instructions</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{selectedJob.special_instructions}</p>
                  </section>
                )}
                <section className="mb-2">
                  <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Facilities & Requirements</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.uniform_required && <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">Uniform required</span>}
                    {selectedJob.food_facility && <span className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700">Food facility</span>}
                    {selectedJob.accommodation_facility && <span className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700">Accommodation</span>}
                    {selectedJob.police_verification_required && <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">Police verification required</span>}
                  </div>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
