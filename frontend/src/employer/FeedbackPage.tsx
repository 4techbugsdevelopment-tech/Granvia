// Employer feedback (SRS 3.2.7) — submit + history (demo data; feedback API pending)
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquarePlus, CheckCircle } from 'lucide-react';
import { demoFeedback, DemoFeedback } from '../lib/demoData';

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star size={onChange ? 22 : 14} style={{ color: n <= value ? '#f59e0b' : '#e2e8f0' }} fill={n <= value ? '#f59e0b' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackPage() {
  const [items, setItems] = useState<DemoFeedback[]>(demoFeedback);
  const [target, setTarget] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  const submit = () => {
    setItems(prev => [{ id: `FB-${Date.now()}`, target: target || 'Platform / Service', rating, comment, date: new Date().toISOString().slice(0, 10) }, ...prev]);
    setSent(true);
    setTarget(''); setRating(5); setComment('');
    setTimeout(() => setSent(false), 2000);
  };

  return (
    <motion.div className="p-6 max-w-4xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>Feedback</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rate associates or the Granvia service</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Submit form */}
        <div className="rounded-2xl p-6" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><MessageSquarePlus size={16} style={{ color: '#8b1a1a' }} /> Submit Feedback</h2>

          {sent && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 text-green-700 text-sm mb-3">
              <CheckCircle size={15} /> Feedback submitted (demo)
            </div>
          )}

          <label className="block text-xs font-semibold text-gray-500 mb-1">Regarding</label>
          <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Associate name, or leave blank for Platform"
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none mb-3" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />

          <label className="block text-xs font-semibold text-gray-500 mb-2">Rating</label>
          <div className="mb-3"><Stars value={rating} onChange={setRating} /></div>

          <label className="block text-xs font-semibold text-gray-500 mb-1">Comments</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="Share your experience…"
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none mb-4" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />

          <button onClick={submit} disabled={!comment}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
            Submit Feedback
          </button>
        </div>

        {/* History */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-900">Submitted Feedback</h2>
          {items.map(f => (
            <div key={f.id} className="rounded-2xl p-4" style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-gray-900">{f.target}</p>
                <Stars value={f.rating} />
              </div>
              <p className="text-sm text-gray-600">{f.comment}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
