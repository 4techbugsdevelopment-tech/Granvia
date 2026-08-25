// SupportScreen — guard help centre (live tickets: /me/support-tickets)
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, LifeBuoy, ChevronDown, Plus, MessageSquare, Loader2 } from 'lucide-react';
import { listMySupportTickets, createSupportTicket } from '../../services/supportService';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

interface TicketItem {
  id: string;        // ticket number (display)
  subject: string;
  status: TicketStatus;
  lastMessage: string;
  updated: string;
}

const SUPPORT_FAQS: { q: string; a: string }[] = [
  { q: 'When is attendance verified?', a: 'Employers verify your in/out times at end of day. Verified shifts are paid out to your wallet.' },
  { q: 'How does radius job search work?', a: 'Set your residential location and radius in Profile. Jobs within range appear in Find Jobs.' },
  { q: 'How do I get my documents verified?', a: 'Upload your ID and police verification in Profile. An admin reviews and approves them, usually within 24–48 hours.' },
];

const STATUS_STYLE: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#854d0e', bg: '#fef9c3' },
  in_progress: { label: 'In Progress', color: '#075985', bg: '#e0f2fe' },
  resolved: { label: 'Resolved', color: '#166534', bg: '#dcfce7' },
  closed: { label: 'Closed', color: '#475569', bg: '#e2e8f0' },
};

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

function mapTicket(t: any): TicketItem {
  const msgs = t.support_ticket_messages ?? t.messages ?? [];
  const last = msgs.length ? msgs[msgs.length - 1] : null;
  const status = (['open', 'in_progress', 'resolved', 'closed'].includes(t.status) ? t.status : 'open') as TicketStatus;
  return {
    id: t.ticket_number ?? t.id,
    subject: t.subject ?? 'Support ticket',
    status,
    lastMessage: last?.message ?? t.description ?? '',
    updated: relativeTime(t.updated_at ?? t.created_at),
  };
}

export default function SupportScreen() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listMySupportTickets()
      .then((data) => { if (active) setTickets((data ?? []).map(mapTicket)); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    if (!subject || !message || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createSupportTicket({ subject, message });
      setTickets((prev) => [mapTicket(created), ...prev]);
      setComposing(false);
      setSubject('');
      setMessage('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSubmitting(false);
    }
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
          {loading && (
            <div className="text-center py-8 text-gray-400">
              <Loader2 size={24} className="mx-auto mb-2 animate-spin opacity-60" />
              <p className="text-xs">Loading tickets…</p>
            </div>
          )}

          {!loading && tickets.map((t, i) => {
            const s = STATUS_STYLE[t.status];
            return (
              <motion.div key={t.id} className="rounded-2xl p-4" style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">{t.subject}</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 flex items-start gap-1"><MessageSquare size={11} className="mt-0.5 flex-shrink-0" />{t.lastMessage}</p>
                <p className="text-xs text-gray-400 mt-1">{t.id}{t.updated ? ` · ${t.updated}` : ''}</p>
              </motion.div>
            );
          })}

          {!loading && tickets.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <LifeBuoy size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">No tickets yet</p>
            </div>
          )}
        </div>

        <h3 className="text-sm font-bold text-gray-700 mb-2">FAQs</h3>
        <div className="space-y-2">
          {SUPPORT_FAQS.map((faq, i) => (
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
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 mobile-scroll"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="mx-auto min-h-full w-full max-w-lg bg-white"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)', paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="px-5 pt-2 pb-4">
                <button type="button" onClick={() => setComposing(false)} className="mb-4 flex items-center gap-2 rounded-xl py-2 text-sm font-semibold text-slate-700">
                  <ArrowLeft size={18} /> Back to Tickets
                </button>
                <h2 className="mb-4 text-lg font-bold text-gray-900">New Ticket</h2>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Subject</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none mb-3" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Message</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Describe your issue…"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />
                    {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                    <button onClick={submit} disabled={!subject || !message || submitting}
                      className="w-full mt-4 py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
                      {submitting && <Loader2 size={15} className="animate-spin" />}
                      {submitting ? 'Submitting…' : 'Submit Ticket'}
                    </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
