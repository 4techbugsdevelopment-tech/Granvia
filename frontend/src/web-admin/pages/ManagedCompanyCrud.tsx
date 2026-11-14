import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

type Site = {
  id: string;
  siteName: string;
  siteType?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  contactPerson?: string | null;
  contactMobile?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  shiftDetails?: string | null;
  notes?: string | null;
  status: string;
};

type SiteDraft = {
  site_name: string;
  site_type: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contact_person: string;
  contact_mobile: string;
  latitude: string;
  longitude: string;
  shift_details: string;
  notes: string;
  status: string;
};

type Job = {
  id: string;
  title: string;
  siteId?: string | null;
  category?: string | null;
  guardType?: string | null;
  guardsRequired?: number | null;
  salaryAmount?: string | number | null;
  paymentType?: string | null;
  dutyHours?: string | null;
  shiftType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  status: string;
  site?: { id: string; siteName: string } | null;
};

type JobDraft = {
  title: string;
  site_id: string;
  category: string;
  guard_type: string;
  guards_required: string;
  salary_amount: string;
  payment_type: string;
  duty_hours: string;
  shift_type: string;
  start_date: string;
  end_date: string;
  description: string;
  status: string;
};

const inputClass = 'form-input mt-1';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50';

function errorMessage(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const validation = response.response?.data?.errors;
  return response.response?.data?.message || (validation ? Object.values(validation).flat()[0] : undefined) || fallback;
}

function managedUrl(companyId: string, department: string, resource: string, recordId?: string) {
  return `/managed-companies/${companyId}/${department}/${resource}${recordId ? `/${recordId}` : ''}`;
}

const blankSite = (): SiteDraft => ({
  site_name: '', site_type: 'Office', address: '', city: '', state: '', pincode: '', contact_person: '', contact_mobile: '',
  latitude: '', longitude: '', shift_details: '', notes: '', status: 'active',
});

function siteDraft(site: Site): SiteDraft {
  return {
    site_name: site.siteName || '', site_type: site.siteType || 'Office', address: site.address || '', city: site.city || '', state: site.state || '',
    pincode: site.pincode || '', contact_person: site.contactPerson || '', contact_mobile: site.contactMobile || '', latitude: site.latitude == null ? '' : String(site.latitude),
    longitude: site.longitude == null ? '' : String(site.longitude), shift_details: site.shiftDetails || '', notes: site.notes || '', status: site.status || 'active',
  };
}

