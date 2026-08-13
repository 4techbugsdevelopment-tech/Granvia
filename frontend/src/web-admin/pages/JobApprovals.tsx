import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, XCircle, Briefcase, MapPin, Clock,
  RefreshCw, AlertCircle, ChevronDown, Eye, EyeOff,
} from 'lucide-react';
import { approveJob, listAllJobsForAdmin, rejectJob, updateAdminJobStatus } from '../../services/jobService';
import { getErrorMessage } from '../../services/apiErrors';

type StatusFilter = 'all' | 'pending_approval' | 'active' | 'rejected' | 'draft' | 'closed';

const STATUS_TABS: { key: StatusFilter; label: string; color: string; bg: string }[] = [
  { key: 'all',              label: 'All',       color: '#0f1e3c', bg: '#f1f5f9' },
  { key: 'pending_approval', label: 'Pending',   color: '#b45309', bg: '#fef3c7' },
  { key: 'active',           label: 'Active',    color: '#166534', bg: '#dcfce7' },
  { key: 'rejected',         label: 'Rejected',  color: '#7c2d12', bg: '#fee2e2' },
  { key: 'draft',            label: 'Draft',     color: '#475569', bg: '#f1f5f9' },
  { key: 'closed',           label: 'Closed',    color: '#475569', bg: '#f1f5f9' },
];

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending_approval: { label: 'Pending Approval', color: '#b45309', bg: '#fef3c7' },
    active:           { label: 'Active',            color: '#166534', bg: '#dcfce7' },
    rejected:         { label: 'Rejected',          color: '#991b1b', bg: '#fee2e2' },
    draft:            { label: 'Draft',             color: '#475569', bg: '#f1f5f9' },
    closed:           { label: 'Closed',            color: '#475569', bg: '#e2e8f0' },
    paused:           { label: 'Paused',            color: '#b45309', bg: '#fef3c7' },
  };
  const s = map[status] ?? { label: status, color: '#475569', bg: '#f1f5f9' };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function skillList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

