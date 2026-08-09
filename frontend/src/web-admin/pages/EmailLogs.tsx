import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mail, RefreshCw, Search } from 'lucide-react';
import { PageHeader, Card, Table, Pill } from './_adminUi';
import { getEmailLogs, type EmailLogRow, type EmailLogResponse } from '../../services/emailLogService';

function fmtDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-CA');
}

function statusTone(status: string) {
  if (status === 'sent') return 'green';
  if (status === 'skipped') return 'amber';
  if (status === 'error') return 'red';
  return 'gray';
}

export default function EmailLogs() {
  const [data, setData] = useState<EmailLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getEmailLogs({
        kind: kind.trim() || undefined,
        status: status.trim() || undefined,
        q: q.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 300,
      });
      setData(resp);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load email logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const rows = data?.items ?? [];
    const groups = new Map<string, EmailLogRow[]>();
    for (const row of rows) {
      const key = dayKey(row.created_at);
      const bucket = groups.get(key) ?? [];
      bucket.push(row);
      groups.set(key, bucket);
    }
    return [...groups.entries()];
  }, [data]);

  return (
    <motion.div className="p-6 space-y-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Email Logs"
        subtitle="All mail attempts from local and production, grouped by date and source URL"
        action={(
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      />

      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <label className="block">
            <span className="form-label">Search</span>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} className="form-input pl-9" placeholder="email, subject, source url..." />
            </div>
          </label>
          <label className="block">
            <span className="form-label">Kind</span>
            <input value={kind} onChange={e => setKind(e.target.value)} className="form-input" placeholder="signup_verification..." />
          </label>
          <label className="block">
            <span className="form-label">Status</span>
            <select value={status} onChange={e => setStatus(e.target.value)} className="form-input">
              <option value="">All</option>
              <option value="sent">Sent</option>
              <option value="skipped">Skipped</option>
              <option value="error">Error</option>
            </select>
          </label>
          <label className="block">
            <span className="form-label">From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="form-input" />
          </label>
          <label className="block">
            <span className="form-label">To</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="form-input" />
          </label>
        </div>
        <div className="flex justify-end">
          <button onClick={load} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>
            Apply Filters
          </button>
        </div>
      </Card>

      {loading && (
        <div className="text-center py-20 text-gray-400">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-60" />
          <p className="text-sm">Loading email logs…</p>
        </div>
      )}

      {!loading && error && <Card><p className="text-sm text-red-500">{error}</p></Card>}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4"><div className="text-xs text-gray-400">Total</div><div className="text-2xl font-bold text-slate-900">{data.summary.total}</div></Card>
            <Card className="p-4"><div className="text-xs text-gray-400">Sent</div><div className="text-2xl font-bold text-green-700">{data.summary.sent}</div></Card>
            <Card className="p-4"><div className="text-xs text-gray-400">Skipped</div><div className="text-2xl font-bold text-amber-700">{data.summary.skipped}</div></Card>
            <Card className="p-4"><div className="text-xs text-gray-400">Error</div><div className="text-2xl font-bold text-red-700">{data.summary.error}</div></Card>
          </div>

          {grouped.length === 0 ? (
            <Card className="p-10 text-center text-sm text-gray-400">
              No email logs found for the selected filters.
            </Card>
          ) : (
            grouped.map(([day, rows]) => (
              <div key={day} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Mail size={14} className="text-red-600" />
                  {day}
                  <span className="text-xs text-gray-400">({rows.length})</span>
                </div>
                <Table headers={['Time', 'Status', 'Env', 'Kind', 'To', 'Subject', 'Source URL', 'Request URL', 'Error']}>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/70">
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                      <td className="px-4 py-3.5"><Pill label={row.status} tone={statusTone(row.status) as any} /></td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">{row.environment || '—'}</td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-gray-700 whitespace-nowrap">{row.kind}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-700 break-all">{row.to_email}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-700 max-w-72 break-words">{row.subject}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 max-w-72 break-words">{row.source_url || row.referer || row.origin || '—'}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 max-w-72 break-words">{row.request_url || '—'}</td>
                      <td className="px-4 py-3.5 text-xs text-red-600 max-w-72 break-words">{row.error_message || '—'}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            ))
          )}
        </>
      )}
    </motion.div>
  );
}