function SiteForm({ draft, setDraft, saving, onSave, onCancel, title }: {
  draft: SiteDraft;
  setDraft: (draft: SiteDraft) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  title: string;
}) {
  const field = (key: keyof SiteDraft, label: string, required = false) => <label className="block text-sm font-medium text-slate-700">{label}<input required={required} className={inputClass} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>;
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-slate-900">{title}</h3><button type="button" onClick={onCancel} aria-label="Close site form"><X size={18} /></button></div>
    <div className="grid gap-3 md:grid-cols-3">
      {field('site_name', 'Site name', true)}
      <label className="block text-sm font-medium text-slate-700">Site type<select className={inputClass} value={draft.site_type} onChange={event => setDraft({ ...draft, site_type: event.target.value })}>{['Office', 'Mall', 'Warehouse', 'Factory', 'Society', 'Event', 'Hospital', 'School'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block text-sm font-medium text-slate-700">Status<select className={inputClass} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option></select></label>
      <div className="md:col-span-3">{field('address', 'Site address', true)}</div>
      {field('city', 'City')}{field('state', 'State')}{field('pincode', 'Pincode')}
      {field('contact_person', 'Contact person')}{field('contact_mobile', 'Contact mobile', true)}{field('shift_details', 'Shift details')}
      {field('latitude', 'Latitude')}{field('longitude', 'Longitude')}{field('notes', 'Notes')}
    </div>
    <div className="mt-4 flex justify-end gap-2"><button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button><button type="button" className={primaryButton} disabled={saving} onClick={onSave}>{saving ? 'Saving...' : 'Save site'}</button></div>
  </div>;
}

export function ManagedSites({ companyId, sites, onReload }: { companyId: string; sites: Site[]; onReload: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [draft, setDraft] = useState<SiteDraft>(blankSite);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const save = async () => {
    const key = editing?.id || 'create';
    setBusy(key); setError(''); setNotice('');
    try {
      const payload = { ...draft, latitude: draft.latitude ? Number(draft.latitude) : null, longitude: draft.longitude ? Number(draft.longitude) : null };
      if (editing) await apiClient.patch(managedUrl(companyId, 'operations', 'sites', editing.id), payload);
      else await apiClient.post(managedUrl(companyId, 'operations', 'sites'), payload);
      setEditing(null); setCreating(false); setDraft(blankSite());
      await onReload();
      setNotice(editing ? 'Site updated successfully.' : 'Site created successfully.');
    } catch (error) { setError(errorMessage(error, 'Unable to save the site.')); }
    finally { setBusy(''); }
  };

  const remove = async (site: Site) => {
    if (!window.confirm(`Delete ${site.siteName}? Existing operational history will be preserved but unlinked from this site.`)) return;
    setBusy(site.id); setError(''); setNotice('');
    try { await apiClient.delete(managedUrl(companyId, 'operations', 'sites', site.id)); await onReload(); setNotice('Site deleted successfully.'); }
    catch (error) { setError(errorMessage(error, 'Unable to delete the site.')); }
    finally { setBusy(''); }
  };

  const setStatus = async (site: Site) => {
    setBusy(site.id); setError(''); setNotice('');
    try { await apiClient.patch(managedUrl(companyId, 'operations', 'sites', site.id), { status: site.status === 'active' ? 'inactive' : 'active' }); await onReload(); setNotice('Site status updated.'); }
    catch (error) { setError(errorMessage(error, 'Unable to update the site status.')); }
    finally { setBusy(''); }
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Sites</h3><p className="text-sm text-slate-500">Create and maintain every site belonging to this company.</p></div><button className={primaryButton} onClick={() => { setEditing(null); setDraft(blankSite()); setCreating(true); }}><Plus size={16} /> Add site</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</p>}
    {(creating || editing) && <SiteForm title={editing ? `Edit ${editing.siteName}` : 'Add site'} draft={draft} setDraft={setDraft} saving={Boolean(busy)} onSave={save} onCancel={() => { setCreating(false); setEditing(null); }} />}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Site', 'Location', 'Contact', 'Status', 'Actions'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{sites.map(site => <tr className="border-t" key={site.id}><td className="p-3"><b>{site.siteName}</b><div className="text-xs text-slate-500">{site.siteType || 'Site'}</div></td><td className="p-3">{site.address || '—'}<div className="text-xs text-slate-500">{[site.city, site.state, site.pincode].filter(Boolean).join(', ')}</div></td><td className="p-3">{site.contactPerson || '—'}<div className="text-xs text-slate-500">{site.contactMobile || ''}</div></td><td className="p-3 capitalize">{site.status}</td><td className="p-3"><div className="flex flex-wrap gap-2"><button className={secondaryButton} disabled={Boolean(busy)} onClick={() => { setCreating(false); setEditing(site); setDraft(siteDraft(site)); }}><Pencil size={14}/> Edit</button><button className={secondaryButton} disabled={Boolean(busy)} onClick={() => setStatus(site)}>{site.status === 'active' ? 'Deactivate' : 'Activate'}</button><button className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={Boolean(busy)} onClick={() => remove(site)}><Trash2 size={14}/> Delete</button></div></td></tr>)}</tbody></table>{!sites.length && <p className="py-8 text-center text-sm text-slate-500">No sites have been added for this company.</p>}</div>
  </section>;
}

const blankJob = (associateType = ''): JobDraft => ({
  title: '', site_id: '', category: '', guard_type: associateType, guards_required: '1', salary_amount: '', payment_type: 'Monthly', duty_hours: '8 hours',
  shift_type: 'Day', start_date: '', end_date: '', description: '', status: 'draft',
});

function jobDraft(job: Job): JobDraft {
  return {
    title: job.title || '', site_id: job.siteId || '', category: job.category || '', guard_type: job.guardType || '', guards_required: String(job.guardsRequired || 1),
    salary_amount: job.salaryAmount == null ? '' : String(job.salaryAmount), payment_type: job.paymentType || 'Monthly', duty_hours: job.dutyHours || '8 hours',
    shift_type: job.shiftType || 'Day', start_date: job.startDate ? String(job.startDate).slice(0, 10) : '', end_date: job.endDate ? String(job.endDate).slice(0, 10) : '',
    description: job.description || '', status: job.status || 'draft',
  };
}

export function ManagedJobs({ companyId, jobs, sites, associateTypes, onReload }: {
  companyId: string;
  jobs: Job[];
  sites: Array<{ id: string; siteName: string; status: string }>;
  associateTypes: Array<{ code: string; name: string }>;
  onReload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Job | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<JobDraft>(() => blankJob(associateTypes[0]?.code));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const field = (key: keyof JobDraft, label: string, required = false, type = 'text') => <label className="block text-sm font-medium text-slate-700">{label}<input type={type} required={required} className={inputClass} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>;

  const save = async () => {
    setBusy(editing?.id || 'create'); setError(''); setNotice('');
    try {
      const payload = { ...draft, site_id: draft.site_id || null, guards_required: Number(draft.guards_required), salary_amount: draft.salary_amount || null, start_date: draft.start_date || null, end_date: draft.end_date || null };
      if (editing) await apiClient.patch(managedUrl(companyId, 'hr', 'jobs', editing.id), payload);
      else await apiClient.post(managedUrl(companyId, 'hr', 'jobs'), payload);
      setEditing(null); setShowForm(false); setDraft(blankJob(associateTypes[0]?.code));
      await onReload(); setNotice(editing ? 'Job updated successfully.' : 'Job created successfully.');
    } catch (error) { setError(errorMessage(error, 'Unable to save the job.')); }
    finally { setBusy(''); }
  };

  const remove = async (job: Job) => {
    if (!window.confirm(`Delete ${job.title}? Wage-checked jobs will be archived and their compliance history retained.`)) return;
    setBusy(job.id); setError(''); setNotice('');
    try { const { data } = await apiClient.delete(managedUrl(companyId, 'hr', 'jobs', job.id)); await onReload(); setNotice(data.message || 'Job removed successfully.'); }
    catch (error) { setError(errorMessage(error, 'Unable to remove the job.')); }
    finally { setBusy(''); }
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Jobs</h3><p className="text-sm text-slate-500">Create, publish, edit, close, or remove jobs for this company.</p></div><button className={primaryButton} onClick={() => { setEditing(null); setDraft(blankJob(associateTypes[0]?.code)); setShowForm(true); }}><Plus size={16}/> Create job</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</p>}
    {showForm && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-4 flex items-center justify-between"><h3 className="font-bold">{editing ? `Edit ${editing.title}` : 'Create job'}</h3><button onClick={() => setShowForm(false)} aria-label="Close job form"><X size={18}/></button></div><div className="grid gap-3 md:grid-cols-3">
      {field('title', 'Job title', true)}
      <label className="block text-sm font-medium text-slate-700">Associate type<select required className={inputClass} value={draft.guard_type} onChange={event => setDraft({ ...draft, guard_type: event.target.value })}><option value="">Select type</option>{associateTypes.map(type => <option key={type.code} value={type.code}>{type.name}</option>)}</select></label>
      <label className="block text-sm font-medium text-slate-700">Site<select className={inputClass} value={draft.site_id} onChange={event => setDraft({ ...draft, site_id: event.target.value })}><option value="">No site</option>{sites.map(site => <option key={site.id} value={site.id}>{site.siteName}</option>)}</select></label>
      {field('category', 'Category')}{field('guards_required', 'Associates required', true, 'number')}{field('salary_amount', 'Salary amount', true, 'number')}
      <label className="block text-sm font-medium text-slate-700">Payment frequency<select className={inputClass} value={draft.payment_type} onChange={event => setDraft({ ...draft, payment_type: event.target.value })}>{['Monthly', 'Weekly', 'Daily'].map(value => <option key={value}>{value}</option>)}</select></label>
      {field('duty_hours', 'Duty hours')}{field('shift_type', 'Shift type')}{field('start_date', 'Start date', false, 'date')}{field('end_date', 'End date', false, 'date')}
      <label className="block text-sm font-medium text-slate-700">Status<select className={inputClass} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="closed">Closed</option></select></label>
      <div className="md:col-span-3"><label className="block text-sm font-medium text-slate-700">Description<textarea className={inputClass} rows={3} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })}/></label></div>
    </div><div className="mt-4 flex justify-end gap-2"><button className={secondaryButton} onClick={() => setShowForm(false)}>Cancel</button><button className={primaryButton} disabled={Boolean(busy)} onClick={save}>{busy ? 'Saving...' : 'Save job'}</button></div></div>}
    <div className="space-y-3">{jobs.map(job => <article className="rounded-xl border border-slate-200 p-4" key={job.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold text-slate-900">{job.title}</h4><p className="text-sm text-slate-500">{job.site?.siteName || 'No site'} · {job.guardType || 'No associate type'} · {job.paymentType || 'Payment not set'} {job.salaryAmount != null ? `· ₹${job.salaryAmount}` : ''}</p><p className="mt-1 text-xs capitalize text-slate-500">{job.status}</p></div><div className="flex gap-2"><button className={secondaryButton} disabled={Boolean(busy)} onClick={() => { setEditing(job); setDraft(jobDraft(job)); setShowForm(true); }}><Pencil size={14}/> Edit</button><button className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={Boolean(busy)} onClick={() => remove(job)}><Trash2 size={14}/> Delete</button></div></div></article>)}{!jobs.length && <p className="py-6 text-center text-sm text-slate-500">No jobs are available for this company.</p>}</div>
  </section>;
}
