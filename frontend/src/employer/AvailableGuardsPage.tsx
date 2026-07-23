// Employer: browse available guards (SRS 3.2.3) — demo data; discovery API pending
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Star, ShieldCheck, Phone, X, CheckCircle } from 'lucide-react';
import { demoAvailableGuards, DemoAvailableGuard } from '../lib/demoData';

export default function AvailableGuardsPage() {
  const [search, setSearch] = useState('');
  const [maxDistance, setMaxDistance] = useState(15);
  const [selected, setSelected] = useState<DemoAvailableGuard | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const filtered = demoAvailableGuards.filter(g =>
    g.distanceKm <= maxDistance &&
    (g.name.toLowerCase().includes(search.toLowerCase()) ||
     g.skills.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
     g.city.toLowerCase().includes(search.toLowerCase())));

  const requestInterview = (id: string) => {
    setRequested(prev => new Set([...prev, id]));
    setSelected(null);
  };

  return (
    <motion.div className="p-6 max-w-5xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>Available Associates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Browse associates available for hire near your sites</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, skill, city…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'white', border: '1.5px solid #e2e8f0' }} />
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'white', border: '1.5px solid #e2e8f0' }}>
          <MapPin size={14} className="text-blue-500" />
          <input type="range" min={1} max={20} value={maxDistance} onChange={e => setMaxDistance(Number(e.target.value))} className="accent-blue-600" />
          <span className="text-xs font-semibold text-blue-600 w-14">{maxDistance} km</span>
        </div>
      </div>

      {/* Guard cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(g => (
          <motion.div key={g.id} className="rounded-2xl p-5" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}>{g.name.charAt(0)}</div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-gray-900">{g.name}</p>
                    {g.verified && <ShieldCheck size={14} style={{ color: '#166534' }} />}
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} />{g.city} · {g.distanceKm} km · {g.experience}</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#f59e0b' }}><Star size={12} fill="#f59e0b" />{g.rating}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {g.skills.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">{s}</span>)}
            </div>
            <p className="text-xs text-gray-400 mt-2">Languages: {g.languages.join(', ')} · Available {g.availability}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setSelected(g)} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: '#f1f5f9', color: '#0f1e3c' }}>View Profile</button>
              <button onClick={() => requestInterview(g.id)} disabled={requested.has(g.id)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                style={{ background: requested.has(g.id) ? '#166534' : 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
                {requested.has(g.id) ? '✓ Requested' : 'Request Interview'}
              </button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-400 col-span-2 text-center py-10">No associates match your filters.</p>}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <motion.div className="w-full max-w-md rounded-2xl bg-white overflow-hidden" initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white" style={{ background: 'rgba(139,26,26,0.6)' }}>{selected.name.charAt(0)}</div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white flex items-center gap-1.5">{selected.name} {selected.verified && <ShieldCheck size={15} className="text-green-300" />}</h2>
                  <p className="text-blue-200 text-xs">{selected.city} · {selected.distanceKm} km away</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white self-start"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div><div className="text-xs text-gray-400">Experience</div><div className="text-sm font-semibold text-gray-800">{selected.experience}</div></div>
                  <div><div className="text-xs text-gray-400">Rating</div><div className="text-sm font-semibold text-gray-800">{selected.rating} / 5</div></div>
                  <div><div className="text-xs text-gray-400">Availability</div><div className="text-sm font-semibold text-gray-800">{selected.availability}</div></div>
                  <div><div className="text-xs text-gray-400">Languages</div><div className="text-sm font-semibold text-gray-800">{selected.languages.join(', ')}</div></div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Skills</div>
                  <div className="flex flex-wrap gap-1.5">{selected.skills.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">{s}</span>)}</div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: '#f1f5f9', color: '#0f1e3c' }}><Phone size={14} /> Call</button>
                  <button onClick={() => requestInterview(selected.id)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>Request Interview</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
