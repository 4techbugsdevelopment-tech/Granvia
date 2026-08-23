// Admin attendance overview (live: GET /admin/attendance)
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { PageHeader, StatTile, Table, Pill } from './_adminUi';
import { getAdminAttendance, AdminAttendance } from '../../services/reportService';

const tone = (s: string) =>
  s === 'verified' ? 'green' : s === 'pending_verification' ? 'amber' : s === 'rejected' ? 'red' : 'blue';

const statusLabel = (s: string) => (s === 'pending_verification' ? 'pending' : s);

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtHours(h: number | null): string {
  if (h == null) return '—';
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}h ${mins}m`;
}

function gpsLink(lat: number | string | null, lng: number | string | null, fallback = '—') {
  if (lat == null || lng == null) return <span className="text-gray-400">{fallback}</span>;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return (
    <a
      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
      target="_blank"
      rel="noreferrer"
      title={`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
    >
      {latitude.toFixed(5)}, {longitude.toFixed(5)}
    </a>
  );
}

export default function AttendanceAdmin() {
  const [data, setData] = useState<AdminAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAdminAttendance()
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const stats = data?.stats;
  const records = data?.records ?? [];

  return (
    <motion.div className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Attendance" subtitle="Daily in/out logs across all sites" />

      {loading && (
        <div className="text-center py-20 text-gray-400">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-60" />
          <p className="text-sm">Loading attendance…</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl p-6 bg-white" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatTile label="Checked In Today" value={String(stats?.checked_in_today ?? 0)} color="#0f1e3c" />
            <StatTile label="Currently Active" value={String(stats?.active ?? 0)} color="#1d4ed8" />
            <StatTile label="Verified" value={String(stats?.verified ?? 0)} color="#166534" />
            <StatTile label="Pending Verification" value={String(stats?.pending ?? 0)} color="#854d0e" />
          </div>

          <Table headers={['Associate', 'Site', 'Date', 'In', 'Check-in GPS', 'Out', 'Check-out GPS', 'Hours', 'Status']}>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">{r.guard_profile?.full_name ?? '—'}</td>
                <td className="px-4 py-3.5 text-sm text-gray-600">{r.job?.site?.site_name ?? '—'}</td>
                <td className="px-4 py-3.5 text-xs text-gray-500">
                  {r.attendance_date ? new Date(r.attendance_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </td>
                <td className="px-4 py-3.5 text-sm text-gray-700">{fmtTime(r.in_time)}</td>
                <td className="px-4 py-3.5">{gpsLink(r.check_in_latitude, r.check_in_longitude)}</td>
                <td className="px-4 py-3.5 text-sm text-gray-700">{fmtTime(r.out_time)}</td>
                <td className="px-4 py-3.5">{gpsLink(r.check_out_latitude, r.check_out_longitude, r.checkout_method === 'automatic' ? 'Auto — unavailable' : '—')}</td>
                <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: '#0f1e3c' }}>{fmtHours(r.total_hours)}</td>
                <td className="px-4 py-3.5">
                  <Pill label={statusLabel(r.status)} tone={tone(r.status) as any} />
                  {r.checkout_method === 'automatic' && <div className="text-[10px] text-purple-600 mt-1">Auto checkout</div>}
                  {r.entry_mode === 'historical_manual' && <div className="text-[10px] text-amber-600 mt-1">Historical correction</div>}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">No attendance records yet</td></tr>
            )}
          </Table>
        </>
      )}
    </motion.div>
  );
}
