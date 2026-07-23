// Branch-level Reports — live manpower skills + commission tracking.
import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Languages, GraduationCap, IndianRupee } from 'lucide-react';
import { getSkillsReport, getCommissionReport, SkillRow, CommissionReport } from '../../services/subadminService';
import { PageHeader, Card, Table, Pill, GlassStat } from '../ui';
import { NAVY, BROWN, BURGUNDY } from '../theme';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const ENGLISH = ['All', 'Yes', 'No'] as const;

export default function ReportsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [commission, setCommission] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [english, setEnglish] = useState<(typeof ENGLISH)[number]>('All');
  const [qual, setQual] = useState('All');

  useEffect(() => {
    Promise.all([getSkillsReport(), getCommissionReport()])
      .then(([s, c]) => { setSkills(s); setCommission(c); })
      .finally(() => setLoading(false));
  }, []);

  const quals = useMemo(() => ['All', ...Array.from(new Set(skills.map(m => m.qualification).filter(Boolean) as string[]))], [skills]);
  const rows = skills.filter(m => (english === 'All' || m.english === english) && (qual === 'All' || m.qualification === qual));

  if (loading || !commission) return <div className="p-6"><PageHeader title="Reports & Analytics" subtitle="Manpower skills and branch commission tracking" /><div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div></div>;

  return (
    <div className="p-6">
      <PageHeader title="Reports & Analytics" subtitle="Manpower skills and branch commission tracking" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GlassStat label="Total Commission" value={inr(commission.total_earned)} icon={<IndianRupee size={18} />} accent={NAVY} />
        <GlassStat label="Commission Rate" value={`${Math.round(commission.commission_rate * 100)}%`} accent={BURGUNDY} />
        <GlassStat label="Settlements" value={String(commission.settlements_count)} accent="#854d0e" />
        <GlassStat label="Associates Reported" value={String(skills.length)} accent={BROWN} />
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <IndianRupee size={16} style={{ color: BURGUNDY }} />
          <h2 className="font-bold" style={{ color: NAVY }}>Commission from Job Settlements</h2>
        </div>
        {commission.by_month.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'rgba(75,46,42,0.5)' }}>No settlements recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={commission.by_month} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#efe8e3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: BROWN }} tickLine={false} axisLine={{ stroke: '#e6ddd8' }} />
              <YAxis tick={{ fontSize: 11, fill: BROWN }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={{ fill: 'rgba(122,38,33,0.05)' }} contentStyle={{ borderRadius: 12, border: '1px solid #ece7e3', fontSize: 12 }} formatter={(v) => [inr(Number(v)), 'Commission']} />
              <Bar dataKey="commission" name="Commission" fill={BURGUNDY} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="flex items-center gap-2 mb-3">
        <GraduationCap size={16} style={{ color: NAVY }} />
        <h2 className="font-bold" style={{ color: NAVY }}>Manpower Skills</h2>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Languages size={14} style={{ color: BROWN }} />
          <span className="text-xs font-semibold" style={{ color: BROWN }}>English:</span>
          <div className="flex gap-1.5">
            {ENGLISH.map(e => (
              <button key={e} onClick={() => setEnglish(e)} className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                style={english === e ? { background: NAVY, color: 'white' } : { background: '#faf8f6', color: BROWN, border: '1.5px solid #e6ddd8' }}>{e}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: BROWN }}>Qualification:</span>
          <select value={qual} onChange={e => setQual(e.target.value)} className="text-xs font-medium px-3 py-1.5 rounded-full outline-none" style={{ background: '#faf8f6', color: BROWN, border: '1.5px solid #e6ddd8' }}>
            {quals.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <span className="text-xs ml-auto" style={{ color: 'rgba(75,46,42,0.55)' }}>{rows.length} of {skills.length} associates</span>
      </div>

      <Table headers={['Name', 'English', 'Qualification', 'Specialization', 'Experience']}>
        {rows.map(m => (
          <tr key={m.id} className="border-b hover:bg-[#faf8f6]" style={{ borderColor: '#f1ece8' }}>
            <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: NAVY }}>{m.name}</td>
            <td className="px-4 py-3.5"><Pill label={m.english === 'Yes' ? 'Fluent' : 'Basic'} /></td>
            <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{m.qualification ?? '—'}</td>
            <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{m.specialization ?? '—'}</td>
            <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{m.experience ?? '—'}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No associates match these filters.</td></tr>}
      </Table>
    </div>
  );
}
