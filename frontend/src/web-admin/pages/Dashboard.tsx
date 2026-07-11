// Admin Dashboard — platform stats backed by the Laravel API
import { useEffect, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  Users, Briefcase, Clock, FileText, TrendingUp, MapPin,
  Shield, Activity, UserCheck, AlertCircle
} from 'lucide-react';
import FlipCard from '../../components/FlipCard';
import AdminOverviewMap from '../../components/map/AdminOverviewMap';
import { Guard } from '../../lib/storage';
import { listGuards } from '../../services/adminGuardService';
import { listAllJobsForAdmin } from '../../services/jobService';
import { getAdminReportCounts, AdminReportCounts } from '../../services/reportService';

function AnimatedCounter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(target / 60, 1);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 20);
    return () => clearInterval(timer);
  }, [target]);
  return <>{prefix}{count.toLocaleString()}{suffix}</>;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200 } },
};

export default function Dashboard() {
  const [counts, setCounts] = useState<AdminReportCounts | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminReportCounts().then(setCounts).catch(e => setError(e?.response?.data?.message || e.message));
    listGuards().then(setGuards).catch(() => {});
    listAllJobsForAdmin().then(data => setJobs(data ?? [])).catch(() => {});
  }, []);

  const activeGuards = guards.filter(g => g.status === 'Active').length;
  const verifiedGuards = guards.filter(g => g.aadhaarStatus === 'Verified' && g.policeVerification === 'Verified').length;
  const activeJobs = jobs.filter(j => j.status === 'active');
  const openPositions = activeJobs.reduce((sum, job) => sum + (job.guards_required ?? 0), 0);

  const kpis = [
    { label: 'Total Guards', value: counts?.guards ?? guards.length, icon: <Users size={20} />, color: '#0f1e3c' },
    { label: 'Active Guards', value: activeGuards, icon: <Shield size={20} />, color: '#166534' },
    { label: 'Employers', value: counts?.employers ?? 0, icon: <UserCheck size={20} />, color: '#0f766e' },
    { label: 'Jobs Posted', value: counts?.jobs ?? jobs.length, icon: <Briefcase size={20} />, color: '#7c2d12' },
    { label: 'Open Positions', value: openPositions, icon: <MapPin size={20} />, color: '#1d4ed8' },
    { label: 'Today Attendance', value: counts?.attendance_today ?? 0, icon: <Clock size={20} />, color: '#1e3a5f' },
    { label: 'Applications', value: counts?.applications ?? 0, icon: <FileText size={20} />, color: '#5b21b6' },
    { label: 'Pending Approvals', value: counts?.pending_jobs ?? 0, icon: <TrendingUp size={20} />, color: '#854d0e' },
  ];

  // Top cities by guard count, with job counts from the same city.
  const cityMap = new Map<string, { guards: number; jobs: number }>();
  for (const g of guards) {
    const city = g.city || 'Unknown';
    const entry = cityMap.get(city) ?? { guards: 0, jobs: 0 };
    entry.guards += 1;
    cityMap.set(city, entry);
  }
  for (const j of jobs) {
    const city = j.company_sites?.city || 'Unknown';
    const entry = cityMap.get(city) ?? { guards: 0, jobs: 0 };
    entry.jobs += 1;
    cityMap.set(city, entry);
  }
  const areaStats = [...cityMap.entries()]
    .map(([city, stats]) => ({ city, ...stats }))
    .sort((a, b) => b.guards + b.jobs - (a.guards + a.jobs))
    .slice(0, 5);
  const maxGuards = Math.max(1, ...areaStats.map(a => a.guards));
  const maxJobs = Math.max(1, ...areaStats.map(a => a.jobs));

  const recentActivity = [
    ...guards.slice(0, 3).map(g => ({
      text: `Service partner registered: ${g.fullName}`,
      time: new Date(g.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      icon: <UserCheck size={14} />, color: '#166534',
    })),
    ...jobs.slice(0, 2).map(j => ({
      text: `Job posted: ${j.title}${j.employer_companies?.company_name ? ` – ${j.employer_companies.company_name}` : ''}`,
      time: j.created_at ? new Date(j.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '',
      icon: <Briefcase size={14} />, color: '#7c2d12',
    })),
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back, Super Admin</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Activity size={14} style={{ color: '#22c55e' }} />
          <span>Live</span>
          <motion.div
            className="w-2 h-2 rounded-full bg-green-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />{error}
        </motion.div>
      )}

      {/* KPI Cards with Flip */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={itemVariants}>
            <FlipCard
              icon={kpi.icon}
              label={kpi.label}
              value={<AnimatedCounter target={kpi.value} />}
              color={kpi.color}
            />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area Stats */}
        <motion.div
          variants={itemVariants}
          className="xl:col-span-2 rounded-2xl p-6"
          style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <MapPin size={16} style={{ color: '#8b1a1a' }} />
              Area-wise Stats
            </h2>
            <span className="text-xs text-gray-400">Top {areaStats.length} Cities</span>
          </div>
          {areaStats.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No location data yet</p>
          ) : (
            <div className="space-y-4">
              {areaStats.map(area => (
                <div key={area.city} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700 truncate">{area.city}</div>
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Guards</span><span>{area.guards}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: '#0f1e3c' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(area.guards / maxGuards) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.3 }}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Jobs</span><span>{area.jobs}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: '#8b1a1a' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(area.jobs / maxJobs) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.4 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-6"
          style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-5">
            <Activity size={16} style={{ color: '#8b1a1a' }} />
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((act, i) => (
                <motion.div
                  key={i}
                  className="flex gap-3 items-start"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${act.color}15`, color: act.color }}
                  >
                    {act.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-snug">{act.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{act.time}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Site / Guard map overview */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl p-6"
        style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={16} style={{ color: '#8b1a1a' }} />
            Service Partner & Site Map
          </h2>
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /> Guards</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-700 inline-block" /> Sites</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Jobs</span>
          </div>
        </div>
        <AdminOverviewMap
          guards={guards.map(g => ({
            id: g.id,
            name: g.fullName,
            city: g.city,
            latitude: g.latitude ? Number(g.latitude) : null,
            longitude: g.longitude ? Number(g.longitude) : null,
          }))}
          jobs={activeJobs.map(j => ({
            id: j.id,
            title: j.title,
            company: j.employer_companies?.company_name ?? '',
            latitude: j.company_sites?.latitude ?? null,
            longitude: j.company_sites?.longitude ?? null,
          }))}
          mapHeight={380}
        />
      </motion.div>

      {/* Guard status overview */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl p-6"
        style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)', boxShadow: '0 8px 32px rgba(15,30,60,0.2)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Shield size={16} style={{ color: '#8b1a1a' }} />
            Service Partner Status Overview
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active', value: activeGuards, color: '#22c55e' },
            { label: 'Blocked', value: guards.filter(g => g.status === 'Blocked').length, color: '#ef4444' },
            { label: 'Fully Verified', value: verifiedGuards, color: '#38bdf8' },
            { label: 'Pending Verification', value: guards.length - verifiedGuards, color: '#f59e0b' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <motion.div
                className="text-3xl font-bold"
                style={{ color: stat.color }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 0.5 }}
              >
                {stat.value}
              </motion.div>
              <div className="text-xs text-white/50 mt-1">{stat.label}</div>
              <motion.div
                className="h-0.5 rounded-full mt-2 mx-auto"
                style={{ background: stat.color }}
                initial={{ width: 0 }}
                animate={{ width: '60%' }}
                transition={{ delay: 0.7, duration: 0.5 }}
              />
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
