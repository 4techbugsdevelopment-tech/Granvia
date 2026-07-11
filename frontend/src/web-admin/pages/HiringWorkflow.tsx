// Admin hiring workflow overview (demo data; aggregate hiring API pending)
import { motion } from 'framer-motion';
import { PageHeader, Card, Table, Pill } from './_adminUi';
import { demoHiringPipeline, demoRecentHires } from '../../lib/demoData';

const tone = (s: string) => /join/i.test(s) ? 'green' : /select/i.test(s) ? 'blue' : 'amber';

export default function HiringWorkflow() {
  const max = Math.max(...demoHiringPipeline.map(p => p.count));
  return (
    <motion.div className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Hiring Workflow" subtitle="Applicant funnel and onboarding across the platform" />

      <Card className="mb-6">
        <h2 className="font-bold text-gray-900 mb-5">Recruitment Funnel</h2>
        <div className="space-y-4">
          {demoHiringPipeline.map(stage => (
            <div key={stage.stage} className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-gray-700">{stage.stage}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                <motion.div
                  className="h-full rounded-lg flex items-center justify-end px-2"
                  style={{ background: stage.color }}
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
      <Table headers={['Service Partner', 'Employer', 'Site', 'Date', 'Status']}>
        {demoRecentHires.map((h, i) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
            <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">{h.guard}</td>
            <td className="px-4 py-3.5 text-sm text-gray-600">{h.employer}</td>
            <td className="px-4 py-3.5 text-sm text-gray-600">{h.site}</td>
            <td className="px-4 py-3.5 text-xs text-gray-500">{new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
            <td className="px-4 py-3.5"><Pill label={h.status} tone={tone(h.status) as any} /></td>
          </tr>
        ))}
      </Table>
    </motion.div>
  );
}
