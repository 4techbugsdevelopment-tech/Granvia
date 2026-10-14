import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, ArrowLeft } from 'lucide-react';
import { getAdminReport, getAdminReportOptions, downloadAdminReport, type AdminReport, type AdminReportKind, type AdminReportOptions, type ReportOption } from '../../services/adminReportService';

type Spec = { label: string; fields: string[]; dates: [string, string][]; statuses?: string[]; note?: string };
const owner = ['employer_id', 'company_id'], job = [...owner, 'site_id', 'job_id'];
const account = ['active', 'inactive', 'blocked', 'pending'], verification = ['pending', 'verified', 'rejected'];
const specs: Record<AdminReportKind, Spec> = {
  'platform-summary': { label: 'Platform Operational Summary', fields: [], dates: [['activity', 'Activity dates (shown per metric)']], note: 'Current status counts are snapshots. Date filters apply to activity metrics only; they do not reconstruct historical account or job status.' },
  'employer-verification': { label: 'Employer Verification', fields: [...owner, 'status', 'verification_status', 'aadhaar_status', 'profile_status', 'sub_admin_id', 'sales_id', 'city', 'state'], dates: [['registered', 'Employer registration date']], statuses: account },
  'company-verification': { label: 'Company Verification', fields: [...owner, 'status', 'verification_status', 'sub_admin_id', 'sales_id', 'city', 'state'], dates: [['created', 'Company creation date']], statuses: account },
  'company-documents': { label: 'Company Documents', fields: [...owner, 'status', 'document_type', 'sub_admin_id', 'sales_id', 'city', 'state'], dates: [['uploaded', 'Document upload date']], statuses: verification },
  'associate-verification': { label: 'Associate Verification & Profile', fields: ['guard_id', 'associate_type', 'status', 'verification_status', 'aadhaar_status', 'police_status', 'agreement_status', 'sub_admin_id', 'city', 'state'], dates: [['registered', 'Associate registration date']], statuses: account, note: 'Overall, Aadhaar and police status are separate stored values. Current onboarding agreement means the current version, not the latest historical document.' },
  'associate-documents': { label: 'Associate Documents', fields: ['guard_id', 'associate_type', 'status', 'verification_status', 'document_type', 'sub_admin_id', 'city', 'state'], dates: [['uploaded', 'Document upload date'], ['reviewed', 'Document review date']], statuses: verification },
  'job-hiring': { label: 'Platform Job & Hiring', fields: [...job, 'status', 'associate_type'], dates: [['posted', 'Job posting date']], statuses: ['draft', 'pending_approval', 'active', 'closed', 'rejected'], note: 'Filled positions are current hired, joined and leave-requested applications. Posting dates select jobs without removing older occupied positions.' },
  applications: { label: 'Job Applications', fields: [...job, 'guard_id', 'status'], dates: [['applied', 'Application date']], statuses: ['pending', 'applied', 'under_review', 'shortlisted', 'scheduled', 'selected', 'offer_sent', 'hired', 'joined', 'leave_requested', 'released', 'rejected', 'not_hired'] },
  attendance: { label: 'Attendance', fields: [...job, 'guard_id', 'status', 'entry_mode', 'checkout_method'], dates: [['attendance', 'Attendance date']], statuses: ['pending_verification', 'approved', 'verified', 'rejected'], note: 'Recorded hours are not payroll. Approval, processing settlement and completed bank payout are different events. Unlinked attendance remains visible in the platform-wide view.' },
  'attendance-exceptions': { label: 'Attendance Exceptions', fields: [...job, 'guard_id', 'status', 'request_type'], dates: [['requested', 'Request creation date'], ['decided', 'Decision date']], statuses: ['pending', 'approved', 'rejected'] },
  'attendance-audit': { label: 'Attendance Audit', fields: [...job, 'guard_id', 'actor_id', 'event_type', 'attendance_id', 'exception_id'], dates: [['event', 'Audit event time'], ['attendance', 'Attendance date']], note: 'Audit-event absence does not prove that no action occurred. Exact GPS, IP addresses and technical request details are excluded from these registers and exports.' },
};
const groups: { label: string; kinds: AdminReportKind[] }[] = [
  { label: 'Platform Summary', kinds: ['platform-summary'] }, { label: 'Employer & Company', kinds: ['employer-verification', 'company-verification', 'company-documents'] },
  { label: 'Associate Verification', kinds: ['associate-verification', 'associate-documents'] }, { label: 'Job & Hiring', kinds: ['job-hiring'] },
  { label: 'Attendance / Exceptions / Audit', kinds: ['attendance', 'attendance-exceptions', 'attendance-audit'] },
];
const labels: Record<string, string> = { employer_id: 'Employer', company_id: 'Company', site_id: 'Site', job_id: 'Job', guard_id: 'Associate', actor_id: 'Actor', status: 'Status', verification_status: 'Overall verification', aadhaar_status: 'Aadhaar status', police_status: 'Police status', profile_status: 'Profile status', agreement_status: 'Current agreement status', sub_admin_id: 'Sub Admin', sales_id: 'Sales Executive', associate_type: 'Associate type', document_type: 'Document type', city: 'City', state: 'State', entry_mode: 'Entry mode', checkout_method: 'Checkout method', request_type: 'Request type', event_type: 'Event type', attendance_id: 'Attendance ID', exception_id: 'Exception request ID' };
function display(value: unknown, key = ''): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`).join(' · ') || 'None';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return key === 'attendance_date' ? text.slice(0, 10) : new Date(text).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return text;
}
const paramsFromUrl = () => new URLSearchParams(window.location.search);
export default function OperationalReports() {
  const [kind, setKind] = useState<AdminReportKind>(() => { const saved = paramsFromUrl().get('admin_report'); return saved && Object.prototype.hasOwnProperty.call(specs, saved) ? saved as AdminReportKind : 'platform-summary'; });
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const params = paramsFromUrl(), saved = params.get('admin_report');
    const spec = saved && Object.prototype.hasOwnProperty.call(specs, saved) ? specs[saved as AdminReportKind] : specs['platform-summary'];
    return Object.fromEntries([...spec.fields, 'date_from', 'date_to', 'date_basis'].flatMap(k => params.get(k) ? [[k, params.get(k)!]] : []));
  });
  const [draft, setDraft] = useState(filters);
  const [page, setPage] = useState(() => { const value = Number(paramsFromUrl().get('page')); return Number.isInteger(value) && value >= 1 && value <= 1000000 ? value : 1; });
  const [pageSize, setPageSize] = useState(() => { const value = paramsFromUrl().get('page_size'); return value && ['25', '50', '100'].includes(value) ? value : '50'; });
  const [data, setData] = useState<AdminReport | null>(null), [dataKey, setDataKey] = useState('');
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [options, setOptions] = useState<AdminReportOptions | null>(null), [optionsError, setOptionsError] = useState('');
  const [exporting, setExporting] = useState(false), [notice, setNotice] = useState('');
  const spec = specs[kind], group = groups.find(g => g.kinds.includes(kind)) ?? groups[3];
  const params = useMemo(() => ({ ...filters, page: String(page), page_size: pageSize }), [filters, page, pageSize]);
  const requestKey = JSON.stringify([kind, params]), visible = dataKey === requestKey ? data : null;
  const draftEmployer = draft.employer_id, draftCompany = draft.company_id;
  const ownerParams = useMemo(() => ({ ...(draftEmployer ? { employer_id: draftEmployer } : {}), ...(draftCompany ? { company_id: draftCompany } : {}) }), [draftEmployer, draftCompany]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    getAdminReport(kind, params, controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setDataKey(requestKey); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Unable to load this report.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, params, requestKey, refresh]);
  useEffect(() => {
    const controller = new AbortController(); setOptionsError('');
    getAdminReportOptions(ownerParams, controller.signal).then(result => { if (!controller.signal.aborted) setOptions(result); })
      .catch(cause => { if (!controller.signal.aborted) setOptionsError(cause.message || 'Unable to load filter options.'); });
    return () => controller.abort();
  }, [ownerParams, refresh]);
  useEffect(() => {
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('admin_report', kind);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    window.history.replaceState({}, '', url);
  }, [kind, params]);
  const selectKind = (next: AdminReportKind, preset: Record<string, string> = {}) => { setKind(next); setFilters(preset); setDraft(preset); setPage(1); setNotice(''); };
  const change = (key: string, value: string) => setDraft(previous => {
    const next = { ...previous }; if (value) next[key] = value; else delete next[key];
    if (key === 'employer_id') { delete next.company_id; delete next.site_id; delete next.job_id; }
    if (key === 'company_id') { delete next.site_id; delete next.job_id; }
    if (key === 'site_id') delete next.job_id;
    return next;
  });
  const choices = (key: string): ReportOption[] | null => {
    const simple: Record<string, string[]> = { verification_status: verification, aadhaar_status: verification, police_status: verification, profile_status: ['incomplete', 'pending', 'complete', 'verified', 'rejected'], agreement_status: ['NOT_GENERATED', 'DRAFT', 'READY_FOR_SIGNATURE', 'ESIGN_INITIATED', 'ESIGN_PENDING', 'ESIGN_SUCCESS', 'VERIFICATION_PENDING', 'SIGNED', 'SANDBOX_SIGNED', 'ESIGN_FAILED', 'ESIGN_CANCELLED', 'EXPIRED', 'VOID', 'SUPERSEDED'], entry_mode: ['live', 'live_location_disabled', 'historical_manual', 'associate_edited', 'exception_request'], checkout_method: ['associate', 'automatic', 'historical_manual', 'exception_request'], request_type: ['check_in', 'check_out'] };
    if (key === 'status') return (spec.statuses ?? []).map(id => ({ id, label: id.replace(/_/g, ' ') }));
    if (simple[key]) return simple[key].map(id => ({ id, label: id.replace(/_/g, ' ') }));
    const map: Record<string, keyof AdminReportOptions> = { employer_id: 'employers', company_id: 'companies', site_id: 'sites', job_id: 'jobs', guard_id: 'associates', associate_type: 'types' };
    if (map[key]) { const values = options?.[map[key]] ?? []; return key === 'job_id' && draft.site_id ? values.filter(v => v.siteId === draft.site_id) : values; }
    if (key === 'sub_admin_id' || key === 'sales_id') return (options?.staff ?? []).filter(v => v.role === (key === 'sub_admin_id' ? 'sub_admin' : 'sales_executive'));
    if (key === 'actor_id') return [...(options?.staff ?? []), ...(options?.associates ?? [])];
    return null;
  };
  const exportRows = async () => { setExporting(true); setNotice(''); try { await downloadAdminReport(kind, params); setNotice('CSV downloaded for all matching records.'); } catch (cause) { setNotice(`Export failed: ${(cause as Error).message}`); } finally { setExporting(false); } };
  const control = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm';
  return <div className="p-4 md:p-6 space-y-5">
    <div><h1 className="text-xl font-bold">Reports</h1><p className="text-sm text-gray-600">Super Admin · Platform-wide read-only reporting · IST dates</p></div>
    <div className="flex gap-2 flex-wrap">{groups.map(g => <button key={g.label} onClick={() => selectKind(g.kinds[0])} className={`rounded-lg px-3 py-2 text-sm font-semibold ${group === g ? 'bg-slate-900 text-white' : 'border bg-white'}`}>{g.label}</button>)}</div>
    {group.kinds.length > 1 && <div className="flex gap-2 flex-wrap">{group.kinds.map(k => <button key={k} className={`rounded-lg border px-3 py-2 text-sm ${kind === k ? 'bg-blue-50 text-blue-800' : 'bg-white'}`} onClick={() => selectKind(k)}>{specs[k].label}</button>)}</div>}
    {kind === 'applications' && <button className="flex gap-2 text-sm" onClick={() => selectKind('job-hiring')}><ArrowLeft size={16}/> Back to Job & Hiring</button>}
    <h2 className="font-semibold">{spec.label}</h2>
    <form className="rounded-xl border bg-white p-4" autoComplete="off" onSubmit={e => { e.preventDefault(); setFilters({ ...draft }); setPage(1); setNotice(''); }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{spec.fields.map(key => {
        const values = choices(key);
        return <label key={key} className="text-xs text-gray-600">{labels[key] ?? key}{values ? <select className={control} value={draft[key] ?? ''} onChange={e => change(key, e.target.value)}><option value="">All</option>{draft[key] && !values.some(v => v.id === draft[key]) && <option value={draft[key]}>{draft[key]}</option>}{values.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select> : <input autoComplete="off" className={control} value={draft[key] ?? ''} placeholder="All" onChange={e => change(key, e.target.value)}/>}</label>;
      })}
      <label className="text-xs text-gray-600">Date basis<select className={control} value={draft.date_basis ?? spec.dates[0][0]} onChange={e => change('date_basis', e.target.value)}>{spec.dates.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs text-gray-600">From<input autoComplete="off" type="date" className={control} value={draft.date_from ?? ''} onChange={e => change('date_from', e.target.value)}/></label>
      <label className="text-xs text-gray-600">Through<input autoComplete="off" type="date" className={control} value={draft.date_to ?? ''} onChange={e => change('date_to', e.target.value)}/></label>
      </div><div className="flex gap-3 flex-wrap mt-4 items-center">
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Apply filters</button>
        <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setDraft({}); setFilters({}); setPage(1); }}>Clear filters</button>
        <button type="button" disabled={loading} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => setRefresh(v => v + 1)}><RefreshCw size={16}/>{loading ? 'Refreshing…' : 'Refresh'}</button>
        <button type="button" disabled={!visible || loading || !!error || exporting} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={exportRows}><Download size={16}/>{exporting ? 'Exporting…' : 'Export CSV'}</button>
        <span className="text-xs text-gray-500">Complete filtered export, up to 5,000 rows.</span>
      </div>
    </form>
    {spec.note && <p className="text-sm text-gray-600">{spec.note}</p>}
    {optionsError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">Filter options unavailable: {optionsError} <button className="underline" onClick={() => setRefresh(v => v + 1)}>Retry</button></p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} {visible && 'Displayed results are stale.'} <button className="underline" onClick={() => setRefresh(v => v + 1)}>Retry</button></p>}
    {notice && <p role="status" className={`rounded-lg p-3 text-sm ${notice.startsWith('Export failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{notice}</p>}
    {loading && !visible && <div role="status" className="animate-pulse rounded-xl bg-gray-100 p-12 text-center">Loading report…</div>}
    {visible && <>
      {visible.meta.warnings.map((w, i) => <p key={`${w.code}-${i}`} className="rounded-lg bg-amber-50 p-3 text-sm">{w.message}</p>)}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{Object.entries(visible.summary).map(([key, value]) => <div key={key} className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p><p className="text-sm font-semibold mt-1 break-words">{display(value)}</p></div>)}</div>
      <p className="text-xs text-gray-500">Applied scope: {Object.keys(visible.meta.scope).length ? Object.entries(visible.meta.scope).map(([key, value]) => `${key.replace(/UserId|Id/g, '')}: ${options?.employers.find(o => o.id === value)?.label ?? options?.companies.find(o => o.id === value)?.label ?? options?.sites.find(o => o.id === value)?.label ?? options?.jobs.find(o => o.id === value)?.label ?? value}`).join(' · ') : 'Entire platform'} · Generated {display(visible.meta.generated_at)} IST · Totals cover all matching records.</p>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr>{visible.columns.map(c => <th className="p-3 text-left whitespace-nowrap" key={c.key}>{c.label}</th>)}{kind === 'job-hiring' && <th className="p-3">Details</th>}</tr></thead><tbody>{visible.items.map(row => <tr className="border-t" key={String(row.id)}>{visible.columns.map(c => <td className="p-3 max-w-xs break-words" key={c.key}>{display(row[c.key], c.key)}</td>)}{kind === 'job-hiring' && <td className="p-3"><button className="text-blue-700 underline" onClick={() => selectKind('applications', { job_id: String(row.id) })}>Applications</button></td>}</tr>)}</tbody></table>
        {!visible.items.length && <div className="p-10 text-center text-gray-500">{visible.pagination.total ? 'No rows on this page. Return to the first page.' : Object.keys(filters).length ? 'No records match these filters.' : 'No records yet.'}</div>}
      </div>
      {kind !== 'platform-summary' && <div className="flex gap-3 items-center flex-wrap text-sm"><button className="rounded border p-2 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {Math.max(1, visible.pagination.total_pages)} · {visible.pagination.total} records</span><button className="rounded border p-2 disabled:opacity-40" disabled={page >= visible.pagination.total_pages || loading} onClick={() => setPage(p => p + 1)}>Next</button><label>Rows <select className="rounded border p-2" value={pageSize} onChange={e => { setPageSize(e.target.value); setPage(1); }}>{['25', '50', '100'].map(v => <option key={v}>{v}</option>)}</select></label></div>}
    </>}
  </div>;
}
