// Persisted associate availability with server-enforced overlap protection.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CalendarClock, Plus, X, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import {
  type AvailabilitySlot,
  createAvailability,
  deleteAvailability,
  listMyAvailability,
  updateAvailability,
} from '../../services/availabilityService';

const DURATIONS: AvailabilitySlot['duration_hours'][] = [4, 6, 8, 12];
const FREQUENCIES: AvailabilitySlot['frequency'][] = ['Regular', 'Weekly', 'Daily'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function errorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function timeRange(slot: AvailabilitySlot) {
  const [hour, minute] = slot.start_time.split(':').map(Number);
  const endMinutes = hour * 60 + minute + slot.duration_hours * 60;
  const end = `${String(Math.floor((endMinutes % 1440) / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  return `${slot.start_time}–${end}${endMinutes >= 1440 ? ' (+1 day)' : ''}`;
}

export default function AvailabilityScreen() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [duration, setDuration] = useState<AvailabilitySlot['duration_hours']>(8);
  const [frequency, setFrequency] = useState<AvailabilitySlot['frequency']>('Regular');
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [startTime, setStartTime] = useState('09:00');

  useEffect(() => {
    listMyAvailability()
      .then(setSlots)
      .catch(cause => setError(errorMessage(cause, 'Could not load availability.')))
      .finally(() => setLoading(false));
  }, []);

  const toggleDay = (day: string) => {
    setDays(current => current.includes(day) ? current.filter(item => item !== day) : [...current, day]);
    setFormError(null);
  };

  const addSlot = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const slot = await createAvailability({ duration_hours: duration, frequency, days, start_time: startTime, active: true });
      setSlots(current => [slot, ...current]);
      setAdding(false);
      setDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      setStartTime('09:00');
    } catch (cause: any) {
      setFormError(errorMessage(cause, 'Could not save availability.'));
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async (id: string) => {
    setError(null);
    try {
      await deleteAvailability(id);
      setSlots(current => current.filter(slot => slot.id !== id));
    } catch (cause: any) {
      setError(errorMessage(cause, 'Could not delete availability.'));
    }
  };

  const toggleActive = async (slot: AvailabilitySlot) => {
    setError(null);
    try {
      const updated = await updateAvailability(slot.id, { active: !slot.active });
      setSlots(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (cause: any) {
      setError(errorMessage(cause, 'Could not update availability.'));
    }
  };

  return (
    <div className="pb-6">
      <div className="px-4 pt-5 pb-6" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)', paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}>
        <h1 className="text-white font-bold text-xl mb-1">My Availability</h1>
        <p className="text-blue-200 text-xs">Schedules are saved securely to your account</p>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      <div className="px-4 mt-4">
        <button onClick={() => { setFormError(null); setAdding(true); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white mb-4" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
          <Plus size={16} /> Add Availability
        </button>

        {loading ? (
          <div className="py-14 flex flex-col items-center text-gray-400"><Loader2 size={25} className="animate-spin mb-2" /><span className="text-sm">Loading saved availability…</span></div>
        ) : (
          <div className="space-y-2.5">
            {slots.map((slot, index) => (
              <motion.div key={slot.id} className="rounded-2xl p-4" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', opacity: slot.active ? 1 : 0.55 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: slot.active ? 1 : 0.55, y: 0 }} transition={{ delay: index * 0.05 }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100"><CalendarClock size={16} className="text-slate-800" /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{slot.duration_hours}hr · {slot.frequency}</p>
                      <p className="text-xs font-medium text-blue-700">{timeRange(slot)}</p>
                      <p className="text-xs text-gray-400 truncate">{slot.days.join(', ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleActive(slot)} className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: slot.active ? '#dcfce7' : '#f1f5f9', color: slot.active ? '#166534' : '#64748b' }}>{slot.active ? 'On' : 'Off'}</button>
                    <button onClick={() => removeSlot(slot.id)} className="p-1.5 text-gray-300 hover:text-red-500" aria-label="Delete availability"><Trash2 size={14} /></button>
                  </div>
                </div>
              </motion.div>
            ))}
            {slots.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No availability set yet</div>}
          </div>
        )}
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-50 mobile-scroll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="mx-auto min-h-full w-full max-w-lg bg-white" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)', paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <div className="px-5 pt-2 pb-4">
                <button type="button" onClick={() => !saving && setAdding(false)} className="mb-4 flex items-center gap-2 rounded-xl py-2 text-sm font-semibold text-slate-700">
                  <ArrowLeft size={18} /> Back to Availability
                </button>
                <div className="flex items-center justify-between mb-4">
                  <div><h2 className="text-lg font-bold text-gray-900">Add Availability</h2><p className="text-xs text-gray-400">Overlapping active schedules will be rejected.</p></div>
                </div>

                {formError && <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 text-red-600 text-xs"><AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{formError}</div>}

                <label className="block text-xs font-semibold text-gray-500 mb-1">Start Time</label>
                <input type="time" value={startTime} onChange={event => { setStartTime(event.target.value); setFormError(null); }} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm mb-4" />

                <label className="block text-xs font-semibold text-gray-500 mb-2">Shift Duration</label>
                <div className="flex gap-2 mb-4">
                  {DURATIONS.map(item => <button key={item} onClick={() => { setDuration(item); setFormError(null); }} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: duration === item ? '#0f1e3c' : '#f1f5f9', color: duration === item ? 'white' : '#64748b' }}>{item}hr</button>)}
                </div>

                <label className="block text-xs font-semibold text-gray-500 mb-2">Frequency</label>
                <div className="flex gap-2 mb-4">
                  {FREQUENCIES.map(item => <button key={item} onClick={() => { setFrequency(item); setFormError(null); }} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: frequency === item ? '#0f1e3c' : '#f1f5f9', color: frequency === item ? 'white' : '#64748b' }}>{item}</button>)}
                </div>

                <label className="block text-xs font-semibold text-gray-500 mb-2">Days</label>
                <div className="flex flex-wrap gap-2 mb-5">
                  {DAYS.map(day => <button key={day} onClick={() => toggleDay(day)} className="px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ borderColor: days.includes(day) ? '#0f1e3c' : '#e2e8f0', background: days.includes(day) ? '#0f1e3c' : 'white', color: days.includes(day) ? 'white' : '#64748b' }}>{day}</button>)}
                </div>

                <button onClick={addSlot} disabled={saving || days.length === 0 || !startTime} className="w-full py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
                  {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Checking and saving…' : 'Save Availability'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
