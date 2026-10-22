import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { exportExtendedReport, getExtendedReport, getExtendedReportDefinitions, getExtendedReportOptions, type ExtendedReport, type ExtendedReportDefinition, type ExtendedReportOptions, type ReportingRole } from '../../services/extendedReportService';
import { getErrorMessage } from '../../services/apiErrors';

const title = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
function display(value: unknown, key = ''): string {
  if (value == null) return 'Unavailable';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
  if (typeof value === 'string' && /^-?\d+\.\d{2}$/.test(value) && !key.endsWith('_id')) return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return String(value);
}
function Summary({ values }: { values: Record<string, unknown> }) {
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) =>
      <div key={key} className="min-w-0 rounded-xl border border-[#e6ddd8] bg-white p-3">
        <dt className="text-xs font-semibold text-[#6b5046]">{title(key)}</dt>
        <dd className="mt-1 break-words text-sm text-[#342523]">
          {value !== null && typeof value === 'object'
            ? <div className="max-h-64 space-y-1 overflow-auto">
              {Object.entries(value).length === 0 && <span>No matching entries</span>}
              {Object.entries(value).map(([name, entry]) => <div key={name}>
                <span className="font-medium">{title(name)}: </span>
                {entry !== null && typeof entry === 'object'
                  ? Object.entries(entry).map(([field, amount]) => `${title(field)}: ${display(amount, field)}`).join(' · ')
                  : display(entry, name)}
              </div>)}
            </div>
            : <span className="text-lg font-bold">{display(value, key)}</span>}
        </dd>
      </div>)}
  </dl>;
}
const control = 'rounded-lg border border-[#dfd2c7] bg-white px-3 py-2 text-sm text-[#342523]';
type Filters = Record<string, string>;

