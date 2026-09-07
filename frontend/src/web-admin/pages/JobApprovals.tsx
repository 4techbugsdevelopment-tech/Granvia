import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, XCircle, Briefcase, MapPin, Clock,
  RefreshCw, AlertCircle, ChevronDown, Eye, EyeOff, Plus, Pencil, Trash2, X, ArrowLeft,
} from 'lucide-react';
import { approveJob, createAdminJob, deleteAdminJob, listAllJobsForAdmin, rejectJob, updateAdminJob, updateAdminJobStatus } from '../../services/jobService';
import { listEmployerManagementData } from '../../services/adminEmployerService';
import { getErrorMessage } from '../../services/apiErrors';
import { listAdminJobApplications, scheduleAdminApplicationInterview, updateAdminApplicationStatus } from '../../services/applicationService';

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

const EMPTY_JOB_FORM = {
  company_id: '', site_id: '', title: '', guards_required: '1', salary_amount: '',
  payment_type: 'Monthly', shift_type: 'Day', duty_hours: '8 hours', start_date: '',
  end_date: '', description: '', status: 'pending_approval',
};

export default function JobApprovals() {
  const [jobs, setJobs]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [acting, setActing]           = useState<string | null>(null);
  const [filter, setFilter]           = useState<StatusFilter>('all');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [companies, setCompanies]     = useState<any[]>([]);
  const [sites, setSites]             = useState<any[]>([]);
  const [formOpen, setFormOpen]       = useState(false);
  const [editingJob, setEditingJob]   = useState<any | null>(null);
  const [jobForm, setJobForm]         = useState({ ...EMPTY_JOB_FORM });
  const [formError, setFormError]     = useState('');
  const [applicantsJob, setApplicantsJob] = useState<any | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [interviewApp, setInterviewApp] = useState<any | null>(null);
  const [interviewRemarks, setInterviewRemarks] = useState('');
  const [savingInterview, setSavingInterview] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    listAllJobsForAdmin()
      .then(data => setJobs(data ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    listEmployerManagementData()
      .then(data => { setCompanies(data.companies ?? []); setSites(data.sites ?? []); })
      .catch(e => setError(getErrorMessage(e, 'Failed to load employer companies.')));
  }, []);

  const openCreate = () => {
    const companyId = companies[0]?.id ?? '';
    setEditingJob(null);
    setJobForm({ ...EMPTY_JOB_FORM, company_id: companyId, site_id: sites.find(site => site.companyId === companyId)?.id ?? '' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (job: any) => {
    setEditingJob(job);
    setJobForm({
      company_id: job.employer_companies?.id ?? '', site_id: job.company_sites?.id ?? '', title: job.title ?? '',
      guards_required: String(job.guards_required ?? 1), salary_amount: String(job.salary_amount ?? ''),
      payment_type: job.payment_type ?? 'Monthly', shift_type: job.shift_type ?? 'Day', duty_hours: job.duty_hours ?? '8 hours',
      start_date: job.start_date ? String(job.start_date).slice(0, 10) : '', end_date: job.end_date ? String(job.end_date).slice(0, 10) : '',
      description: job.description ?? '', status: job.status ?? 'pending_approval',
    });
    setFormError('');
    setFormOpen(true);
  };

  const saveJob = async () => {
    if (!jobForm.company_id || !jobForm.title.trim() || !jobForm.salary_amount || !jobForm.start_date) {
      setFormError('Company, job title, salary and start date are required.');
      return;
    }
    setActing(editingJob?.id ?? 'create');
    setFormError('');
    try {
      const payload = { ...jobForm, site_id: jobForm.site_id || null, guards_required: Number(jobForm.guards_required) || 1, salary_amount: Number(jobForm.salary_amount), end_date: jobForm.end_date || null };
      if (editingJob) await updateAdminJob(editingJob.id, payload);
      else await createAdminJob(payload);
      setFormOpen(false);
      setEditingJob(null);
      load();
    } catch (e) {
      setFormError(getErrorMessage(e, `Failed to ${editingJob ? 'update' : 'create'} the job.`));
    } finally { setActing(null); }
  };

  const removeJob = async (job: any) => {
    if (!window.confirm(`Delete ${job.title}? Related applications and operational records will also be removed.`)) return;
    setActing(job.id);
    setError(null);
    try {
      await deleteAdminJob(job.id);
      setJobs(current => current.filter(item => item.id !== job.id));
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to delete the job.'));
    } finally { setActing(null); }
  };

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

  const openApplicants = async (job: any) => {
    setApplicantsJob(job);
    setApplicants(await listAdminJobApplications(job.id));
  };

  const changeApplicantStatus = async (applicationId: string, status: string, remarks?: string) => {
    await updateAdminApplicationStatus(applicationId, status, remarks);
    if (applicantsJob) setApplicants(await listAdminJobApplications(applicantsJob.id));
  };

  const scheduleInterview = async () => {
    if (!interviewApp || !interviewRemarks.trim()) return;
    setSavingInterview(true);
    try {
      await scheduleAdminApplicationInterview(interviewApp.id, interviewRemarks.trim());
      setInterviewApp(null);
      setInterviewRemarks('');
      if (applicantsJob) setApplicants(await listAdminJobApplications(applicantsJob.id));
    } finally { setSavingInterview(false); }
  };

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  // Count per tab
  const counts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  if (applicantsJob) {
    return <motion.div className="p-4 md:p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => setApplicantsJob(null)} className="mb-3 flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft size={13} /> All jobs</button>
      <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-900">{applicantsJob.title}</h2><p className="text-sm text-gray-500">All associate partners who applied for this job</p></div><button onClick={() => void openApplicants(applicantsJob)} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-600 shadow-sm"><RefreshCw size={14} /> Refresh</button></div>
      <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="space-y-3">{applicants.map(app => <div key={app.id} className="rounded-xl border border-gray-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-gray-900">{app.guard_profiles?.full_name ?? 'Associate Partner'}</p><p className="text-xs text-gray-500">{app.guard_profiles?.mobile ?? ''} · Profile {app.guard_profiles?.verification_status ?? 'pending'}</p></div>{statusBadge(app.status)}</div><p className="mt-2 text-xs text-gray-500">Applied {app.applied_at ? new Date(app.applied_at).toLocaleString('en-IN') : ''}{app.notes ? ` · ${app.notes}` : ''}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void changeApplicantStatus(app.id, 'selected')} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">Select</button><button onClick={() => { setInterviewApp(app); setInterviewRemarks(''); }} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Schedule interview</button><button onClick={() => void changeApplicantStatus(app.id, 'hired')} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Hired</button><button onClick={() => void changeApplicantStatus(app.id, 'not_hired')} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Not hired</button></div></div>)}{applicants.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No applicants for this job.</p>}</div></div>
      <AnimatePresence>{interviewApp && <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !savingInterview && setInterviewApp(null)}><motion.div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" initial={{ scale: .96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><div><h3 className="font-bold text-gray-900">Schedule interview</h3><p className="text-xs text-gray-500">{interviewApp.guard_profiles?.full_name ?? 'Associate Partner'}</p></div><button onClick={() => setInterviewApp(null)}><X size={18} className="text-gray-400" /></button></div><textarea value={interviewRemarks} onChange={event => setInterviewRemarks(event.target.value)} placeholder="Enter interview date, time, location, or other remarks" rows={5} className="mt-4 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-blue-400" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setInterviewApp(null)} className="rounded-xl px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={() => void scheduleInterview()} disabled={savingInterview || !interviewRemarks.trim()} className="rounded-xl bg-[#0f1e3c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingInterview ? 'Saving...' : 'Schedule interview'}</button></div></motion.div></motion.div>}</AnimatePresence>
    </motion.div>;
  }

  return (
    <motion.div className="p-4 md:p-6 space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Job Management</h2>
          <p className="text-sm text-gray-500">Review and control all employer job postings.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>
            <Plus size={15} /> Create Job
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 pb-1">
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

                <button onClick={() => void openApplicants(job)} className="mb-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">View applicants</button>

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
                  <button onClick={() => openEdit(job)} disabled={isBusy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50">
                    <Pencil size={13} /> Edit
                  </button>
                  <button onClick={() => removeJob(job)} disabled={isBusy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50">
                    <Trash2 size={13} /> Delete
                  </button>
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

      {formOpen && (
        <div
          className={editingJob ? 'fixed inset-0 z-[80] flex justify-end bg-black/35' : 'fixed inset-0 z-[80] overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6 sm:py-8'}
          onClick={editingJob ? () => setFormOpen(false) : undefined}
        >
          <div className={editingJob ? 'h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl' : 'mx-auto min-h-full w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'} onClick={event => event.stopPropagation()}>
            {!editingJob && (
              <button type="button" onClick={() => setFormOpen(false)} className="mb-5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <ArrowLeft size={18} /> Back to Jobs
              </button>
            )}
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{editingJob ? 'Edit Job' : 'Create Job'}</h3>
                <p className="text-sm text-gray-500">Save here to return to the job management list.</p>
              </div>
              {editingJob && <button onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button>}
            </div>
            {formError && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="form-label">Employer Company *</span>
                <select value={jobForm.company_id} disabled={Boolean(editingJob?.employer_companies?.id)} onChange={event => { const companyId = event.target.value; setJobForm(current => ({ ...current, company_id: companyId, site_id: sites.find(site => site.companyId === companyId)?.id ?? '' })); }} className="form-input">
                  <option value="">Select company</option>
                  {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="form-label">Site</span>
                <select value={jobForm.site_id} onChange={event => setJobForm(current => ({ ...current, site_id: event.target.value }))} className="form-input">
                  <option value="">No site selected</option>
                  {sites.filter(site => site.companyId === jobForm.company_id).map(site => <option key={site.id} value={site.id}>{site.siteName} — {site.city}</option>)}
                </select>
              </label>
              <JobField label="Job Title *" value={jobForm.title} onChange={value => setJobForm(current => ({ ...current, title: value }))} className="sm:col-span-2" />
              <JobField label="Openings" value={jobForm.guards_required} onChange={value => setJobForm(current => ({ ...current, guards_required: value.replace(/\D/g, '') }))} />
              <JobField label="Salary *" value={jobForm.salary_amount} onChange={value => setJobForm(current => ({ ...current, salary_amount: value.replace(/[^\d.]/g, '') }))} />
              <JobField label="Payment Type" value={jobForm.payment_type} onChange={value => setJobForm(current => ({ ...current, payment_type: value }))} />
              <JobField label="Shift" value={jobForm.shift_type} onChange={value => setJobForm(current => ({ ...current, shift_type: value }))} />
              <JobField label="Duty Hours" value={jobForm.duty_hours} onChange={value => setJobForm(current => ({ ...current, duty_hours: value }))} />
              <JobField label="Start Date *" type="date" value={jobForm.start_date} onChange={value => setJobForm(current => ({ ...current, start_date: value }))} />
              <JobField label="End Date" type="date" value={jobForm.end_date} onChange={value => setJobForm(current => ({ ...current, end_date: value }))} />
              <label>
                <span className="form-label">Status</span>
                <select value={jobForm.status} onChange={event => setJobForm(current => ({ ...current, status: event.target.value }))} className="form-input">
                  <option value="pending_approval">Pending Approval</option><option value="active">Active</option><option value="draft">Draft</option><option value="closed">Closed</option>
                </select>
              </label>
              <label className="sm:col-span-2"><span className="form-label">Description</span><textarea value={jobForm.description} onChange={event => setJobForm(current => ({ ...current, description: event.target.value }))} className="form-input min-h-24" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFormOpen(false)} className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={saveJob} disabled={acting === (editingJob?.id ?? 'create')} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#0f1e3c' }}>{acting === (editingJob?.id ?? 'create') ? 'Saving…' : editingJob ? 'Save Changes' : 'Create Job'}</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function JobField({ label, value, onChange, type = 'text', className = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string }) {
  return <label className={className}><span className="form-label">{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} className="form-input" /></label>;
}
