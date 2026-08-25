import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Clock, CheckCircle, X, Briefcase, Map as MapIcon, List, AlertCircle } from 'lucide-react';
import { listActiveJobs } from '../../services/jobService';
import { applyForJob, listMyAppliedJobIds } from '../../services/applicationService';
import JobRadiusMap from '../../components/map/JobRadiusMap';

export default function JobSearch() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Night' | 'Day'>('All');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [radiusKm, setRadiusKm] = useState(10);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = () => Promise.all([listActiveJobs(), listMyAppliedJobIds()])
      .then(([jobData, appliedSet]) => {
        if (!mounted) return;
        setJobs(jobData ?? []);
        setAppliedIds(appliedSet);
        setError(null);
      })
      .catch(e => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });

    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const filtered = jobs.filter(job => {
    const city = job.company_sites?.city ?? '';
    const company = job.employer_companies?.company_name ?? '';
    const matchSearch = !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      city.toLowerCase().includes(search.toLowerCase()) ||
      company.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Night' && job.shift_type === 'Night') ||
      (activeFilter === 'Day' && job.shift_type === 'Day');
    return matchSearch && matchFilter;
  });

  const handleApply = async (job: any) => {
    if (appliedIds.has(job.id) || applyingId) return;
    setApplyingId(job.id);
    setApplyError(null);
    try {
      await applyForJob(job.id);
      setAppliedIds(prev => new Set([...prev, job.id]));
      setApplySuccess(job.id);
      setTimeout(() => { setApplySuccess(null); setSelectedJob(null); }, 1500);
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setApplyingId(null);
    }
  };

  const skills = (job: any): string[] => {
    if (!job.required_skills) return [];
    if (Array.isArray(job.required_skills)) return job.required_skills.filter(Boolean);
    return String(job.required_skills).split(',').map((s: string) => s.trim()).filter(Boolean);
  };

  // Stable reference — only rebuilds when filtered job IDs change.
  // Without this, a new array is created on every render which causes
  // JobRadiusMap's geocoding effect to cancel & restart in an infinite loop.
  const mapJobs = useMemo(() => filtered.map(j => ({
    id:        j.id,
    title:     j.title,
    company:   j.employer_companies?.company_name ?? '',
    location:  j.company_sites?.site_name ?? '',
    latitude:  j.company_sites?.latitude  ?? null,
    longitude: j.company_sites?.longitude ?? null,
    address:   j.company_sites?.address   ?? null,
    city:      j.company_sites?.city      ?? null,
    state:     j.company_sites?.state     ?? null,
    pincode:   j.company_sites?.pincode   ?? null,
  })), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pb-4">
      {/* Header */}
      <div
        className="px-4 pt-5 pb-5"
        style={{
          background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)',
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        }}
      >
        <h1 className="text-white font-bold text-xl mb-4">Find Jobs</h1>
        <motion.div className="relative" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by job title, city..."
            className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.95)', color: '#0f1e3c' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </motion.div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {(['All', 'Night', 'Day'] as const).map(f => (
          <motion.button
            key={f}
            onClick={() => setActiveFilter(f)}
            className="px-4 py-2 rounded-full text-xs font-semibold"
            style={{
              background: activeFilter === f ? '#0f1e3c' : 'white',
              color: activeFilter === f ? 'white' : '#64748b',
              boxShadow: activeFilter === f ? '0 4px 12px rgba(15,30,60,0.2)' : '0 1px 4px rgba(0,0,0,0.08)',
            }}
            whileTap={{ scale: 0.93 }}
          >
            {f === 'Night' ? '🌙 ' : f === 'Day' ? '☀️ ' : ''}
            {f}
          </motion.button>
        ))}
      </div>

      {/* Count + List/Map toggle */}
      <div className="px-4 pb-1 flex items-center justify-between gap-3">
        <div className="text-xs text-gray-400">
          {loading ? 'Loading…' : `${filtered.length} job${filtered.length !== 1 ? 's' : ''} found`}
        </div>
        <div className="flex gap-1 rounded-xl p-0.5" style={{ background: '#f1f5f9' }}>
          {(['list', 'map'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: viewMode === mode ? '#0f1e3c' : 'transparent',
                color: viewMode === mode ? 'white' : '#64748b',
              }}
            >
              {mode === 'list' ? <List size={12} /> : <MapIcon size={12} />}
              {mode === 'list' ? 'List' : 'Map'}
            </button>
          ))}
        </div>
      </div>

      {/* Radius slider — map mode */}
      {viewMode === 'map' && (
        <div className="px-4 pb-3 flex items-center gap-3">
          <MapPin size={12} className="text-blue-500 flex-shrink-0" />
          <input
            type="range" min={1} max={50} step={1} value={radiusKm}
            onChange={e => setRadiusKm(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <span className="text-xs font-semibold text-blue-600 w-14 text-right">{radiusKm} km</span>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs">
          <AlertCircle size={13} />{error}
        </div>
      )}

      {/* Map view */}
      {viewMode === 'map' && (
        <div className="px-4 pb-3">
          <JobRadiusMap
            jobs={mapJobs}
            radiusKm={radiusKm}
            selectedJobId={selectedJob?.id ?? null}
            onJobClick={id => setSelectedJob(filtered.find(j => j.id === id) ?? null)}
            mapHeight={360}
          />
        </div>
      )}

      {/* Job cards */}
      <div className="px-4 space-y-2.5 mt-2" style={{ display: viewMode === 'map' ? 'none' : undefined }}>
        <AnimatePresence>
          {!loading && filtered.map((job, i) => {
            const applied = appliedIds.has(job.id);
            const site = job.company_sites ?? {};
            const company = job.employer_companies?.company_name ?? '—';
            return (
              <motion.div
                key={job.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedJob(job)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{job.title}</p>
                      <p className="text-xs text-gray-500 truncate">{company}</p>
                    </div>
                    <div className="text-xs font-bold px-2 py-1 rounded-xl ml-2 flex-shrink-0 bg-green-50 text-green-700">
                      ₹{job.salary_amount}/{job.payment_type === 'Monthly' ? 'mo' : 'day'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin size={10} />{site.site_name ?? site.city ?? '—'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={10} />{job.shift_type} Shift{job.duty_hours ? ` · ${job.duty_hours}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5 flex-wrap">
                      {skills(job).slice(0, 2).map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600">{s}</span>
                      ))}
                      {skills(job).length > 2 && (
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500">+{skills(job).length - 2}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{job.guards_required} opening{job.guards_required !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="border-t border-gray-50 px-4 py-3">
                  <motion.button
                    onClick={e => { e.stopPropagation(); handleApply(job); }}
                    disabled={applied || applyingId === job.id}
                    className="w-full py-2.5 rounded-xl text-sm font-bold"
                    style={{
                      background: applied ? '#dcfce7' : 'linear-gradient(135deg, #0f1e3c, #1a2d50)',
                      color: applied ? '#166534' : 'white',
                    }}
                    whileTap={applied ? {} : { scale: 0.97 }}
                  >
                    {applySuccess === job.id ? (
                      <span className="flex items-center justify-center gap-2"><CheckCircle size={14} /> Applied!</span>
                    ) : applyingId === job.id ? (
                      <motion.div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent mx-auto" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    ) : applied ? (
                      <span className="flex items-center justify-center gap-2"><CheckCircle size={14} /> Applied</span>
                    ) : 'Apply Now'}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loading && (
          <div className="text-center py-16">
            <motion.div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600 mx-auto" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
            <p className="text-gray-400 text-sm mt-3">Loading jobs…</p>
          </div>
        )}
        {!loading && filtered.length === 0 && !error && (
          <div className="text-center py-16">
            <Briefcase size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400 text-sm">No jobs found</p>
          </div>
        )}
      </div>

      {/* Apply error toast */}
      <AnimatePresence>
        {applyError && (
          <motion.div
            className="fixed bottom-24 left-4 right-4 z-[90] flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-600 text-white text-sm shadow-lg"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          >
            <AlertCircle size={16} />
            {applyError}
            <button className="ml-auto" onClick={() => setApplyError(null)}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job detail bottom sheet */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedJob(null)}
          >
            <motion.div
              className="w-full rounded-t-3xl overflow-hidden flex flex-col"
              style={{ background: 'white', maxHeight: '85dvh', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pb-2 overflow-y-auto mobile-scroll flex-1 min-h-0">
                <div className="flex justify-between items-start py-3">
                  <div className="flex-1 min-w-0 mr-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedJob.title}</h2>
                    <p className="text-gray-500 text-sm mt-0.5">{selectedJob.employer_companies?.company_name}</p>
                  </div>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0"
                    aria-label="Close job details"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  {[
                    { label: 'Salary', value: `₹${selectedJob.salary_amount}/${selectedJob.payment_type === 'Monthly' ? 'mo' : 'day'}`, color: '#166534' },
                    { label: 'Shift', value: selectedJob.shift_type, color: '#0f1e3c' },
                    { label: 'Shift Hours', value: selectedJob.duty_hours ?? '—', color: '#0f1e3c' },
                    { label: 'Duration', value: selectedJob.duration_type, color: '#0f1e3c' },
                    { label: 'Openings', value: `${selectedJob.guards_required} posts`, color: '#7c2d12' },
                    { label: 'Experience', value: selectedJob.experience_required, color: '#0f1e3c' },
                    { label: 'Location', value: selectedJob.company_sites?.site_name ?? selectedJob.company_sites?.city ?? '—', color: '#0f1e3c' },
                  ].map(info => (
                    <div key={info.label} className="rounded-xl p-3" style={{ background: '#f8fafc' }}>
                      <div className="text-xs text-gray-400 mb-0.5">{info.label}</div>
                      <div className="text-sm font-bold" style={{ color: info.color }}>{info.value}</div>
                    </div>
                  ))}
                </div>
                {selectedJob.description && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Description</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{selectedJob.description}</p>
                  </div>
                )}
                {skills(selectedJob).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Required Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {skills(selectedJob).map(s => (
                        <span key={s} className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-5 pt-3 bg-white border-t border-gray-100 flex-shrink-0">
                <motion.button
                  onClick={() => handleApply(selectedJob)}
                  disabled={appliedIds.has(selectedJob.id) || applyingId === selectedJob.id}
                  className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                  style={{
                    background: appliedIds.has(selectedJob.id) ? '#dcfce7' : 'linear-gradient(135deg, #0f1e3c, #8b1a1a)',
                    color: appliedIds.has(selectedJob.id) ? '#166534' : 'white',
                  }}
                  whileTap={appliedIds.has(selectedJob.id) ? {} : { scale: 0.97 }}
                >
                  {applySuccess === selectedJob.id ? (
                    <><CheckCircle size={16} /> Applied Successfully!</>
                  ) : applyingId === selectedJob.id ? (
                    <motion.div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : appliedIds.has(selectedJob.id) ? (
                    <><CheckCircle size={16} /> Already Applied</>
                  ) : 'Apply for this Job'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
