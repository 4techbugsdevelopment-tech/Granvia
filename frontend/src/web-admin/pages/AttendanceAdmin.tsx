// Admin attendance overview (demo data; admin-scoped attendance API pending)
import { motion } from 'framer-motion';
import { PageHeader, StatTile, Table, Pill } from './_adminUi';

const rows = [
  { guard: 'Rajesh Kumar', site: 'Reliance Mall', date: '2026-07-10', inTime: '08:02 AM', outTime: '04:05 PM', hours: '8h 3m', status: 'verified' },
  { guard: 'Suresh Patil', site: 'Tech Park', date: '2026-07-10', inTime: '07:58 AM', outTime: '—', hours: '—', status: 'active' },
  { guard: 'Vikram Rao', site: 'Airport Gate 3', date: '2026-07-10', inTime: '09:10 PM', outTime: '—', hours: '—', status: 'active' },
  { guard: 'Amit Sharma', site: 'Phoenix Mall', date: '2026-07-09', inTime: '08:00 AM', outTime: '08:12 PM', hours: '12h 12m', status: 'verified' },
  { guard: 'Neha Singh', site: 'Metro Depot', date: '2026-07-09', inTime: '06:03 AM', outTime: '02:00 PM', hours: '7h 57m', status: 'pending' },
];

const tone = (s: string) => s === 'verified' ? 'green' : s === 'active' ? 'blue' : 'amber';

export default function AttendanceAdmin() {
  return (
    <motion.div className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Attendance" subtitle="Daily in/out logs across all sites" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile label="Checked In Today" value="126" color="#0f1e3c" />
        <StatTile label="Currently Active" value="38" color="#1d4ed8" />
        <StatTile label="Verified" value="88" color="#166534" />
        <StatTile label="Pending Verification" value="12" color="#854d0e" />
      </div>

      <Table headers={['Associate', 'Site', 'Date', 'In', 'Out', 'Hours', 'Status']}>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
            <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">{r.guard}</td>
            <td className="px-4 py-3.5 text-sm text-gray-600">{r.site}</td>
            <td className="px-4 py-3.5 text-xs text-gray-500">{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
            <td className="px-4 py-3.5 text-sm text-gray-700">{r.inTime}</td>
            <td className="px-4 py-3.5 text-sm text-gray-700">{r.outTime}</td>
            <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: '#0f1e3c' }}>{r.hours}</td>
            <td className="px-4 py-3.5"><Pill label={r.status} tone={tone(r.status) as any} /></td>
          </tr>
        ))}
      </Table>
    </motion.div>
  );
}
