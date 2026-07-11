// AvailabilityScreen — guard posts availability schedule (demo data; API pending)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Plus, X, Trash2 } from 'lucide-react';
import { demoAvailability, DemoAvailability } from '../../lib/demoData';

const DURATIONS: DemoAvailability['duration'][] = ['4hr', '6hr', '8hr', '12hr'];
const FREQUENCIES: DemoAvailability['frequency'][] = ['Regular', 'Weekly', 'Daily'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AvailabilityScreen() {
  const [slots, setSlots] = useState<DemoAvailability[]>(demoAvailability);
  const [adding, setAdding] = useState(false);
  const [duration, setDuration] = useState<DemoAvailability['duration']>('8hr');
  const [frequency, setFrequency] = useState<DemoAvailability['frequency']>('Regular');
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  const toggleDay = (d: string) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const addSlot = () => {
    setSlots(prev => [{ id: `AV-${Date.now()}`, duration, frequency, days, active: true }, ...prev]);
    setAdding(false);
    setDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  };

  const removeSlot = (id: string) => setSlots(prev => prev.filter(s => s.id !== id));
  const toggleActive = (id: string) => setSlots(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));

  return (
    <div className="pb-6">
      <div
        className="px-4 pt-5 pb-6"
        style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)', paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
      >
        <h1 className="text-white font-bold text-xl mb-1">My Availability</h1>
        <p className="text-blue-200 text-xs">Tell employers when you can work</p>
      </div>

      <div className="px-4 mt-4">
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white mb-4"
          style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
        >
          <Plus size={16} /> Add Availability
        </button>

        <div className="space-y-2.5">
          {slots.map((slot, i) => (
            <motion.div
              key={slot.id}
              className="rounded-2xl p-4"
              style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', opacity: slot.active ? 1 : 0.55 }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: slot.active ? 1 : 0.55, y: 0 }} transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0f4f8' }}>
                    <CalendarClock size={16} style={{ color: '#0f1e3c' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{slot.duration} · {slot.frequency}</p>
                    <p className="text-xs text-gray-400">{slot.days.join(', ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleActive(slot.id)} className="text-xs font-semibold px-2 py-1 rounded-lg"
                    style={{ background: slot.active ? '#dcfce7' : '#f1f5f9', color: slot.active ? '#166534' : '#64748b' }}>
                    {slot.active ? 'On' : 'Off'}
                  </button>
                  <button onClick={() => removeSlot(slot.id)} className="p-1.5 text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {slots.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No availability set yet</div>
          )}
        </div>
      </div>

      {/* Add sheet */}
      <AnimatePresence>
        {adding && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAdding(false)}
          >
            <motion.div
              className="w-full rounded-t-3xl bg-white"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <div className="px-5 pt-2 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Add Availability</h2>
                  <button onClick={() => setAdding(false)} className="text-gray-400"><X size={18} /></button>
                </div>

                <label className="block text-xs font-semibold text-gray-500 mb-2">Shift Duration</label>
                <div className="flex gap-2 mb-4">
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: duration === d ? '#0f1e3c' : '#f1f5f9', color: duration === d ? 'white' : '#64748b' }}>
                      {d}
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-semibold text-gray-500 mb-2">Frequency</label>
                <div className="flex gap-2 mb-4">
                  {FREQUENCIES.map(f => (
                    <button key={f} onClick={() => setFrequency(f)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: frequency === f ? '#0f1e3c' : '#f1f5f9', color: frequency === f ? 'white' : '#64748b' }}>
                      {f}
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-semibold text-gray-500 mb-2">Days</label>
                <div className="flex flex-wrap gap-2 mb-5">
                  {DAYS.map(d => (
                    <button key={d} onClick={() => toggleDay(d)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                      style={{
                        borderColor: days.includes(d) ? '#0f1e3c' : '#e2e8f0',
                        background: days.includes(d) ? '#0f1e3c' : 'white',
                        color: days.includes(d) ? 'white' : '#64748b',
                      }}>
                      {d}
                    </button>
                  ))}
                </div>

                <button
                  onClick={addSlot}
                  disabled={days.length === 0}
                  className="w-full py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
                >
                  Save Availability
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
