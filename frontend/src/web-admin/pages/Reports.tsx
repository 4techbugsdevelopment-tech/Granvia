// Admin reports — area availability, language proficiency, commission (live: GET /admin/reports/analytics)
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Languages, TrendingUp, Loader2 } from 'lucide-react';
import { PageHeader, Card, Table } from './_adminUi';
import { getAdminAnalytics, AdminAnalytics } from '../../services/reportService';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function Reports() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAdminAnalytics()
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const areas = data?.area_availability ?? [];
  const commission = data?.commission_by_month ?? [];
  const maxCommission = Math.max(1, ...commission.map((m) => m.commission));

  return (
    <motion.div className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Reports & Analytics" subtitle="Availability, language skills and commission tracking" />

      {loading && (
        <div className="text-center py-20 text-gray-400">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-60" />
          <p className="text-sm">Loading analytics…</p>
        </div>
      )}

      {!loading && error && (
        <Card><p className="text-sm text-red-500">{error}</p></Card>
      )}

      {!loading && !error && (
        <>
          {/* Area-wise availability */}
          <Card className="mb-6">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <MapPin size={16} style={{ color: '#8b1a1a' }} /> Area-wise Associate Availability
            </h2>
            <Table headers={['Area', 'Available', 'Deployed', 'English', 'Total']}>
              {areas.map((a) => (
                <tr key={a.area} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{a.area}</td>
                  <td className="px-4 py-3 text-sm text-green-700 font-semibold">{a.available}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a.deployed}</td>
                  <td className="px-4 py-3 text-sm text-blue-700">{a.languages.English ?? 0}</td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: '#0f1e3c' }}>{a.total}</td>
                </tr>
              ))}
              {areas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No associate data yet</td></tr>
              )}
            </Table>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Language proficiency */}
            <Card>
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Languages size={16} style={{ color: '#8b1a1a' }} /> English Proficiency by Area
              </h2>
              <div className="space-y-3">
                {areas.map((a) => {
                  const pct = a.total > 0 ? Math.round(((a.languages.English ?? 0) / a.total) * 100) : 0;
                  return (
                    <div key={a.area}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{a.area}</span><span>{a.languages.English ?? 0} associates · {pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: '#1d4ed8' }}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                      </div>
                    </div>
                  );
                })}
                {areas.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
                <p className="text-xs text-gray-400 pt-1">Total English-proficient associates: <span className="font-bold text-gray-700">{data?.total_english ?? 0}</span></p>
              </div>
            </Card>

            {/* Commission tracking */}
            <Card>
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <TrendingUp size={16} style={{ color: '#8b1a1a' }} /> Commission Earnings (6 months)
              </h2>
              <div className="flex items-end gap-3 h-40">
                {commission.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center" style={{ height: 120 }}>
                      <motion.div
                        className="w-full rounded-t-lg"
                        style={{ background: 'linear-gradient(180deg, #5b21b6, #8b5cf6)' }}
                        initial={{ height: 0 }}
                        animate={{ height: `${(m.commission / maxCommission) * 120}px` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{m.month}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Total commission earned ({Math.round((data?.commission_rate ?? 0.1) * 100)}%):{' '}
                <span className="font-bold text-gray-700">{inr(data?.total_earned ?? 0)}</span>
              </p>
            </Card>
          </div>
        </>
      )}
    </motion.div>
  );
}
