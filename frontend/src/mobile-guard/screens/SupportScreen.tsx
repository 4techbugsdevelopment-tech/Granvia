// SupportScreen — guard help centre (demo tickets + FAQ; full messaging API pending)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LifeBuoy, ChevronDown, Plus, X, MessageSquare } from 'lucide-react';
import { demoTickets, demoSupportFaqs, DemoTicket } from '../../lib/demoData';

const STATUS_STYLE: Record<DemoTicket['status'], { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#854d0e', bg: '#fef9c3' },
  in_progress: { label: 'In Progress', color: '#075985', bg: '#e0f2fe' },
  resolved: { label: 'Resolved', color: '#166534', bg: '#dcfce7' },
};

export default function SupportScreen() {
  const [tickets, setTickets] = useState<DemoTicket[]>(demoTickets);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const submit = () => {
    setTickets(prev => [{ id: `TKT-${Math.floor(Math.random() * 900 + 100)}`, subject, status: 'open', lastMessage: message, updated: 'just now' }, ...prev]);
    setSent(true);
    setTimeout(() => { setComposing(false); setSent(false); setSubject(''); setMessage(''); }, 1400);
  };

  return (
    <div className="pb-6">
      <div
        className="px-4 pt-5 pb-6"
        style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)', paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
      >
        <h1 className="text-white font-bold text-xl mb-1">Help & Support</h1>
        <p className="text-blue-200 text-xs">We're here to help</p>
      </div>

      <div className="px-4 mt-4">
        <button
          onClick={() => setComposing(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white mb-5"
          style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
        >
          <Plus size={16} /> New Support Ticket
        </button>

        <h3 className="text-sm font-bold text-gray-700 mb-2">My Tickets</h3>
        <div className="space-y-2 mb-6">
          {tickets.map((t, i) => {
            const s = STATUS_STYLE[t.status];
            return (
              <motion.div key={t.id} className="rounded-2xl p-4" style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">{t.subject}</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 flex items-start gap-1"><MessageSquare size={11} className="mt-0.5 flex-shrink-0" />{t.lastMessage}</p>
                <p className="text-xs text-gray-400 mt-1">{t.id} · {t.updated}</p>
              </motion.div>
            );
          })}
        </div>

        <h3 className="text-sm font-bold text-gray-700 mb-2">FAQs</h3>
        <div className="space-y-2">
          {demoSupportFaqs.map((faq, i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                <span className="text-sm font-medium text-gray-800">{faq.q}</span>
                <motion.span animate={{ rotate: openFaq === i ? 180 : 0 }}><ChevronDown size={16} className="text-gray-400" /></motion.span>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <p className="px-4 pb-4 text-xs text-gray-500 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Compose sheet */}
      <AnimatePresence>
        {composing && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setComposing(false)}
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
                  <h2 className="text-lg font-bold text-gray-900">New Ticket</h2>
                  <button onClick={() => setComposing(false)} className="text-gray-400"><X size={18} /></button>
                </div>
                {sent ? (
                  <div className="py-8 text-center">
                    <LifeBuoy size={40} className="mx-auto mb-2" style={{ color: '#22c55e' }} />
                    <p className="font-bold text-gray-800">Ticket submitted</p>
                    <p className="text-xs text-gray-400 mt-1">Our team will respond soon (demo).</p>
                  </div>
                ) : (
                  <>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Subject</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none mb-3" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Message</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Describe your issue…"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />
                    <button onClick={submit} disabled={!subject || !message}
                      className="w-full mt-4 py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
                      Submit Ticket
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