export default function JobApprovals() {
  const [jobs, setJobs]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [acting, setActing]           = useState<string | null>(null);
  const [filter, setFilter]           = useState<StatusFilter>('all');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    setError(null);
    listAllJobsForAdmin()
      .then(data => setJobs(data ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const setStatus = async (jobId: string, status: string, reason?: string) => {
    setActing(jobId);
    setError(null);
    try {
      if (status === 'active') {
        await approveJob(jobId);
      } else if (status === 'rejected') {
        await rejectJob(jobId, reason);
      } else if (status === 'pending_approval' || status === 'closed') {
        await updateAdminJobStatus(jobId, status);
      } else {
        throw new Error(`Unsupported job status: ${status}`);
      }
      setJobs(prev => prev.map(j => j.id === jobId
        ? { ...j, status, rejection_reason: status === 'rejected' ? (reason ?? '') : null }
        : j));
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to update the job status.'));
    } finally {
      setActing(null);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  // Count per tab
  const counts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div className="p-6 space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Job Management</h2>
          <p className="text-sm text-gray-500">Review and control all employer job postings.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {STATUS_TABS.map(tab => {
          const count = tab.key === 'all' ? jobs.length : (counts[tab.key] ?? 0);
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
              style={{
                background: active ? tab.bg : 'white',
                color: active ? tab.color : '#64748b',
                borderColor: active ? tab.bg : '#e2e8f0',
                boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {tab.label}
              {count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: active ? tab.color : '#e2e8f0', color: active ? 'white' : '#64748b' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-gray-400 text-sm">Loading jobs…</div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-16">
          <Briefcase size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">
            {filter === 'all' ? 'No jobs posted yet' : `No ${filter.replace('_', ' ')} jobs`}
          </p>
          <p className="text-gray-400 text-sm mt-1">Jobs posted by employers will appear here.</p>
        </div>
      )}

      {/* Job cards */}
      <AnimatePresence>
        {filtered.map((job, i) => {
          const isExpanded = expanded.has(job.id);
          const isPending = job.status === 'pending_approval';
          const isActive = job.status === 'active';
          const isBusy = acting === job.id;

          return (
            <motion.div
              key={job.id}
              className="rounded-2xl bg-white overflow-hidden"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ delay: i * 0.03 }}
            >
              {/* Card header — always visible */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <Briefcase size={13} className="text-gray-400 flex-shrink-0" />
                      <span className="font-bold text-gray-900 truncate">{job.title}</span>
                      {statusBadge(job.status)}
                    </div>
                    <p className="text-sm text-gray-500">{job.employer_companies?.company_name ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold text-green-700">
                      ₹{job.salary_amount}/{job.payment_type === 'Monthly' ? 'mo' : 'day'}
                    </span>
                    <button
                      onClick={() => toggleExpand(job.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Quick meta */}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {job.company_sites?.site_name ?? job.company_sites?.city ?? '—'}{job.company_sites?.state ? `, ${job.company_sites.state}` : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {job.shift_type} · {job.duty_hours}
                  </span>
                  <span>{job.guards_required} associate{job.guards_required !== 1 ? 's' : ''}</span>
                  {job.start_date && (
                    <span>Start: {new Date(job.start_date).toLocaleDateString('en-IN')}</span>
                  )}
                  <span className="text-gray-400">
                    Posted {new Date(job.created_at).toLocaleDateString('en-IN')}
                  </span>
                </div>

                {/* Skills (always visible) */}
                {skillList(job.required_skills).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {skillList(job.required_skills).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">{s}</span>
                    ))}
                  </div>
                )}

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 pb-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600 border-t border-gray-50 mt-2">
                        {[
                          ['Category', job.category],
                          ['Associate Type', job.guard_type],
                          ['Gender Pref', job.gender_preference],
                          ['Experience', job.experience_required],
                          ['Duration', job.duration_type],
                          ['End Date', job.end_date ? new Date(job.end_date).toLocaleDateString('en-IN') : '—'],
                          ['Police Verify', job.police_verification_required ? 'Required' : 'Not required'],
                          ['Uniform', job.uniform_required ? 'Required' : 'Not required'],
                          ['Food', job.food_facility ? 'Provided' : 'No'],
                          ['Accommodation', job.accommodation_facility ? 'Provided' : 'No'],
                        ].map(([label, val]) => val ? (
                          <div key={label}>
                            <span className="text-gray-400">{label}: </span>
                            <span className="font-medium">{val}</span>
                          </div>
                        ) : null)}
                      </div>
                      {job.description && (
                        <p className="text-xs text-gray-500 pb-3">{job.description}</p>
                      )}
                      {job.rejection_reason && (
                        <div className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs mb-3">
                          <strong>Rejection reason:</strong> {job.rejection_reason}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-1">
                  {/* Pending → Approve or Reject */}
                  {isPending && (
                    <>
                      <button
                        onClick={() => setStatus(job.id, 'active')}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                        style={{ background: isBusy ? '#86efac' : '#166534' }}
                      >
                        <CheckCircle size={13} />
                        {isBusy ? 'Working…' : 'Approve & Publish'}
                      </button>
                      <div className="flex gap-1 flex-1 min-w-0">
                        <input
                          type="text"
                          placeholder="Rejection reason (optional)"
                          value={rejectReason[job.id] ?? ''}
                          onChange={e => setRejectReason(prev => ({ ...prev, [job.id]: e.target.value }))}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-red-300"
                        />
                        <button
                          onClick={() => setStatus(job.id, 'rejected', rejectReason[job.id])}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0"
                          style={{ background: isBusy ? '#fca5a5' : '#7c2d12' }}
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      </div>
                    </>
                  )}

                  {/* Active → Deactivate */}
                  {isActive && (
                    <button
                      onClick={() => setStatus(job.id, 'closed')}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      <EyeOff size={13} />
                      {isBusy ? 'Working…' : 'Deactivate'}
                    </button>
                  )}

                  {/* Non-active, non-pending → Re-publish */}
                  {!isPending && !isActive && (
                    <button
                      onClick={() => setStatus(job.id, 'active')}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: isBusy ? '#86efac' : '#166534' }}
                    >
                      <CheckCircle size={13} />
                      {isBusy ? 'Working…' : 'Re-publish as Active'}
                    </button>
                  )}

                  {/* Any status → send back to pending */}
                  {!isPending && (
                    <button
                      onClick={() => setStatus(job.id, 'pending_approval')}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      <ChevronDown size={13} />
                      Set Pending
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
