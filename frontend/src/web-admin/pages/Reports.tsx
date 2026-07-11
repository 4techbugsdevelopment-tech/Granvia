// Admin reports — area availability, language proficiency, commission (demo data)
import { motion } from 'framer-motion';
import { MapPin, Languages, TrendingUp } from 'lucide-react';
import { PageHeader, Card, Table } from './_adminUi';
import { demoAreaAvailability, demoCommissionByMonth } from '../../lib/demoData';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function Reports() {
  const maxCommission = Math.max(...demoCommissionByMonth.map(m => m.commission));
  const totalEnglish = demoAreaAvailability.reduce((s, a) => s + (a.languages.English ?? 0), 0);

  return (
    <motion.div className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Reports & Analytics" subtitle="Availability, language skills and commission tracking" />

      {/* Area-wise availability */}
      <Card className="mb-6">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
          <MapPin size={16} style={{ color: '#8b1a1a' }} /> Area-wise Guard Availability
        </h2>
        <Table headers={['Area', 'Available', 'Deployed', 'English', 'Total']}>
          {demoAreaAvailability.map(a => (
            <tr key={a.area} className="border-b border-gray-50">
              <td className="px-4 py-3 text-sm font-semibold text-gray-900">{a.area}</td>
              <td className="px-4 py-3 text-sm text-green-700 font-semibold">{a.available}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{a.deployed}</td>
              <td className="px-4 py-3 text-sm text-blue-700">{a.languages.English ?? 0}</td>
              <td className="px-4 py-3 text-sm font-bold" style={{ color: '#0f1e3c' }}>{a.available + a.deployed}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Language proficiency */}
        <Card>
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Languages size={16} style={{ color: '#8b1a1a' }} /> English Proficiency by Area
          </h2>
          <div className="space-y-3">
            {demoAreaAvailability.map(a => {
              const total = a.available + a.deployed;
              const pct = Math.round(((a.languages.English ?? 0) / total) * 100);
              return (
                <div key={a.area}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{a.area}</span><span>{a.languages.English ?? 0} guards · {pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: '#1d4ed8' }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-gray-400 pt-1">Total English-proficient guards: <span className="font-bold text-gray-700">{totalEnglish}</span></p>
          </div>
        </Card>

        {/* Commission tracking */}
        <Card>
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: '#8b1a1a' }} /> Commission Earnings (6 months)
          </h2>
          <div className="flex items-end gap-3 h-40">
            {demoCommissionByMonth.map(m => (
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
          <p className="text-xs text-gray-400 mt-3">Latest month commission: <span className="font-bold text-gray-700">{inr(demoCommissionByMonth[demoCommissionByMonth.length - 1].commission)}</span></p>
        </Card>
      </div>
    </motion.div>
  );
}
