// Admin hiring workflow overview (live: GET /admin/hiring)
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { PageHeader, Card, Table, Pill } from './_adminUi';
import { getAdminHiring, AdminHiring } from '../../services/reportService';

const tone = (s: string) =>
  /join|confirm|signed/i.test(s) ? 'green' : /select|accept/i.test(s) ? 'blue' : 'amber';

export default function HiringWorkflow() {
  const [data, setData] = useState<AdminHiring | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAdminHiring()
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const funnel = data?.funnel ?? [];
  const recent = data?.recent_hires ?? [];
  const max = Math.max(1, ...funnel.map((p) => p.count));

  return (
    <motion.div className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Hiring Workflow" subtitle="Applicant funnel and onboarding across the platform" />

      {loading && (
        <div className="text-center py-20 text-gray-400">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-60" />
          <p className="text-sm">Loading hiring data…</p>
        </div>
      )}

      {!loading && error && (
        <Card><p className="text-sm text-red-500">{error}</p></Card>
      )}

      {!loading && !error && (
        <>
          <Card className="mb-6">
            <h2 className="font-bold text-gray-900 mb-5">Recruitment Funnel</h2>
            <div className="space-y-4">
              {funnel.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700">{stage.stage}</div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                    <motion.div
                      className="h-full rounded-lg flex items-center justify-end px-2"
                      style={{ background: stage.color, minWidth: stage.count > 0 ? 28 : 0 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(stage.count / max) * 100}%` }}
                      transition={{ duration: 0.8 }}
                    >
                      <span className="text-xs font-bold text-white">{stage.count}</span>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <h2 className="font-bold text-gray-900 mb-3">Recent Hires</h2>
          <Table headers={['Associate', 'Employer', 'Site', 'Date', 'Status']}>
            {recent.map((h, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">{h.guard}</td>
                <td className="px-4 py-3.5 text-sm text-gray-600">{h.employer}</td>
                <td className="px-4 py-3.5 text-sm text-gray-600">{h.site}</td>
                <td className="px-4 py-3.5 text-xs text-gray-500">
                  {h.date ? new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </td>
                <td className="px-4 py-3.5"><Pill label={h.status} tone={tone(h.status) as any} /></td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No hires yet</td></tr>
            )}
          </Table>
        </>
      )}
    </motion.div>
  );
}
