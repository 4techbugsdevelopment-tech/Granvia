// AttendanceScreen — guard check-in/check-out backed by the API
import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, CheckCircle, LogIn, LogOut, Calendar, AlertCircle, History, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  listMyAttendance,
  checkInAttendance,
  checkOutAttendance,
  saveHistoricalAttendance,
} from '../../services/attendanceService';
import { getCurrentPosition } from '../../lib/geoUtils';

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

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function yesterdayValue() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateValue(date);
}

function coordinateLink(lat: number | string | null, lng: number | string | null) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`;
}

function attendanceDateKey(value: string) {
  return value.slice(0, 10);
}

function calendarCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  return [
    ...Array.from({ length: mondayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, monthIndex, index + 1)),
  ];
}

export default function AttendanceScreen() {
  const now = new Date();

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const [successType, setSuccessType] = useState<'in' | 'out' | 'history' | null>(null);
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [historySaving, setHistorySaving] = useState(false);
  const [historyDate, setHistoryDate] = useState(yesterdayValue);
  const [historyIn, setHistoryIn] = useState('09:00');
  const [historyOut, setHistoryOut] = useState('17:00');
  const [historyRemarks, setHistoryRemarks] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => localDateValue(now));

  useEffect(() => {
    const load = () => listMyAttendance()
      .then(setRecords)
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const todayRecord = records.find(r => isToday(r.attendance_date));
  const canMarkIn = !loading && !todayRecord;
  const canMarkOut = Boolean(todayRecord && !todayRecord.out_time);

  const handleMark = async (type: 'in' | 'out') => {
    setPulseActive(true);
    setMarking(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      if (!position) throw new Error('Location access is required to mark attendance. Please enable location and try again.');
      if (type === 'in') {
        const record = await checkInAttendance({ latitude: position.lat, longitude: position.lng });
        setRecords(prev => [record, ...prev]);
      } else if (todayRecord) {
        const record = await checkOutAttendance(todayRecord.id, { latitude: position.lat, longitude: position.lng });
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

  const saveHistory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHistorySaving(true);
    setError(null);
    try {
      const inTime = new Date(`${historyDate}T${historyIn}:00`);
      const outTime = new Date(`${historyDate}T${historyOut}:00`);
      if (outTime <= inTime) outTime.setDate(outTime.getDate() + 1);
      if (outTime > new Date()) throw new Error('Historical check-out cannot be in the future.');

      const record = await saveHistoricalAttendance({
        attendanceDate: historyDate,
        inTime: inTime.toISOString(),
        outTime: outTime.toISOString(),
        guardRemarks: historyRemarks || undefined,
      });
      setRecords(prev => [record, ...prev.filter(r => r.id !== record.id)]);
      setShowHistoryForm(false);
      setHistoryRemarks('');
      setSuccessType('history');
      setTimeout(() => setSuccessType(null), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setHistorySaving(false);
    }
  };

  const recentDays = records.slice(0, 7);
  const recordsByDate = records.reduce<Record<string, any[]>>((grouped, record) => {
    const key = attendanceDateKey(record.attendance_date);
    (grouped[key] ||= []).push(record);
    return grouped;
  }, {});
  const monthPrefix = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthRecords = records.filter(record => attendanceDateKey(record.attendance_date).startsWith(monthPrefix));
  const monthDays = new Set(monthRecords.map(record => attendanceDateKey(record.attendance_date))).size;
  const monthHours = monthRecords.reduce((sum, record) => sum + Number(record.total_hours ?? 0), 0);
  const monthPending = monthRecords.filter(record => !['verified', 'approved'].includes(record.status)).length;
  const monthIncomplete = monthRecords.filter(record => !record.out_time).length;
  const selectedRecords = recordsByDate[selectedDate] ?? [];
  const isCurrentCalendarMonth = calendarMonth.getFullYear() === now.getFullYear() && calendarMonth.getMonth() === now.getMonth();

  const moveCalendarMonth = (amount: number) => {
    const target = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + amount, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (target > currentMonth) return;
    setCalendarMonth(target);
    setSelectedDate(target.getTime() === currentMonth.getTime() ? localDateValue(now) : localDateValue(target));
  };

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
                  {successType === 'in' ? 'Checked In!' : successType === 'out' ? 'Checked Out!' : 'Past Attendance Submitted!'}
                </p>
                <p className="text-sm text-gray-400">
                  {successType === 'history' ? 'Pending employer verification' : formatTime(now.toISOString())}
                </p>
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

      {/* Monthly attendance calendar */}
      <div className="px-4 mt-4">
        <div className="rounded-3xl bg-white p-4" style={{ boxShadow: '0 4px 18px rgba(0,0,0,0.07)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Attendance Summary</h2>
              <p className="text-[11px] text-gray-400">Tap a marked date to view details</p>
            </div>
            <div className="flex items-center gap-1">
              <button aria-label="Previous month" onClick={() => moveCalendarMonth(-1)} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 mobile-touch-interactive"><ChevronLeft size={16} /></button>
              <p className="w-28 text-center text-sm font-bold text-slate-800">{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
              <button aria-label="Next month" disabled={isCurrentCalendarMonth} onClick={() => moveCalendarMonth(1)} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 disabled:opacity-30 mobile-touch-interactive"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl bg-blue-50 p-2 text-center"><p className="text-lg font-bold text-blue-900">{monthDays}</p><p className="text-[10px] text-blue-700">Days</p></div>
            <div className="rounded-xl bg-green-50 p-2 text-center"><p className="text-lg font-bold text-green-800">{Math.round(monthHours * 10) / 10}</p><p className="text-[10px] text-green-700">Hours</p></div>
            <div className="rounded-xl bg-amber-50 p-2 text-center"><p className="text-lg font-bold text-amber-800">{monthPending}</p><p className="text-[10px] text-amber-700">Pending</p></div>
            <div className="rounded-xl bg-red-50 p-2 text-center"><p className="text-lg font-bold text-red-700">{monthIncomplete}</p><p className="text-[10px] text-red-600">Incomplete</p></div>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} className="py-1 text-center text-[10px] font-semibold text-gray-400">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calendarCells(calendarMonth).map((date, index) => {
              if (!date) return <div key={`blank-${index}`} className="h-10" />;
              const key = localDateValue(date);
              const dayRecords = recordsByDate[key] ?? [];
              const hasIncomplete = dayRecords.some(record => !record.out_time);
              const hasPending = dayRecords.some(record => !['verified', 'approved'].includes(record.status));
              const statusColor = hasIncomplete ? '#dc2626' : hasPending ? '#d97706' : dayRecords.length ? '#16a34a' : null;
              const selected = selectedDate === key;
              const today = key === localDateValue(now);
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className="h-10 rounded-xl flex flex-col items-center justify-center text-xs font-semibold mobile-touch-interactive"
                  style={{ background: selected ? '#0f1e3c' : today ? '#eff6ff' : 'transparent', color: selected ? 'white' : '#334155' }}
                >
                  <span>{date.getDate()}</span>
                  <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: statusColor ?? 'transparent' }} />
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-green-600" />Verified</span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-amber-600" />Pending</span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-red-600" />Incomplete</span>
          </div>

          {selectedRecords.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-2">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <div className="space-y-2">
                {selectedRecords.map(record => (
                  <div key={record.id} className="rounded-xl bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{record.job_posts?.title ?? 'Attendance'}</p>
                      <p className="text-[11px] text-gray-500">{formatTime(record.in_time) ?? '--'} – {formatTime(record.out_time) ?? 'Not checked out'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-blue-900">{formatHours(record.total_hours) ?? '--'}</p>
                      <p className={`text-[10px] ${['verified', 'approved'].includes(record.status) ? 'text-green-700' : 'text-amber-700'}`}>{['verified', 'approved'].includes(record.status) ? 'Verified' : 'Pending'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedRecords.length === 0 && selectedDate.startsWith(monthPrefix) && (
            <p className="mt-3 pt-3 border-t border-gray-100 text-center text-xs text-gray-400">No attendance recorded for this date.</p>
          )}
        </div>
      </div>

      {/* Past-date attendance correction */}
      <div className="px-4 mt-4">
        {!showHistoryForm ? (
          <button
            onClick={() => { setError(null); setShowHistoryForm(true); }}
            className="w-full py-3.5 rounded-2xl border border-blue-100 bg-blue-50 text-blue-800 text-sm font-semibold flex items-center justify-center gap-2 mobile-touch-interactive"
          >
            <History size={16} /> Add or correct past attendance
          </button>
        ) : (
          <form onSubmit={saveHistory} className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 3px 14px rgba(0,0,0,0.07)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Past attendance</h3>
                <p className="text-xs text-gray-400">Submitted changes require employer verification.</p>
              </div>
              <button type="button" onClick={() => setShowHistoryForm(false)} className="p-2 rounded-lg bg-gray-50 text-gray-500"><X size={15} /></button>
            </div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Attendance date</label>
            <input
              type="date"
              value={historyDate}
              max={yesterdayValue()}
              onChange={e => setHistoryDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-3"
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="text-xs font-semibold text-gray-600">
                Check-in time
                <input type="time" value={historyIn} onChange={e => setHistoryIn(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Check-out time
                <input type="time" value={historyOut} onChange={e => setHistoryOut(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </label>
            </div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason / remarks</label>
            <textarea
              value={historyRemarks}
              onChange={e => setHistoryRemarks(e.target.value)}
              rows={2}
              placeholder="Why is this attendance being added or corrected?"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none"
            />
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2 mt-2">
              This is labelled as a historical manual entry and will remain pending until the connected employer verifies it.
            </p>
            {error && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={historySaving || !historyDate || !historyIn || !historyOut}
              className="w-full mt-3 py-3 rounded-xl bg-blue-900 text-white text-sm font-bold disabled:opacity-50"
            >
              {historySaving ? 'Submitting…' : 'Submit past attendance'}
            </button>
          </form>
        )}
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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {coordinateLink(rec.check_in_latitude, rec.check_in_longitude) && (
                          <a href={coordinateLink(rec.check_in_latitude, rec.check_in_longitude)!} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600">Check-in GPS</a>
                        )}
                        {coordinateLink(rec.check_out_latitude, rec.check_out_longitude) && (
                          <a href={coordinateLink(rec.check_out_latitude, rec.check_out_longitude)!} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600">Check-out GPS</a>
                        )}
                        {rec.checkout_method === 'automatic' && <span className="text-[10px] text-purple-600">Auto checkout</span>}
                        {rec.entry_mode === 'historical_manual' && <span className="text-[10px] text-amber-600">Manual past entry</span>}
                      </div>
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