export default function ExtendedReports({ role }: { role: ReportingRole }) {
  const [definitions, setDefinitions] = useState<ExtendedReportDefinition[]>([]);
  const [kind, setKind] = useState(() => new URLSearchParams(window.location.search).get('extended_report') ?? '');
  const [draft, setDraft] = useState<Filters>({});
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState('50');
  const [data, setData] = useState<ExtendedReport | null>(null), [dataKey, setDataKey] = useState('');
  const [loading, setLoading] = useState(true), [exporting, setExporting] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [refresh, setRefresh] = useState(0);
  const [options, setOptions] = useState<ExtendedReportOptions>({ options: {}, truncated: [] });
  const [optionSearch, setOptionSearch] = useState(''), [optionError, setOptionError] = useState('');
  const definition = definitions.find(r => r.kind === kind);
  const params = useMemo(() => ({ ...filters, page: String(page), page_size: pageSize }), [filters, page, pageSize]);
  const requestKey = JSON.stringify([role, kind, params]);
  const visible = dataKey === requestKey ? data : null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getExtendedReportDefinitions(role, controller.signal).then(reports => {
      if (controller.signal.aborted) return;
      setDefinitions(reports); setKind(current => reports.some(r => r.kind === current) ? current : reports[0]?.kind ?? '');
    }).catch(cause => { if (!controller.signal.aborted) { setError(getErrorMessage(cause)); setLoading(false); } });
    return () => controller.abort();
  }, [role, refresh]);
  useEffect(() => {
    if (!definition) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setOptionError('');
      getExtendedReportOptions(role, kind, optionSearch, controller.signal).then(result => { if (!controller.signal.aborted) setOptions(result); })
        .catch(cause => { if (!controller.signal.aborted) setOptionError(getErrorMessage(cause)); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [role, kind, definition, optionSearch, refresh]);
  useEffect(() => {
    if (!definition) return;
    const controller = new AbortController(); setLoading(true); setError('');
    getExtendedReport(role, kind, params, controller.signal).then(result => {
      if (!controller.signal.aborted) { setData(result); setDataKey(requestKey); }
    }).catch(cause => { if (!controller.signal.aborted) { setError(getErrorMessage(cause)); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [role, kind, params, definition, requestKey, refresh]);

  const select = (next: string) => {
    setKind(next); setDraft({}); setFilters({}); setPage(1); setError(''); setNotice('');
    setOptions({ options: {}, truncated: [] }); setOptionSearch(''); setOptionError('');
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('extended_report', next); window.history.replaceState({}, '', url);
  };
  const change = (key: string, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const apply = () => { setFilters(Object.fromEntries(Object.entries(draft).filter(([, value]) => value.trim() !== '').map(([key, value]) => [key, value.trim()]))); setPage(1); setNotice(''); };
  const exportRows = async () => {
    setExporting(true); setNotice('');
    try { await exportExtendedReport(role, kind, params); setNotice('CSV downloaded for all matching records.'); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setExporting(false); }
  };

  return <section className="space-y-4 p-4 md:p-6 text-[#342523]">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold">{role === 'guard' ? 'My Reports & Statements' : 'Extended Reports'}</h1><p className="text-sm text-[#6b5046]">{role === 'super_admin' ? 'Platform-wide' : role === 'finance' ? 'Finance withdrawal scope' : 'Your authorised account and assignments'} · IST dates · INR</p></div><button className={control} onClick={() => setRefresh(value => value + 1)} aria-label="Refresh reports"><RefreshCw size={17}/></button></div>
    <label className="block text-sm font-semibold">Report<select className={`${control} mt-1 block w-full sm:max-w-xl`} value={kind} onChange={event => select(event.target.value)}>{definitions.map(report => <option key={report.kind} value={report.kind}>{report.label}</option>)}</select></label>
    {definition && <form onSubmit={event => { event.preventDefault(); apply(); }} className="flex flex-wrap items-end gap-3 rounded-xl bg-[#faf6f0] p-3">
      {definition.dates && <><label className="text-xs">From<input className={`${control} mt-1 block`} type="date" value={draft.date_from ?? ''} onChange={event => change('date_from', event.target.value)}/></label><label className="text-xs">Through<input className={`${control} mt-1 block`} type="date" value={draft.date_to ?? ''} onChange={event => change('date_to', event.target.value)}/></label></>}
      {definition.filters.includes('status') && <label className="text-xs">Status<input autoComplete="off" className={`${control} mt-1 block`} placeholder="All statuses" value={draft.status ?? ''} onChange={event => change('status', event.target.value)}/></label>}
      {definition.filters.includes('source') && <label className="text-xs">Credit source<select className={`${control} mt-1 block`} value={draft.source ?? ''} onChange={event => change('source', event.target.value)}><option value="">All sources</option><option value="admin_credit">Admin credit</option><option value="mock_gateway_recharge">Mock recharge</option></select></label>}
      {Object.entries(options.options).map(([field, choices]) => <label key={field} className="text-xs">{field === 'employer_id' ? 'Employer' : field === 'guard_id' ? 'Associate' : 'Company'}<select className={`${control} mt-1 block max-w-xs`} value={draft[field] ?? ''} onChange={event => change(field, event.target.value)}><option value="">All</option>{draft[field] && !choices.some(choice => choice.id === draft[field]) && <option value={draft[field]}>Selected account / company</option>}{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>)}
      {Object.keys(options.options).length > 0 && <label className="text-xs">Find account / company<input autoComplete="off" className={`${control} mt-1 block`} value={optionSearch} onChange={event => setOptionSearch(event.target.value)} placeholder="Search selector names"/></label>}
      <button type="submit" className="rounded-lg bg-[#6f3427] px-4 py-2 text-sm font-semibold text-white">Apply</button><button type="button" className={control} onClick={() => { setDraft({}); setFilters({}); setPage(1); }}>Clear</button>
      <button type="button" disabled={loading || exporting || !visible || !!error} onClick={() => void exportRows()} className={`${control} flex items-center gap-2 disabled:opacity-40`}><Download size={16}/>{exporting ? 'Exporting…' : 'Export CSV'}</button>
    </form>}
    {optionError && <p role="alert" className="text-sm text-red-800">Filter options: {optionError}</p>}
    {options.truncated.length > 0 && <p className="text-sm text-amber-800">Showing the first 500 selector matches. Search by name to narrow the choices.</p>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
    {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {loading && <div role="status" className="rounded-xl bg-[#faf6f0] p-6 text-center">Loading report…</div>}
    {visible && !error && <>
      <Summary values={visible.summary}/>
      {visible.meta.warnings.map(warning => <p key={warning.code} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning.message}</p>)}
      <p className="text-xs text-[#6b5046]">{visible.meta.date_basis} · Generated {display(visible.meta.generated_at)} · Totals cover all matching records.</p>
      <div className="overflow-x-auto rounded-xl border border-[#e6ddd8] bg-white"><table className="min-w-full text-sm"><thead className="bg-[#faf6f0]"><tr>{visible.columns.map(column => <th key={column.key} className="whitespace-nowrap p-3 text-left">{column.label}</th>)}</tr></thead><tbody>{visible.items.map(row => <tr key={String(row.id)} className="border-t border-[#efe8e0]">{visible.columns.map(column => <td key={column.key} className="max-w-xs break-words p-3">{display(row[column.key], column.key)}</td>)}</tr>)}{!visible.items.length && <tr><td colSpan={visible.columns.length} className="p-8 text-center text-[#6b5046]">No matching records.</td></tr>}</tbody></table></div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><button disabled={page <= 1 || loading} className={`${control} disabled:opacity-40`} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, visible.pagination.total_pages)} · {visible.pagination.total} records</span><button disabled={page >= visible.pagination.total_pages || loading} className={`${control} disabled:opacity-40`} onClick={() => setPage(value => value + 1)}>Next</button><label>Rows <select className={control} value={pageSize} onChange={event => { setPageSize(event.target.value); setPage(1); }}>{['25', '50', '100'].map(size => <option key={size}>{size}</option>)}</select></label></div>
    </>}
  </section>;
}
