// Sub Admin Dashboard — live branch-scoped stats + charts.
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area,
} from 'recharts';
import { Briefcase, Users, IndianRupee, MapPinned, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getSubAdminCounts, getCommissionReport, getBranchGuards, SubAdminCounts, CommissionReport, BranchGuard } from '../../services/subadminService';
import { GlassStat, Card } from '../ui';
import { NAVY, BURGUNDY, BROWN } from '../theme';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function DashboardPage() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<SubAdminCounts | null>(null);
  const [commission, setCommission] = useState<CommissionReport | null>(null);
  const [guards, setGuards] = useState<BranchGuard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSubAdminCounts(), getCommissionReport(), getBranchGuards()])
      .then(([c, cm, g]) => { setCounts(c); setCommission(cm); setGuards(g); })
      .finally(() => setLoading(false));
  }, []);

  // Area-wise availability derived from branch service partners grouped by city.
  const byArea = useMemo(() => {
    const m = new Map<string, number>();
    guards.forEach(g => { const k = g.city || 'Unknown'; m.set(k, (m.get(k) ?? 0) + 1); });
    return Array.from(m, ([area, partners]) => ({ area, partners }));
  }, [guards]);

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-56" style={{ background: 'linear-gradient(135deg, #1A2B56 0%, #24365f 45%, #4B2E2A 120%)' }} />

      <div className="relative p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Sub Admin Dashboard</h1>
          <p className="text-sm text-white/70 mt-0.5">{profile?.full_name ?? 'Regional Branch'}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GlassStat label="Active Jobs" value={loading ? '…' : String(counts?.active_jobs ?? 0)} icon={<Briefcase size={18} />} accent={NAVY} />
          <GlassStat label="Service Partners" value={loading ? '…' : String(counts?.service_partners ?? 0)} sub="Manpower in branch" icon={<Users size={18} />} accent={BURGUNDY} />
          <GlassStat label="Commission" value={loading ? '…' : inr(counts?.commission ?? 0)} sub="From settlements" icon={<IndianRupee size={18} />} accent={BROWN} />
          <GlassStat label="Clients" value={loading ? '…' : String(counts?.clients ?? 0)} sub={`${counts?.staff ?? 0} staff`} icon={<MapPinned size={18} />} accent={NAVY} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <MapPinned size={16} style={{ color: NAVY }} />
              <h2 className="font-bold" style={{ color: NAVY }}>Area-wise Manpower Availability</h2>
            </div>
            {byArea.length === 0 ? (
              <p className="text-sm py-16 text-center" style={{ color: 'rgba(75,46,42,0.5)' }}>No service partners in your branch yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byArea} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#efe8e3" vertical={false} />
                  <XAxis dataKey="area" tick={{ fontSize: 12, fill: BROWN }} tickLine={false} axisLine={{ stroke: '#e6ddd8' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: BROWN }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(26,43,86,0.05)' }} contentStyle={{ borderRadius: 12, border: '1px solid #ece7e3', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="partners" name="Service Partners" fill={NAVY} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} style={{ color: BURGUNDY }} />
              <h2 className="font-bold" style={{ color: NAVY }}>Commission Trend</h2>
            </div>
            {commission && commission.by_month.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={commission.by_month} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="commFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BURGUNDY} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={BURGUNDY} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#efe8e3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: BROWN }} tickLine={false} axisLine={{ stroke: '#e6ddd8' }} />
                    <YAxis tick={{ fontSize: 11, fill: BROWN }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #ece7e3', fontSize: 12 }} formatter={(v) => [inr(Number(v)), 'Commission']} />
                    <Area type="monotone" dataKey="commission" stroke={BURGUNDY} strokeWidth={2.5} fill="url(#commFill)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span style={{ color: BROWN }}>Total earned</span>
                  <span className="font-bold" style={{ color: NAVY }}>{inr(commission.total_earned)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm py-16 text-center" style={{ color: 'rgba(75,46,42,0.5)' }}>No settlements recorded yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
