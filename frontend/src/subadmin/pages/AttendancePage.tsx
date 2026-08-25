import { useEffect, useState } from 'react';
import { getBranchAttendance, type BranchAttendance } from '../../services/subadminService';
import { DataTable, type DataColumn, Page, PageHeader, Pill } from '../ui';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';
}

const COLUMNS: DataColumn<BranchAttendance>[] = [
  { header: 'Associate', primary: true, cell: row => row.guard_profile?.full_name ?? 'Associate' },
  { header: 'Company', cell: row => row.job?.company?.company_name ?? '—' },
  { header: 'Job / Site', cell: row => (
    <div>
      <div>{row.job?.title ?? '—'}</div>
      <div className="text-xs text-gray-400">{row.job?.site?.site_name ?? '—'}</div>
    </div>
  ) },
  { header: 'Date', cell: row => formatDate(row.attendance_date) },
  { header: 'In / Out', cell: row => `${formatTime(row.in_time)} / ${formatTime(row.out_time)}` },
  { header: 'Hours', cell: row => row.total_hours == null ? '—' : Number(row.total_hours).toFixed(2) },
  { header: 'Status', cell: row => (
    <div>
      <Pill label={row.status === 'pending_verification' ? 'Pending' : row.status} />
      {row.entry_mode === 'historical_manual' && <div className="mt-1 text-[10px] text-amber-700">Historical correction</div>}
    </div>
  ) },
];

export default function AttendancePage() {
  const [rows, setRows] = useState<BranchAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getBranchAttendance()
      .then(setRows)
      .catch((reason) => setError(reason?.response?.data?.message || reason.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Page>
      <PageHeader title="Attendance" subtitle="Attendance submitted by associates connected to your branch and employer" />
      {loading && <div className="py-20 text-center text-sm text-gray-400">Loading…</div>}
      {!loading && error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!loading && !error && (
        <DataTable columns={COLUMNS} rows={rows} rowKey={row => row.id} empty="No connected attendance records yet." />
      )}
    </Page>
  );
}
