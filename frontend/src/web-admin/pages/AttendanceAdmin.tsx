// Admin attendance overview (live: GET /admin/attendance)
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { PageHeader, StatTile, Table, Pill } from './_adminUi';
import { getAdminAttendance, AdminAttendance, AdminAttendanceAuditEvent, updateAdminAttendanceStatus } from '../../services/reportService';
import { getErrorMessage } from '../../services/apiErrors';
import { distanceKm } from '../../lib/geoUtils';

const tone = (s: string) =>
  s === 'verified' || s === 'approved' ? 'green' : s === 'pending_verification' ? 'amber' : s === 'rejected' ? 'red' : 'blue';

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

function AuditTrail({ events }: { events: AdminAttendanceAuditEvent[] }) {
  if (!events.length) return <span className="text-xs text-gray-400">No audit events</span>;
  return (
    <details className="min-w-56">
      <summary className="cursor-pointer text-xs font-semibold text-blue-700">{events.length} audit event{events.length === 1 ? '' : 's'}</summary>
      <div className="mt-2 max-h-56 space-y-2 overflow-auto text-[10px] text-gray-600">
        {events.map((event) => (
          <div key={event.id} className="border-l-2 border-slate-200 pl-2">
            <div className="font-semibold text-slate-800">{event.event_type.replaceAll('_', ' ')} · {event.actor?.email || event.actor_role || event.actor_user_id || 'system'}</div>
            <div>{new Date(event.event_at).toLocaleString('en-IN')}</div>
            {event.device_location_name && <div>Device: {event.device_location_name}</div>}
            {(event.device_latitude != null && event.device_longitude != null) && <div>GPS: {Number(event.device_latitude).toFixed(5)}, {Number(event.device_longitude).toFixed(5)}</div>}
            {event.ip_address && <div>IP: {event.ip_address}</div>}
            {event.user_agent && <div className="break-words">Device: {event.user_agent}</div>}
            {event.remarks && <div>Reason: {event.remarks}</div>}
          </div>
        ))}
      </div>
    </details>
  );
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

function LocationCell({ lat, lng, name, site, fallback = '--' }: { lat: number | string | null; lng: number | string | null; name?: string | null; site: { latitude: number | string | null; longitude: number | string | null } | null | undefined; fallback?: string }) {
  const currentLat = lat == null ? null : Number(lat);
  const currentLng = lng == null ? null : Number(lng);
  const siteLat = site?.latitude == null ? null : Number(site.latitude);
  const siteLng = site?.longitude == null ? null : Number(site.longitude);
  const distance = currentLat != null && currentLng != null && siteLat != null && siteLng != null
    ? Math.round(distanceKm({ lat: currentLat, lng: currentLng }, { lat: siteLat, lng: siteLng }) * 1000)
    : null;
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold text-slate-500">Device: {gpsLink(lat, lng, fallback)}</div>
      {name && <div className="max-w-48 text-[10px] leading-snug text-slate-600">{name}</div>}
      {distance != null && <div className="text-[10px] text-gray-600">{distance} m from site</div>}
      {siteLat != null && siteLng != null && <div className="text-[10px] text-gray-400">Site: {gpsLink(siteLat, siteLng)}</div>}
    </div>
  );
}

