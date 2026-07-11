// AttendanceScreen — guard check-in/check-out backed by the Laravel API
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, CheckCircle, LogIn, LogOut, Calendar, AlertCircle } from 'lucide-react';
import { listMyAttendance, checkInAttendance, checkOutAttendance } from '../../services/attendanceService';

function formatTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatHours(total: number | string | null | undefined) {
  if (total == null) return null;
  const n = Number(total);
  if (Number.isNaN(n)) return null;
  return `${Math.floor(n)}h ${Math.round((n - Math.floor(n)) * 60)}m`;
}

function isToday(dateValue: string) {
  return new Date(dateValue).toDateString() === new Date().toDateString();
}

export default function AttendanceScreen() {
  const now = new Date();

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const [successType, setSuccessType] = useState<'in' | 'out' | null>(null);

  useEffect(() => {
    listMyAttendance()
      .then(setRecords)
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  const todayRecord = records.find(r => isToday(r.attendance_date));
  const canMarkIn = !loading && !todayRecord;
  const canMarkOut = Boolean(todayRecord && !todayRecord.out_time);

  const handleMark = async (type: 'in' | 'out') => {
    setPulseActive(true);
    setMarking(true);
    setError(null);
    try {
      if (type === 'in') {
        const record = await checkInAttendance();
        setRecords(prev => [record, ...prev]);
      } else if (todayRecord) {
        const record = await checkOutAttendance(todayRecord.id);
        setRecords(prev => prev.map(r => (r.id === record.id ? record : r)));
      }
      setSuccessType(type);
      setTimeout(() => setSuccessType(null), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setMarking(false);
      setPulseActive(false);
    }
  };

  const recentDays = records.slice(0, 7);

  return (
    <div className="pb-4">
      {/* Header */}
      <div
        className="px-4 pt-5 pb-6"
        style={{
          background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)',
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        }}
      >
        <h1 className="text-white font-bold text-xl mb-1">Attendance</h1>
        <p className="text-blue-200 text-xs">{formatDate(now)}</p>
      </div>

      {/* Errors */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs">
          <AlertCircle size={13} className="flex-shrink-0" />{error}
        </div>
      )}

      {/* Main mark card */}
      <div className="px-4 mt-4">
        <motion.div
          className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* GPS pulse animation */}
          <div className="relative flex justify-center mb-5">
            {pulseActive && [1, 2, 3].map(ring => (
              <motion.div
                key={ring}
                className="absolute rounded-full border border-blue-300"
                style={{ width: 50 + ring * 30, height: 50 + ring * 30 }}
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: ring * 0.4 }}
              />
            ))}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: todayRecord?.out_time ? '#dcfce7' : todayRecord ? '#fef9c3' : '#f0f4f8' }}
            >
              <MapPin size={24} style={{ color: todayRecord?.out_time ? '#166534' : todayRecord ? '#854d0e' : '#64748b' }} />
            </div>
          </div>

          {/* Status */}
          <AnimatePresence mode="wait">
            {successType ? (
              <motion.div
                className="flex flex-col items-center gap-2"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CheckCircle size={40} style={{ color: '#22c55e' }} />
                <p className="font-bold text-lg text-gray-800">
                  {successType === 'in' ? 'Checked In!' : 'Checked Out!'}
                </p>
                <p className="text-sm text-gray-400">{formatTime(now.toISOString())}</p>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-sm font-semibold text-gray-500 mb-4">
                  {loading ? 'Loading…' : todayRecord?.out_time ? 'Shift Complete' : todayRecord ? 'Currently Active' : 'Not Checked In'}
                </p>

                {/* In/Out times */}
                <div className="flex justify-around bg-gray-50 rounded-2xl p-4 mb-5">
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">CHECK IN</div>
                    <div className="font-bold text-gray-800">{formatTime(todayRecord?.in_time) || '--:--'}</div>
                    <div className="w-6 h-1 rounded-full mt-1.5 mx-auto" style={{ background: todayRecord ? '#22c55e' : '#e2e8f0' }} />
                  </div>
                  <div className="w-px bg-gray-200" />
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">CHECK OUT</div>
                    <div className="font-bold text-gray-800">{formatTime(todayRecord?.out_time) || '--:--'}</div>
                    <div className="w-6 h-1 rounded-full mt-1.5 mx-auto" style={{ background: todayRecord?.out_time ? '#ef4444' : '#e2e8f0' }} />
                  </div>
                  <div className="w-px bg-gray-200" />
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">HOURS</div>
                    <div className="font-bold" style={{ color: '#0f1e3c' }}>{formatHours(todayRecord?.total_hours) || '--'}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  {canMarkIn && (
                    <motion.button
                      onClick={() => handleMark('in')}
                      disabled={marking}
                      className="flex-1 py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 mobile-touch-interactive"
                      style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {marking ? (
                        <motion.div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                      ) : (
                        <><LogIn size={16} /> Check In</>
                      )}
                    </motion.button>
                  )}
                  {canMarkOut && (
                    <motion.button
                      onClick={() => handleMark('out')}
                      disabled={marking}
                      className="flex-1 py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 mobile-touch-interactive"
                      style={{ background: 'linear-gradient(135deg, #8b1a1a, #c0392b)' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {marking ? (
                        <motion.div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                      ) : (
                        <><LogOut size={16} /> Check Out</>
                      )}
                    </motion.button>
                  )}
                  {todayRecord?.out_time && (
                    <div className="flex-1 py-4 rounded-2xl text-center text-sm font-bold" style={{ background: '#dcfce7', color: '#166534' }}>
                      Shift Complete
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Attendance history */}
      <div className="px-4 mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={15} style={{ color: '#8b1a1a' }} />
          <h3 className="text-sm font-bold text-gray-700">Recent History</h3>
        </div>

        {!loading && recentDays.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Clock size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No attendance records yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentDays.map((rec, i) => {
              const verified = rec.status === 'verified' || rec.status === 'approved';
              return (
                <motion.div
                  key={rec.id}
                  className="rounded-2xl p-4 flex items-center justify-between"
                  style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: verified ? '#dcfce7' : '#fef9c3' }}
                    >
                      <Clock size={16} style={{ color: verified ? '#166534' : '#854d0e' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {new Date(rec.attendance_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(rec.in_time) ?? '--'} {rec.out_time ? `→ ${formatTime(rec.out_time)}` : '(not checked out)'}
                        {rec.job_posts?.title && <span className="ml-1">· {rec.job_posts.title}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: '#0f1e3c' }}>{formatHours(rec.total_hours) || '--'}</div>
                    <div
                      className="text-xs font-medium px-2 py-0.5 rounded-full mt-0.5"
                      style={{
                        background: verified ? '#dcfce7' : '#fef9c3',
                        color: verified ? '#166534' : '#854d0e',
                      }}
                    >
                      {verified ? 'Verified' : 'Pending'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
