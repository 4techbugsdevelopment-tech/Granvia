// MobileDashboard — guard home screen backed by the API
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, FileText, ChevronRight, Bell, TrendingUp } from 'lucide-react';
import FlipCard from '../../components/FlipCard';
import { useAuth } from '../../hooks/useAuth';
import { listMyAttendance } from '../../services/attendanceService';
import { listMyApplications } from '../../services/applicationService';
import { listActiveJobs } from '../../services/jobService';

interface MobileDashboardProps {
  onNavigate: (screen: string) => void;
}

function AnimatedNum({ val }: { val: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let s = 0; const step = Math.max(val / 30, 1);
    const t = setInterval(() => {
      s += step; if (s >= val) { setN(val); clearInterval(t); } else setN(Math.floor(s));
    }, 20);
    return () => clearInterval(t);
  }, [val]);
  return <>{n}</>;
}

function DashboardFlipCard({
  front,
  back,
  heightClass,
  onClick,
}: {
  front: ReactNode;
  back: ReactNode;
  heightClass: string;
  onClick?: () => void;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlipHover = (flip: boolean) => {
    if (window.matchMedia('(hover: hover)').matches) {
      setIsFlipped(flip);
    }
  };

  const handleTap = () => {
    if (!window.matchMedia('(hover: hover)').matches) {
      setIsFlipped(current => !current);
    }
    onClick?.();
  };

  return (
    <div
      className={`relative w-full ${heightClass} rounded-2xl cursor-pointer mobile-touch-interactive`}
      style={{ perspective: '1000px' }}
      onMouseEnter={() => handleFlipHover(true)}
      onMouseLeave={() => handleFlipHover(false)}
      onClick={handleTap}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <motion.div
        className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{ backfaceVisibility: 'hidden' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {front}
      </motion.div>
      <motion.div
        className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)',
          backfaceVisibility: 'hidden',
        }}
        animate={{ rotateY: isFlipped ? 0 : 180 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {back}
      </motion.div>
    </div>
  );
}

function formatTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function MobileDashboard({ onNavigate }: MobileDashboardProps) {
  const { profile, guardProfile } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    listMyAttendance().then(setAttendance).catch(() => {});
    listMyApplications().then(data => setApplications(data ?? [])).catch(() => {});
    listActiveJobs().then(data => setJobs(data ?? [])).catch(() => {});
  }, []);

  const fullName = guardProfile?.full_name || profile?.full_name || 'Associate';
  const city = guardProfile?.city || '—';
  const active = profile?.account_status === 'active';

  const todayAtt = attendance.find(a => new Date(a.attendance_date).toDateString() === new Date().toDateString());
  const totalHours = attendance.reduce((sum, a) => sum + (Number(a.total_hours) || 0), 0);

  const quickLinks = [
    { label: 'Find Jobs', icon: '🔍', screen: 'jobs', color: '#0f1e3c' },
    { label: 'Attendance', icon: '📍', screen: 'attendance', color: '#8b1a1a' },
    { label: 'Applications', icon: '📋', screen: 'applications', color: '#166534' },
    { label: 'Availability', icon: '🗓️', screen: 'availability', color: '#5b21b6' },
    { label: 'Wallet', icon: '💰', screen: 'wallet', color: '#854d0e' },
    { label: 'My Profile', icon: '👤', screen: 'profile', color: '#7c2d12' },
    { label: 'Notifications', icon: '🔔', screen: 'notifications', color: '#1d4ed8' },
    { label: 'Support', icon: '🎧', screen: 'support', color: '#1e3a5f' },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div
        className="px-5 pt-5 pb-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f1e3c 0%, #1a2d50 100%)',
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        }}
      >
        <motion.div
          className="absolute w-48 h-48 rounded-full opacity-10"
          style={{ background: '#8b1a1a', top: -40, right: -40 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-200 text-xs mb-0.5">{greeting()},</p>
            <h1 className="text-white font-bold text-xl">{fullName.split(' ')[0]}</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <motion.button
              className="relative w-9 h-9 rounded-full flex items-center justify-center mobile-touch-interactive"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onNavigate('notifications')}
            >
              <Bell size={16} className="text-white" />
            </motion.button>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-lg"
              style={{ background: 'rgba(139,26,26,0.5)' }}
            >
              {fullName.charAt(0)}
            </div>
          </div>
        </div>

        {/* Status card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DashboardFlipCard
            heightClass="h-16"
            front={(
              <div
                className="h-full rounded-2xl p-4 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: active ? '#22c55e' : '#ef4444' }}
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-white text-sm font-medium">{active ? 'Active' : 'Blocked'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-200 text-xs">
                  <MapPin size={11} />
                  <span>{city}</span>
                </div>
                <div className="text-white text-xs">
                  <span className="opacity-60">Today: </span>
                  <span className="font-semibold">{todayAtt ? (todayAtt.out_time ? 'Complete' : 'Checked In') : 'Not Marked'}</span>
                </div>
              </div>
            )}
            back={(
              <div className="h-full px-4 flex items-center justify-between text-white">
                <div>
                  <p className="text-xs text-blue-200">Verification</p>
                  <p className="text-sm font-bold capitalize">{guardProfile?.verification_status ?? 'pending'}</p>
                </div>
                <div className="text-right min-w-0">
                  <p className="text-xs text-blue-200">Location</p>
                  <p className="text-sm font-bold truncate">{city}</p>
                </div>
              </div>
            )}
          />
        </motion.div>
      </div>

      {/* Stats strip with Flip */}
      <div className="grid grid-cols-3 gap-2.5 px-4 -mt-4 relative z-10">
        {[
          { label: 'Days Present', value: attendance.length, icon: <Clock size={14} />, color: '#0f1e3c' },
          { label: 'Applied Jobs', value: applications.length, icon: <FileText size={14} />, color: '#8b1a1a' },
          { label: 'Hrs Logged', value: Math.round(totalHours), icon: <TrendingUp size={14} />, color: '#166534' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
          >
            <FlipCard icon={stat.icon} label={stat.label} value={<AnimatedNum val={stat.value} />} color={stat.color} />
          </motion.div>
        ))}
      </div>

      {/* Quick links */}
      <div className="px-4 mt-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Quick Access</h3>
        <div className="grid grid-cols-3 gap-2.5">
          {quickLinks.map((link, i) => (
            <motion.div
              key={link.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i }}
            >
              <DashboardFlipCard
                heightClass="h-24"
                onClick={() => onNavigate(link.screen)}
                front={(
                  <div
                    className="h-full rounded-2xl p-3.5 flex flex-col items-center justify-center gap-1.5"
                    style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                  >
                    <span className="text-2xl">{link.icon}</span>
                    <span className="text-xs font-semibold text-gray-700">{link.label}</span>
                  </div>
                )}
                back={(
                  <div className="h-full p-3 flex flex-col items-center justify-center text-center text-white">
                    <span className="text-xl mb-1">{link.icon}</span>
                    <span className="text-xs font-bold">{link.label}</span>
                    <span className="text-[10px] text-blue-200 mt-1 flex items-center gap-0.5">
                      Open <ChevronRight size={10} />
                    </span>
                  </div>
                )}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Today's attendance card */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">Today's Attendance</h3>
          <motion.button
            className="text-xs font-semibold flex items-center gap-1 mobile-touch-interactive"
            style={{ color: '#0f1e3c' }}
            onClick={() => onNavigate('attendance')}
            whileTap={{ scale: 0.95 }}
          >
            View All <ChevronRight size={12} />
          </motion.button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <DashboardFlipCard
            heightClass="h-24"
            onClick={() => onNavigate('attendance')}
            front={(
              <div className="h-full rounded-2xl p-4" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {todayAtt ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
                  <Clock size={18} style={{ color: '#166534' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    {todayAtt.out_time ? 'Shift Complete' : 'Checked In'}
                  </p>
                  <p className="text-xs text-gray-400">
                    In: {formatTime(todayAtt.in_time) ?? '--'} {todayAtt.out_time ? `· Out: ${formatTime(todayAtt.out_time)}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold" style={{ color: '#166534' }}>
                {todayAtt.total_hours ? `${Number(todayAtt.total_hours).toFixed(1)}h` : '–'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fee2e2' }}>
                  <Clock size={18} style={{ color: '#7c2d12' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Not Marked Yet</p>
                  <p className="text-xs text-gray-400">Mark your attendance for today</p>
                </div>
              </div>
              <motion.button
                onClick={() => onNavigate('attendance')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl text-white mobile-touch-interactive"
                style={{ background: '#0f1e3c' }}
                whileTap={{ scale: 0.93 }}
              >
                Mark Now
              </motion.button>
            </div>
          )}
              </div>
            )}
            back={(
              <div className="h-full p-4 flex items-center justify-between text-white">
                <div>
                  <p className="text-xs text-blue-200">Attendance</p>
                  <p className="text-sm font-bold capitalize">{todayAtt ? String(todayAtt.status ?? 'pending').replace(/_/g, ' ') : 'Pending'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-200">Action</p>
                  <p className="text-sm font-bold flex items-center gap-1">View Details <ChevronRight size={14} /></p>
                </div>
              </div>
            )}
          />
        </motion.div>
      </div>

      {/* Nearby jobs preview */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">Latest Jobs</h3>
          <motion.button
            className="text-xs font-semibold flex items-center gap-1 mobile-touch-interactive"
            style={{ color: '#0f1e3c' }}
            onClick={() => onNavigate('jobs')}
            whileTap={{ scale: 0.95 }}
          >
            See All <ChevronRight size={12} />
          </motion.button>
        </div>
        <div className="space-y-2.5">
          {jobs.slice(0, 2).map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
            >
              <DashboardFlipCard
                heightClass="h-28"
                onClick={() => onNavigate('jobs')}
                front={(
                  <div className="h-full rounded-2xl p-4 text-left" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{job.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{job.employer_companies?.company_name ?? '—'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs flex items-center gap-1 text-gray-400">
                      <MapPin size={10} />{job.company_sites?.city ?? '—'}
                    </span>
                    <span className="text-xs font-bold" style={{ color: '#166534' }}>
                      ₹{job.salary_amount}/{job.payment_type === 'Monthly' ? 'mo' : 'day'}
                    </span>
                  </div>
                </div>
                <div
                  className="text-xs font-bold px-2 py-1 rounded-lg ml-2 flex-shrink-0"
                  style={{ background: '#dbeafe', color: '#1d4ed8' }}
                >
                  {job.shift_type ?? 'Day'}
                </div>
              </div>
            </div>
                )}
                back={(
                  <div className="h-full p-4 flex items-center justify-between text-white">
                    <div className="min-w-0">
                      <p className="text-xs text-blue-200">{job.shift_type ?? 'Day'} Shift</p>
                      <p className="text-sm font-bold truncate">{job.guards_required ?? 1} opening{(job.guards_required ?? 1) !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-blue-200 mt-1 truncate">{job.duration_type ?? ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-blue-200">Salary</p>
                      <p className="text-lg font-bold">₹{job.salary_amount}</p>
                      <p className="text-xs text-blue-200 flex items-center gap-0.5">View <ChevronRight size={10} /></p>
                    </div>
                  </div>
                )}
              />
            </motion.div>
          ))}
          {jobs.length === 0 && (
            <div className="rounded-2xl p-4 text-center text-xs text-gray-400" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              No active jobs right now — check back soon
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