export default function AttendanceAdmin() {
  const [data, setData] = useState<AdminAttendance | null>(null);
  const [filters, setFilters] = useState({ employer_id: '', site_id: '', guard_id: '', job_id: '', status: '', date_from: '', date_to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const activeFilters = () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim()));

  const load = () => {
    let active = true;
    setLoading(true);
    getAdminAttendance(activeFilters())
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  };

  useEffect(() => {
    return load();
  }, []);

  const decide = async (recordId: string, status: 'approved' | 'rejected') => {
    const remarks = status === 'rejected' ? window.prompt('Rejection reason (required):') : undefined;
    if (status === 'rejected' && !remarks?.trim()) return;
    setActionBusy(recordId);
    setError(null);
    setNotice('');
    try {
      await updateAdminAttendanceStatus(recordId, status, remarks?.trim());
      await getAdminAttendance(activeFilters()).then(setData);
      setNotice(status === 'approved' ? 'Attendance approved and settlement moved to processing.' : 'Attendance rejected.');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update attendance.'));
    } finally {
      setActionBusy(null);
    }
  };

  const stats = data?.stats;
  const records = data?.records ?? [];

  return (
    <motion.div className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Attendance" subtitle="Daily in/out logs across all sites" />
      {notice && <div className="mb-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <input value={filters.employer_id} onChange={event => setFilters(current => ({ ...current, employer_id: event.target.value }))} className="form-input" placeholder="Employer ID" />
          <input value={filters.site_id} onChange={event => setFilters(current => ({ ...current, site_id: event.target.value }))} className="form-input" placeholder="Site ID" />
          <input value={filters.guard_id} onChange={event => setFilters(current => ({ ...current, guard_id: event.target.value }))} className="form-input" placeholder="Associate ID" />
          <input value={filters.job_id} onChange={event => setFilters(current => ({ ...current, job_id: event.target.value }))} className="form-input" placeholder="Job ID" />
          <select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} className="form-input">
            <option value="">All statuses</option>
            <option value="pending_verification">Pending</option>
            <option value="approved">Approved</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <input type="date" value={filters.date_from} onChange={event => setFilters(current => ({ ...current, date_from: event.target.value }))} className="form-input" />
          <input type="date" value={filters.date_to} onChange={event => setFilters(current => ({ ...current, date_to: event.target.value }))} className="form-input" />
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button onClick={() => { setFilters({ employer_id: '', site_id: '', guard_id: '', job_id: '', status: '', date_from: '', date_to: '' }); setTimeout(load, 0); }} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Reset</button>
          <button onClick={load} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>Apply Filters</button>
        </div>
      </div>

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

          <Table headers={['Associate', 'Site', 'Date', 'In', 'Check-in Location', 'Out', 'Check-out Location', 'Hours', 'Status', 'Settlement', 'Audit', 'Actions']}>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">{r.guard_profile?.full_name ?? '—'}</td>
                <td className="px-4 py-3.5 text-sm text-gray-600">{r.job?.site?.site_name ?? '—'}</td>
                <td className="px-4 py-3.5 text-xs text-gray-500">
                  {r.attendance_date ? new Date(r.attendance_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </td>
                <td className="px-4 py-3.5 text-sm text-gray-700">{fmtTime(r.in_time)}</td>
                <td className="px-4 py-3.5"><LocationCell lat={r.check_in_latitude} lng={r.check_in_longitude} name={r.check_in_location_name} site={r.job?.site} /></td>
                <td className="px-4 py-3.5 text-sm text-gray-700">{fmtTime(r.out_time)}</td>
                <td className="px-4 py-3.5"><LocationCell lat={r.check_out_latitude} lng={r.check_out_longitude} name={r.check_out_location_name} site={r.job?.site} fallback={r.checkout_method === 'automatic' ? 'Auto - unavailable' : '--'} /></td>
                <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: '#0f1e3c' }}>{fmtHours(r.total_hours)}</td>
                <td className="px-4 py-3.5">
                  <Pill label={statusLabel(r.status)} tone={tone(r.status) as any} />
                  {r.checkout_method === 'automatic' && <div className="text-[10px] text-purple-600 mt-1">Auto checkout</div>}
                  {r.entry_mode === 'historical_manual' && <div className="text-[10px] text-amber-600 mt-1">Historical correction</div>}
                </td>
                <td className="px-4 py-3.5 text-sm">
                  {r.settlement ? (
                    <div>
                      <div className="font-bold text-gray-900">Rs {Number(r.settlement.amount).toLocaleString('en-IN')}</div>
                      <div className="text-xs text-blue-700 capitalize">{r.settlement.payment_status}</div>
                    </div>
                  ) : <span className="text-xs text-gray-400">Not settled</span>}
                </td>
                <td className="px-4 py-3.5"><AuditTrail events={r.audit_events ?? []} /></td>
                <td className="px-4 py-3.5">
                  {r.status === 'pending_verification' ? (
                    <div className="flex items-center gap-2">
                      <button disabled={actionBusy === r.id} onClick={() => void decide(r.id, 'approved')} className="rounded-lg bg-green-50 p-2 text-green-700 disabled:opacity-50" title="Approve attendance">
                        <CheckCircle size={16} />
                      </button>
                      <button disabled={actionBusy === r.id} onClick={() => void decide(r.id, 'rejected')} className="rounded-lg bg-red-50 p-2 text-red-700 disabled:opacity-50" title="Reject attendance">
                        <XCircle size={16} />
                      </button>
                    </div>
                  ) : <span className="text-xs text-gray-400">--</span>}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-400">No attendance records yet</td></tr>
            )}
          </Table>

          {(data?.attendance_requests?.length ?? 0) > 0 && (
            <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-slate-900">Attendance Exception Requests</h2>
              <div className="space-y-3">
                {data.attendance_requests.map((request) => (
                  <div key={request.id} className="grid gap-3 rounded-xl border border-slate-100 p-3 text-xs md:grid-cols-[1fr_1fr_1.5fr_1fr]">
                    <div><div className="font-semibold text-slate-900">{request.guard_profile?.full_name ?? 'Associate'}</div><div>{request.job?.title ?? 'Job'} · {request.request_type.replaceAll('_', ' ')}</div></div>
                    <div><Pill label={request.status} tone={request.status === 'approved' ? 'green' : request.status === 'rejected' ? 'red' : 'amber'} /></div>
                    <div><div className="text-slate-700">{request.message}</div>{request.employer_remarks && <div className="mt-1 text-red-600">Decision: {request.employer_remarks}</div>}</div>
                    <div><div>Submitted: {new Date(request.created_at).toLocaleString('en-IN')}</div>{request.decided_at && <div>Decided: {new Date(request.decided_at).toLocaleString('en-IN')}</div>}<AuditTrail events={request.audit_events ?? []} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

