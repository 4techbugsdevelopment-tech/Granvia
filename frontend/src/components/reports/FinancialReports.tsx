import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { getFinancialReport, getFinancialOptions, downloadFinancialReport, type FinancialReport, type FinancialKind, type FinancialRole, type FinancialOptions, type FinancialOption } from '../../services/financialReportService';

const labels: Record<FinancialKind, string> = { payments: 'Payment & Settlement Register', 'wallet-statement': 'Employer Wallet Statement', wallets: 'Employer Wallets', 'wallet-movements': 'Wallet Movements', settlements: 'Settlement Monitoring' };
const roleKinds: Record<FinancialRole, FinancialKind[]> = { employer: ['payments', 'wallet-statement'], super_admin: ['wallets', 'wallet-movements', 'settlements'] };
const fieldLabels: Record<string, string> = { employer_id: 'Employer', company_id: 'Company', site_id: 'Site', job_id: 'Job', guard_id: 'Associate', status: 'Recorded status', payment_method: 'Payment method', linkage: 'Payment linkage', link_condition: 'Investigation condition', source: 'Movement source', transaction_type: 'Movement type', reference_id: 'Payment / reference ID contains', min_amount: 'Minimum amount (INR)', max_amount: 'Maximum amount (INR)' };
const summaryLabels: Record<string, string> = { current_balance: 'Current balance (INR)', current_deposit_balance: 'Current deposit balance (INR)', current_admin_credit_balance: 'Current admin credit (INR)', opening_balance: 'Account opening balance (INR)', closing_balance: 'Account closing balance (INR)', account_period_credits: 'Account period completed credits (INR)', account_period_debits: 'Account period completed debits (INR)', filtered_movement_breakdown: 'Filtered movements by type, source and status', recorded_payment_statuses: 'Payment counts and amounts by recorded status', linkage_breakdown: 'Counts and amounts by linkage', history_status: 'Recorded history check', investigation_flags: 'Investigation flags', unattributed_account_payments: 'Account payments excluded from selected company/site/job' };
function display(value: unknown): string {
  if (value == null) return 'Unavailable';
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if ('count' in object && 'amount' in object) return `${object.count} records · INR ${object.amount}`;
    return Object.entries(object).map(([key, val]) => `${key.replace(/_/g, ' ')}: ${display(val)}`).join(' · ') || 'None';
  }
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? new Date(text).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : text;
}
function savedKind(role: FinancialRole, initial?: FinancialKind): FinancialKind {
  const saved = new URLSearchParams(window.location.search).get('financial_report') as FinancialKind;
  return roleKinds[role].includes(saved) ? saved : initial ?? roleKinds[role][0];
}
function supportedFields(role: FinancialRole, kind: FinancialKind) {
  const owner = role === 'super_admin' ? ['employer_id'] : [];
  if (kind === 'wallets') return [...owner, 'status'];
  if (kind === 'payments' || kind === 'settlements') return [...owner, 'company_id', 'site_id', 'job_id', 'guard_id', 'status', 'payment_method', 'linkage', 'link_condition', 'reference_id', 'min_amount', 'max_amount'];
  return [...owner, 'job_id', 'guard_id', 'status', 'source', 'transaction_type', 'reference_id', 'min_amount', 'max_amount'];
}
export default function FinancialReports({ role, company, initialKind }: { role: FinancialRole; company?: { id: string; company_name?: string }; initialKind?: FinancialKind }) {
  const [kind, setKind] = useState<FinancialKind>(() => savedKind(role, initialKind));
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const url = new URLSearchParams(window.location.search), selected = savedKind(role, initialKind);
    if (url.get('financial_role') !== role || (role === 'employer' && url.get('financial_company') !== (company?.id ?? 'account'))) return selected === 'payments' && company ? { company_id: company.id } : {};
    const keys = [...supportedFields(role, selected), ...(selected === 'wallets' ? [] : ['date_from', 'date_to', 'date_basis'])];
    return Object.fromEntries(keys.flatMap(k => url.get(k) ? [[k, url.get(k)!]] : []));
  });
  const [draft, setDraft] = useState(filters), [page, setPage] = useState(1), [pageSize, setPageSize] = useState('50');
  const [data, setData] = useState<FinancialReport | null>(null), [dataKey, setDataKey] = useState('');
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [notice, setNotice] = useState(''), [exporting, setExporting] = useState(false);
  const [options, setOptions] = useState<FinancialOptions | null>(null), [optionsError, setOptionsError] = useState('');
  const params = useMemo(() => ({ ...filters, page: String(page), page_size: pageSize }), [filters, page, pageSize]);
  const requestKey = JSON.stringify([role, kind, params]), visible = dataKey === requestKey ? data : null;
  const draftOwner = draft.employer_id, draftCompany = draft.company_id;
  const optionParams = useMemo(() => ({ ...(draftOwner ? { employer_id: draftOwner } : {}), ...(draftCompany ? { company_id: draftCompany } : {}) }), [draftOwner, draftCompany]);
  const paymentMode = kind === 'payments' || kind === 'settlements', fields = supportedFields(role, kind);
  const dateChoices: [string, string][] = paymentMode ? [['created', 'Payment creation date'], ['recorded-payment', 'Recorded payment date (not completion date)']] : [['recorded', 'Recorded transaction date']];
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    getFinancialReport(role, kind, params, controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setDataKey(requestKey); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Unable to load the report.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [role, kind, params, requestKey, refresh]);
  useEffect(() => {
    const controller = new AbortController(); setOptionsError('');
    getFinancialOptions(role, optionParams, controller.signal).then(result => { if (!controller.signal.aborted) setOptions(result); })
      .catch(cause => { if (!controller.signal.aborted) setOptionsError(cause.message || 'Unable to load filter options.'); });
    return () => controller.abort();
  }, [role, optionParams, refresh]);
  useEffect(() => {
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('financial_report', kind); url.searchParams.set('financial_role', role);
    if (role === 'employer') url.searchParams.set('financial_company', company?.id ?? 'account');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    window.history.replaceState({}, '', url);
  }, [role, company?.id, kind, params]);
  const change = (key: string, value: string) => setDraft(previous => {
    const next = { ...previous }; if (value) next[key] = value; else delete next[key];
    if (key === 'employer_id') { delete next.company_id; delete next.site_id; delete next.job_id; delete next.guard_id; }
    if (key === 'company_id') { delete next.site_id; delete next.job_id; }
    if (key === 'site_id') delete next.job_id;
    return next;
  });
  const changeKind = (next: FinancialKind) => { const initial: Record<string, string> = next === 'payments' && company ? { company_id: company.id } : {}; setKind(next); setFilters(initial); setDraft(initial); setPage(1); setNotice(''); };
  const choices = (key: string): FinancialOption[] | null => {
    const lists: Record<string, keyof FinancialOptions> = { employer_id: 'employers', company_id: 'companies', site_id: 'sites', job_id: 'jobs', guard_id: 'associates' };
    if (lists[key]) { const values = options?.[lists[key]] ?? []; return key === 'job_id' && draft.site_id ? values.filter(v => v.siteId === draft.site_id) : values; }
    const fixed: Record<string, string[]> = { status: kind === 'wallets' ? ['active', 'inactive', 'blocked', 'not-created'] : paymentMode ? ['pending', 'otp_sent', 'processing', 'completed', 'failed', 'cancelled'] : ['completed', 'pending', 'processing', 'failed'], payment_method: ['wallet_attendance', 'wallet_otp', 'cash'], linkage: ['attendance-linked', 'application-only', 'job-only', 'unlinked', 'missing-reference', 'conflicting'], link_condition: ['missing-debit', 'missing-credit', 'amount-mismatch', 'multiple-entries', 'status-mismatch', 'unlinked'], source: ['mock_gateway_recharge', 'admin_credit', 'job_payment'], transaction_type: ['credit', 'debit'] };
    return fixed[key]?.map(id => ({ id, label: id.replace(/_/g, ' ') })) ?? null;
  };
  const exportRows = async () => { setExporting(true); setNotice(''); try { await downloadFinancialReport(role, kind, params); setNotice('CSV downloaded for all matching rows.'); } catch (cause) { setNotice(`Export failed: ${(cause as Error).message}`); } finally { setExporting(false); } };
  const control = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm';
  return <div className="p-4 md:p-6 space-y-5">
    <h1 className="text-xl font-bold">{role === 'employer' ? 'Employer Financial Reports' : 'Employer Wallet & Settlement Monitoring'}</h1>
    <div className="flex gap-2 flex-wrap">{roleKinds[role].map(k => <button key={k} onClick={() => changeKind(k)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${kind === k ? 'bg-slate-900 text-white' : 'border bg-white'}`}>{labels[k]}</button>)}</div>
    <p className="text-sm text-gray-600">{paymentMode ? 'Recorded payment states and linked ledger evidence; completion is not proof of bank payout. Account/platform views include unlinked payments.' : kind === 'wallets' ? 'Current stored balances across Employer accounts. Wallets not created have unknown balances.' : 'Employer-account-wide movements and balances across companies. Movement filters do not create a separate company or job wallet.'} · IST dates · Read-only</p>
    {kind === 'wallet-statement' && <p className="text-sm text-gray-600">Historical balances are reconstructed only when recorded ledger continuity and current counters agree. They are not bank reconciliation. Component balances are current values; opening/closing balances cover the whole account even when movement filters are applied.</p>}
    <form autoComplete="off" className="rounded-xl border bg-white p-4" onSubmit={e => { e.preventDefault(); setFilters({ ...draft }); setPage(1); setNotice(''); }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{fields.map(key => {
        const values = choices(key);
        return <label key={key} className="text-xs text-gray-600">{fieldLabels[key] ?? key}{values ? <select className={control} value={draft[key] ?? ''} onChange={e => change(key, e.target.value)}><option value="">{key === 'company_id' && role === 'employer' ? 'All my companies / unlinked payments' : 'All'}</option>{draft[key] && !values.some(v => v.id === draft[key]) && <option value={draft[key]}>{draft[key]}</option>}{values.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select> : <input autoComplete="off" className={control} inputMode={key.endsWith('amount') ? 'decimal' : 'text'} value={draft[key] ?? ''} onChange={e => change(key, e.target.value)}/>}</label>;
      })}
      {kind !== 'wallets' && <><label className="text-xs text-gray-600">Date basis<select className={control} value={draft.date_basis ?? dateChoices[0][0]} onChange={e => change('date_basis', e.target.value)}>{dateChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs text-gray-600">From<input autoComplete="off" type="date" className={control} value={draft.date_from ?? ''} onChange={e => change('date_from', e.target.value)}/></label><label className="text-xs text-gray-600">Through<input autoComplete="off" type="date" className={control} value={draft.date_to ?? ''} onChange={e => change('date_to', e.target.value)}/></label></>}
      </div><div className="flex gap-3 flex-wrap mt-4 items-center">
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Apply filters</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setDraft({}); setFilters({}); setPage(1); }}>Clear filters</button>
        <button type="button" disabled={loading} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => setRefresh(v => v + 1)}><RefreshCw size={16}/>{loading ? 'Refreshing…' : 'Refresh'}</button>
        <button type="button" disabled={!visible || loading || !!error || exporting} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={exportRows}><Download size={16}/>{exporting ? 'Exporting…' : 'Export CSV'}</button><span className="text-xs text-gray-500">Full filtered export, up to 5,000 rows.</span>
      </div>
    </form>
    {optionsError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">Filter options unavailable: {optionsError} <button className="underline" onClick={() => setRefresh(v => v + 1)}>Retry</button></p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} {visible && 'Displayed results are stale.'} <button className="underline" onClick={() => setRefresh(v => v + 1)}>Retry</button></p>}
    {notice && <p role="status" className={`rounded-lg p-3 text-sm ${notice.startsWith('Export failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{notice}</p>}
    {loading && !visible && <div role="status" className="animate-pulse rounded-xl bg-gray-100 p-12 text-center">Loading report…</div>}
    {visible && <>
      {visible.meta.warnings.map((w, i) => <p key={`${w.code}-${i}`} className="rounded-lg bg-amber-50 p-3 text-sm">{w.message}</p>)}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{Object.entries(visible.summary).filter(([key]) => key !== 'reason').map(([key, value]) => <div key={key} className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">{summaryLabels[key] ?? key.replace(/_/g, ' ')}</p><p className="text-sm font-semibold mt-1 break-words">{display(value)}</p></div>)}</div>
      <p className="text-xs text-gray-500">Applied scope: {Object.keys(visible.meta.scope).length ? Object.entries(visible.meta.scope).map(([key, value]) => `${key.replace(/UserId|Id/g, '')}: ${key === 'employerUserId' && role === 'employer' ? 'Your Employer account' : options?.employers.find(o => o.id === value)?.label ?? options?.companies.find(o => o.id === value)?.label ?? options?.sites.find(o => o.id === value)?.label ?? options?.jobs.find(o => o.id === value)?.label ?? (key === 'companyId' && value === company?.id ? company.company_name : undefined) ?? value}`).join(' · ') : 'Entire platform'} · Generated {display(visible.meta.generated_at)} IST · Totals cover all matching records.</p>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr>{visible.columns.map(c => <th className="p-3 text-left whitespace-nowrap" key={c.key}>{c.label}</th>)}</tr></thead><tbody>{visible.items.map(row => <tr className="border-t" key={String(row.id)}>{visible.columns.map(c => <td className="p-3 max-w-xs break-words" key={c.key}>{row[c.key] == null ? '—' : display(row[c.key])}</td>)}</tr>)}</tbody></table>{!visible.items.length && <div className="p-10 text-center text-gray-500">{visible.pagination.total ? 'No rows on this page. Return to the first page.' : Object.keys(filters).length ? 'No records match these filters.' : 'No recorded entries yet.'}</div>}</div>
      <div className="flex gap-3 items-center flex-wrap text-sm"><button className="rounded border p-2 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {Math.max(1, visible.pagination.total_pages)} · {visible.pagination.total} records</span><button className="rounded border p-2 disabled:opacity-40" disabled={page >= visible.pagination.total_pages || loading} onClick={() => setPage(p => p + 1)}>Next</button><label>Rows <select className="rounded border p-2" value={pageSize} onChange={e => { setPageSize(e.target.value); setPage(1); }}>{['25', '50', '100'].map(v => <option key={v}>{v}</option>)}</select></label></div>
    </>}
  </div>;
}
