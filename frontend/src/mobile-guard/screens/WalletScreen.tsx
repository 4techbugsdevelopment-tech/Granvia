// WalletScreen — associate earnings, completed-work details, and withdrawal request UI
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ArrowLeft, ArrowUpRight, ArrowDownLeft, Building2, X, Briefcase, MapPin, Clock, Calendar, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { getMyGuardWallet, listMyGuardTransactions } from '../../services/walletService';

export default function WalletScreen() {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState({ balance_coins: 0, balance_inr: 0, coin_value_inr: 1 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyGuardWallet(), listMyGuardTransactions()])
      .then(([balance, rows]) => { setWallet(balance); setTransactions(rows); })
      .catch(cause => setError(cause?.response?.data?.message || cause.message || 'Could not load wallet.'))
      .finally(() => setLoading(false));
  }, []);

  const submitWithdraw = () => {
    setWithdrawOpen(false);
    setAmount('');
  };

  return (
    <div className="pb-6">
      <div
        className="px-4 pt-5 pb-8"
        style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)', paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
      >
        <h1 className="text-white font-bold text-xl mb-1">My Wallet</h1>
        <p className="text-blue-200 text-xs">Coins & withdrawals</p>
      </div>

      {/* Balance card */}
      <motion.div
        className="mx-4 -mt-1 mt-4 rounded-3xl p-5 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 text-blue-100 text-xs mb-1">
          <Wallet size={14} /> Available Balance
        </div>
        <div className="text-3xl font-bold">{wallet.balance_coins.toLocaleString()} <span className="text-lg font-medium opacity-80">coins</span></div>
        <div className="text-xs text-blue-100 mt-1">≈ ₹{wallet.balance_inr.toLocaleString()} · 1 coin = ₹{wallet.coin_value_inr}</div>
        <button
          onClick={() => setWithdrawOpen(true)}
          className="mt-4 w-full py-3 rounded-2xl text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
        >
          Withdraw to Bank
        </button>
      </motion.div>

      <div className="px-4 mt-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Transactions</h3>
        <div className="space-y-2">
          {loading && <div className="py-8 flex justify-center text-gray-400"><Loader2 size={22} className="animate-spin" /></div>}
          {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-xs"><AlertCircle size={14} className="flex-shrink-0" />{error}</div>}
          {!loading && !error && transactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              className="flex items-center justify-between rounded-2xl p-3.5 cursor-pointer mobile-touch-interactive"
              style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedTx(tx)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: tx.type === 'credit' ? '#dcfce7' : '#fee2e2' }}>
                  {tx.type === 'credit'
                    ? <ArrowDownLeft size={16} style={{ color: '#166534' }} />
                    : <ArrowUpRight size={16} style={{ color: '#7c2d12' }} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{tx.purpose}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex items-center flex-shrink-0 ml-2">
                <div className="text-sm font-bold" style={{ color: tx.type === 'credit' ? '#166534' : '#7c2d12' }}>
                  {tx.type === 'credit' ? '+' : '−'}{Number(tx.amount).toLocaleString()}
                </div>
                <ChevronRight size={14} className="text-gray-300 ml-2" />
              </div>
            </motion.div>
          ))}
          {!loading && !error && transactions.length === 0 && <div className="text-center py-10 text-sm text-gray-400">No completed work payments yet.</div>}
        </div>
      </div>

      {/* Completed work / transaction details */}
      <AnimatePresence>
        {selectedTx && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedTx(null)}
          >
            <motion.div
              className="w-full rounded-t-3xl bg-white overflow-y-auto mobile-scroll"
              style={{ maxHeight: '88dvh', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={event => event.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
              <div className="px-5 pt-2 pb-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Transaction Details</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{selectedTx.reference}</p>
                  </div>
                  <button onClick={() => setSelectedTx(null)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"><X size={16} /></button>
                </div>

                <div className="rounded-2xl p-4 mb-4 flex items-center justify-between bg-green-50">
                  <div>
                    <p className="text-xs text-green-700">Completed payment</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{new Date(selectedTx.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <p className="text-2xl font-bold text-green-700">+{Number(selectedTx.amount).toLocaleString()} coins</p>
                </div>

                <section className="rounded-2xl border border-gray-100 p-4 mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Work Performed</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2"><Briefcase size={15} className="text-blue-700 mt-0.5" /><div><p className="text-xs text-gray-400">Job</p><p className="text-sm font-semibold text-gray-800">{selectedTx.job?.title ?? 'Work payout'}</p></div></div>
                    <div className="flex items-start gap-2"><Building2 size={15} className="text-blue-700 mt-0.5" /><div><p className="text-xs text-gray-400">Employer</p><p className="text-sm font-semibold text-gray-800">{selectedTx.job?.company?.company_name ?? '—'}</p></div></div>
                    <div className="flex items-start gap-2"><MapPin size={15} className="text-blue-700 mt-0.5" /><div><p className="text-xs text-gray-400">Work site</p><p className="text-sm font-semibold text-gray-800">{selectedTx.job?.site?.site_name ?? '—'}</p><p className="text-xs text-gray-500">{[selectedTx.job?.site?.address, selectedTx.job?.site?.city, selectedTx.job?.site?.state, selectedTx.job?.site?.pincode].filter(Boolean).join(', ')}</p></div></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-gray-400">Shift</p><p className="text-sm font-bold text-gray-800">{selectedTx.job?.shift_type ?? '—'} · {selectedTx.job?.duty_hours ?? '—'}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-gray-400">Verified work</p><p className="text-sm font-bold text-gray-800">{selectedTx.work_summary?.shift_count ?? 0} shifts · {selectedTx.work_summary?.total_hours ?? 0}h</p></div>
                    </div>
                    {selectedTx.job?.description && <div><p className="text-xs text-gray-400">Work description</p><p className="text-sm text-gray-600 leading-relaxed">{selectedTx.job.description}</p></div>}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Verified Attendance</h3>
                  {selectedTx.work_sessions?.length ? (
                    <div className="space-y-2">
                      {selectedTx.work_sessions.map((session: any) => (
                        <div key={session.id} className="rounded-xl bg-slate-50 p-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-blue-700" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{new Date(session.attendance_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                              <p className="text-xs text-gray-400">{session.in_time ? new Date(session.in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'} – {session.out_time ? new Date(session.out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                            </div>
                          </div>
                          <span className="flex items-center gap-1 text-xs font-bold text-slate-700"><Clock size={12} />{session.total_hours ?? 0}h</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-400 rounded-xl bg-amber-50 p-3">No verified attendance sessions are linked to this job yet.</p>}
                </section>

                <div className="mt-4 text-xs text-gray-400 space-y-1">
                  <p>Payment method: {selectedTx.payment_method ?? '—'}</p>
                  <p>Status: {selectedTx.status}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw sheet */}
      <AnimatePresence>
        {withdrawOpen && (
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
                <button type="button" onClick={() => setWithdrawOpen(false)} className="mb-4 flex items-center gap-2 rounded-xl py-2 text-sm font-semibold text-slate-700">
                  <ArrowLeft size={18} /> Back to Wallet
                </button>
                <h2 className="mb-4 text-lg font-bold text-gray-900">Withdraw</h2>
                <div className="flex items-center gap-2 rounded-xl p-3 mb-3" style={{ background: '#f8fafc' }}>
                  <Building2 size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-600">Linked bank •••• 4521</span>
                </div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (coins)</label>
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder={`Max ${wallet.balance_coins}`}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }}
                />
                <button
                  onClick={submitWithdraw}
                  disabled={!amount || Number(amount) <= 0 || Number(amount) > wallet.balance_coins}
                  className="w-full mt-4 py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
                >
                  Request Withdrawal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
