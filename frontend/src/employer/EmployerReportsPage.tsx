import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, ArrowLeft } from 'lucide-react';
import { getEmployerReport, getEmployerReportOptions, downloadEmployerReport, type EmployerReport, type EmployerReportKind } from '../services/employerReportService';

type Option = { id: string; label: string; siteId?: string };
const tabs: { kind: EmployerReportKind; label: string; group: string }[] = [
  { kind: 'job-hiring', label: 'Job & Hiring', group: 'jobs' },
  { kind: 'interviews', label: 'Interviews', group: 'documents' },
  { kind: 'offers', label: 'Offers', group: 'documents' },
  { kind: 'agreements', label: 'Agreements', group: 'documents' },
  { kind: 'attendance', label: 'Attendance & Approval', group: 'attendance' },
  { kind: 'attendance-exceptions', label: 'Attendance Exceptions', group: 'attendance' },
];
const dateOptions: Record<EmployerReportKind, [string, string][]> = {
  'job-hiring': [['posted', 'Job posted date']], applications: [['applied', 'Application date']],
  interviews: [['created', 'Request created date'], ['preferred', 'Preferred interview date']],
  offers: [['created', 'Offer created date'], ['start', 'Offer start date']],
  agreements: [['created', 'Agreement created date'], ['signed', 'Signed date']],
  attendance: [['attendance', 'Attendance date']],
  'attendance-exceptions': [['requested', 'Request created date'], ['decided', 'Decision date']],
};
const statuses: Record<EmployerReportKind, string[]> = {
  'job-hiring': ['draft', 'pending_approval', 'active', 'rejected', 'closed'],
  applications: ['pending', 'applied', 'under_review', 'shortlisted', 'scheduled', 'selected', 'offer_sent', 'hired', 'joined', 'leave_requested', 'released', 'rejected', 'not_hired'],
  interviews: ['requested', 'scheduled', 'completed', 'cancelled', 'rejected'],
  offers: ['sent', 'accepted', 'declined', 'released', 'cancelled'],
  agreements: ['draft', 'pending', 'signed', 'active', 'completed', 'cancelled'],
  attendance: ['pending_verification', 'approved', 'verified', 'rejected'],
  'attendance-exceptions': ['pending', 'approved', 'rejected'],
};
function display(value: unknown, key = '') {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`).join(' · ') || 'None';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    if (['attendance_date', 'preferred_date', 'start_date'].includes(key)) return text.slice(0, 10);
    return new Date(text).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  }
  return text;
}
function initialKind(): EmployerReportKind {
  const value = new URLSearchParams(window.location.search).get('report');
  return value === 'applications' || tabs.some(t => t.kind === value) ? value as EmployerReportKind : 'job-hiring';
}

export default function EmployerReportsPage({ company }: { company: { id: string; company_name?: string } }) {
  const [kind, setKind] = useState<EmployerReportKind>(initialKind);
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('report_company') !== company.id) return {};
    return Object.fromEntries(['date_from', 'date_to', 'date_basis', 'site_id', 'job_id', 'status', 'entry_mode', 'checkout_method', 'request_type', 'associate_type', 'guard_id'].flatMap(k => params.get(k) ? [[k, params.get(k)!]] : []));
  });
  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const saved = Number(params.get('page'));
    return params.get('report_company') === company.id && Number.isInteger(saved) && saved >= 1 && saved <= 1_000_000 ? saved : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const params = new URLSearchParams(window.location.search), saved = params.get('page_size') ?? '';
    return params.get('report_company') === company.id && ['25', '50', '100'].includes(saved) ? saved : '50';
  });
  const [data, setData] = useState<EmployerReport | null>(null);
  const [dataKey, setDataKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [jobs, setJobs] = useState<Option[]>([]);
  const [sites, setSites] = useState<Option[]>([]);
  const [associates, setAssociates] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [optionsError, setOptionsError] = useState('');
  const params = useMemo(() => ({ ...filters, company_id: company.id, page: String(page), page_size: pageSize }), [filters, company.id, page, pageSize]);
  const requestKey = JSON.stringify([kind, params]);
  const visible = dataKey === requestKey ? data : null;
  const change = (key: string, value: string) => {
    setPage(1); setNotice('');
    setFilters(old => {
      const next = { ...old };
      if (value) next[key] = value; else delete next[key];
      if (key === 'site_id') delete next.job_id;
      return next;
    });
  };
  const selectKind = (next: EmployerReportKind) => { setKind(next); setPage(1); setFilters({}); setNotice(''); };

  useEffect(() => {
    const controller = new AbortController();
    setOptionsError('');
    getEmployerReportOptions(company.id, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setJobs(result.jobs); setSites(result.sites); setAssociates(result.associates); setTypes(result.types);
      setOptionsError(result.warnings.join(' '));
    }).catch(cause => { if (!controller.signal.aborted) setOptionsError(cause.message || 'Unable to load job/site filters.'); });
    return () => controller.abort();
  }, [company.id, refresh]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getEmployerReport(kind, params, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setData(result); setDataKey(requestKey);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message || 'Unable to load the report.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, params, requestKey, refresh]);

  useEffect(() => {
    const url = new URL(window.location.href);
    for (const key of ['report', 'report_company', 'date_from', 'date_to', 'date_basis', 'site_id', 'job_id', 'status', 'entry_mode', 'checkout_method', 'request_type', 'associate_type', 'guard_id', 'page', 'page_size']) url.searchParams.delete(key);
    url.searchParams.set('report', kind);
    url.searchParams.set('report_company', company.id);
    for (const [key, value] of Object.entries(params)) if (key !== 'company_id') url.searchParams.set(key, value);
    window.history.replaceState({}, '', url);
  }, [company.id, kind, params, requestKey]);

  const exportRows = async () => {
    setExporting(true); setNotice('');
    try { await downloadEmployerReport(kind, params); setNotice('CSV downloaded for all matching records.'); }
    catch (cause) { setNotice(`Export failed: ${(cause as Error).message}`); }
    finally { setExporting(false); }
  };
  const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm';
  return <div className="p-4 md:p-6 space-y-5">
    <div><h1 className="text-xl font-bold">Employer Reports</h1><p className="text-sm text-gray-600">{company.company_name ?? 'Selected company'} · Read-only · Dates shown in IST</p></div>
    <div className="flex gap-2 flex-wrap">{tabs.map(tab => <button key={tab.kind} onClick={() => selectKind(tab.kind)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${kind === tab.kind ? 'bg-slate-900 text-white' : 'bg-white border'}`}>{tab.label}</button>)}</div>
    {kind === 'applications' && <button className="flex gap-2 text-sm font-semibold" onClick={() => selectKind('job-hiring')}><ArrowLeft size={16}/> Back to Job & Hiring</button>}
    <div className="rounded-xl border bg-white p-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-gray-600">Site<select className={inputClass} value={filters.site_id ?? ''} onChange={e => change('site_id', e.target.value)}><option value="">All sites</option>{sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label className="text-xs text-gray-600">Job<select className={inputClass} value={filters.job_id ?? ''} onChange={e => change('job_id', e.target.value)}><option value="">All jobs</option>{jobs.filter(j => !filters.site_id || j.siteId === filters.site_id).map(j => <option key={j.id} value={j.id}>{j.label}</option>)}</select></label>
        <label className="text-xs text-gray-600">Status<select className={inputClass} value={filters.status ?? ''} onChange={e => change('status', e.target.value)}><option value="">All statuses</option>{statuses[kind].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></label>
        <label className="text-xs text-gray-600">Date basis<select className={inputClass} value={filters.date_basis ?? dateOptions[kind][0][0]} onChange={e => change('date_basis', e.target.value)}>{dateOptions[kind].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-xs text-gray-600">From<input autoComplete="off" type="date" className={inputClass} value={filters.date_from ?? ''} onChange={e => change('date_from', e.target.value)}/></label>
        <label className="text-xs text-gray-600">Through<input autoComplete="off" type="date" className={inputClass} value={filters.date_to ?? ''} onChange={e => change('date_to', e.target.value)}/></label>
        {kind === 'job-hiring' ? <label className="text-xs text-gray-600">Associate type<select className={inputClass} value={filters.associate_type ?? ''} onChange={e => change('associate_type', e.target.value)}><option value="">All types</option>{types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label> : <label className="text-xs text-gray-600">Associate<select className={inputClass} value={filters.guard_id ?? ''} onChange={e => change('guard_id', e.target.value)}><option value="">All associates</option>{associates.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>}
        {kind === 'attendance' && <>
          <label className="text-xs text-gray-600">Entry mode<select className={inputClass} value={filters.entry_mode ?? ''} onChange={e => change('entry_mode', e.target.value)}>{['', 'live', 'historical_manual', 'associate_edited', 'live_location_disabled', 'exception_request'].map(v => <option key={v} value={v}>{v ? v.replace(/_/g, ' ') : 'All entry modes'}</option>)}</select></label>
          <label className="text-xs text-gray-600">Checkout method<select className={inputClass} value={filters.checkout_method ?? ''} onChange={e => change('checkout_method', e.target.value)}>{['', 'associate', 'automatic', 'historical_manual', 'exception_request'].map(v => <option key={v} value={v}>{v ? v.replace(/_/g, ' ') : 'All checkout methods'}</option>)}</select></label>
        </>}
        {kind === 'attendance-exceptions' && <label className="text-xs text-gray-600">Request type<select className={inputClass} value={filters.request_type ?? ''} onChange={e => change('request_type', e.target.value)}><option value="">All request types</option><option value="check_in">Check-in</option><option value="check_out">Check-out</option></select></label>}
      </div>
      <div className="flex gap-3 mt-4 flex-wrap items-center">
        <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setFilters({}); setPage(1); }}>Clear filters</button>
        <button disabled={loading} className="flex gap-2 items-center rounded-lg border px-3 py-2 text-sm" onClick={() => setRefresh(n => n + 1)}><RefreshCw size={16}/> {loading ? 'Refreshing…' : 'Refresh'}</button>
        <button disabled={!visible || loading || !!error || exporting} className="flex gap-2 items-center rounded-lg bg-slate-900 text-white px-3 py-2 text-sm disabled:opacity-40" onClick={exportRows}><Download size={16}/> {exporting ? 'Exporting…' : 'Export CSV'}</button>
        <span className="text-xs text-gray-500">Export includes all matching rows, up to 5,000.</span>
      </div>
    </div>
    {optionsError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">Filter options unavailable: {optionsError} <button className="underline" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700 text-sm">{error} {visible && 'Displayed results are stale.'} <button className="underline" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
    {notice && <p role="status" className={`rounded-lg p-3 text-sm ${notice.startsWith('Export failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{notice}</p>}
    {kind === 'job-hiring' && <p className="text-sm text-gray-600">Filled positions are current hired, joined and leave-requested applications. Posting dates select jobs; they do not remove older filled applications.</p>}
    {kind !== 'job-hiring' && <p className="text-xs text-gray-500">Only records owned by your account and linked to a job in the selected company are included. Unlinked records are outside this company register.</p>}
    {kind === 'attendance' && <p className="text-sm text-gray-600">Recorded hours are not a payroll calculation. Approval and processing settlement do not mean bank payout is complete. Reports read stored attendance without triggering checkout.</p>}
    {loading && !visible && <div role="status" className="animate-pulse rounded-xl bg-gray-100 p-12 text-center">Loading report…</div>}
    {visible && <>
      {visible.meta.warnings.map((w, i) => <p key={`${w.code}-${i}`} className="rounded-lg bg-amber-50 p-3 text-sm">{w.message}</p>)}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{Object.entries(visible.summary).map(([key, value]) => <div key={key} className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p><p className="mt-1 text-sm font-semibold break-words">{display(value)}</p></div>)}</div>
      <p className="text-xs text-gray-500">{dateOptions[kind].find(([basis]) => basis === (filters.date_basis ?? dateOptions[kind][0][0]))?.[1]} · Generated {display(visible.meta.generated_at)} IST · Totals cover all matching records.</p>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr>{visible.columns.map(c => <th key={c.key} className="p-3 text-left whitespace-nowrap">{c.label}</th>)}{kind === 'job-hiring' && <th className="p-3">Details</th>}</tr></thead><tbody>{visible.items.map(row => <tr key={String(row.id)} className="border-t">{visible.columns.map(c => <td key={c.key} className="p-3 max-w-xs break-words">{display(row[c.key], c.key)}</td>)}{kind === 'job-hiring' && <td className="p-3"><button className="text-blue-700 underline" onClick={() => { setKind('applications'); setFilters({ job_id: String(row.id) }); setPage(1); }}>Applications</button></td>}</tr>)}</tbody></table>
        {!visible.items.length && <div className="p-10 text-center text-gray-500">{visible.pagination.total ? 'No rows on this page. Return to the first page.' : Object.keys(filters).length ? 'No records match these filters.' : 'No records for this company yet.'}</div>}
      </div>
      <div className="flex gap-3 items-center flex-wrap text-sm">
        <button disabled={page <= 1 || loading} className="rounded border p-2 disabled:opacity-40" onClick={() => setPage(p => p - 1)}>Previous</button>
        <span>Page {page} of {Math.max(1, visible.pagination.total_pages)} · {visible.pagination.total} records</span>
        <button disabled={page >= visible.pagination.total_pages || loading} className="rounded border p-2 disabled:opacity-40" onClick={() => setPage(p => p + 1)}>Next</button>
        <label>Rows <select className="rounded border p-2" value={pageSize} onChange={e => { setPageSize(e.target.value); setPage(1); }}>{['25', '50', '100'].map(v => <option key={v}>{v}</option>)}</select></label>
      </div>
    </>}
  </div>;
}
