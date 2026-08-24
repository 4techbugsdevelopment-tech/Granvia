// Employer: in-cash payment with guard OTP confirmation (SRS 3.2.5) — demo; OTP API pending
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Banknote, X, CheckCircle, ShieldCheck } from 'lucide-react';
import { demoCashPayments, demoAvailableGuards, DemoCashPayment } from '../lib/demoData';
import { useAppLayout } from '../subadmin/ui';

export default function CashPaymentPage() {
  const layout = useAppLayout();
  const [payments, setPayments] = useState<DemoCashPayment[]>(demoCashPayments);
  const [paying, setPaying] = useState(false);
  const [guard, setGuard] = useState(demoAvailableGuards[0].name);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [otp, setOtp] = useState('');

  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const confirm = () => {
    setPayments(prev => [{ id: `CP-${Date.now()}`, guard, site: 'Reliance Mall', amount: Number(amount), date: new Date().toISOString().slice(0, 10), status: 'confirmed' }, ...prev]);
    setStep('done');
  };
  const reset = () => { setPaying(false); setStep('form'); setAmount(''); setOtp(''); };

  return (
    <motion.div className="p-4 md:p-6 max-w-4xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>Cash Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pay associates in cash with OTP confirmation</p>
        </div>
        <button onClick={() => setPaying(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
          <Banknote size={15} /> New Cash Payment
        </button>
      </div>

      <div className={layout === 'mobile' ? 'space-y-3' : 'hidden'}>
        {payments.map(p => (
          <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{p.guard}</p><p className="text-xs text-gray-500">{p.site}</p></div><p className="font-bold text-green-700">{inr(p.amount)}</p></div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3"><p className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p><span className="flex w-fit items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700"><ShieldCheck size={12} /> OTP Confirmed</span></div>
          </div>
        ))}
      </div>

      <div className={layout === 'mobile' ? 'hidden' : 'rounded-2xl overflow-hidden'} style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div>
          <table className="w-full">
            <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>{['Associate', 'Site', 'Amount', 'Date', 'Status'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">{p.guard}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{p.site}</td>
                  <td className="px-4 py-3.5 text-sm font-bold" style={{ color: '#166534' }}>{inr(p.amount)}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">{new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit" style={{ color: '#166534', background: '#dcfce7' }}>
                      <ShieldCheck size={12} /> OTP Confirmed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {paying && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={reset}>
            <motion.div className="w-full max-w-md rounded-2xl bg-white p-6" initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Cash Payment</h2><button onClick={reset} className="text-gray-400"><X size={18} /></button></div>

              {step === 'form' && (
                <>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Associate</label>
                  <select value={guard} onChange={e => setGuard(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none mb-3" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }}>
                    {demoAvailableGuards.map(g => <option key={g.id}>{g.name}</option>)}
                  </select>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (₹)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 960"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none mb-4" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />
                  <button onClick={() => setStep('otp')} disabled={!amount || Number(amount) <= 0}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
                    Send OTP to Associate
                  </button>
                </>
              )}

              {step === 'otp' && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">OTP sent to <span className="font-semibold">{guard}</span></p>
                  <p className="text-xs text-gray-400 mb-4">Ask the associate for the code to confirm they received {inr(Number(amount))} <span className="font-mono font-bold text-blue-600">(demo: 123456)</span></p>
                  <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP"
                    className="w-48 px-3.5 py-2.5 rounded-xl text-sm outline-none text-center mx-auto block mb-4" style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }} />
                  <button onClick={confirm} disabled={otp.length !== 6}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
                    Confirm Payment
                  </button>
                </div>
              )}

              {step === 'done' && (
                <div className="text-center py-6">
                  <CheckCircle size={44} className="mx-auto mb-3" style={{ color: '#22c55e' }} />
                  <p className="font-bold text-gray-800">Payment confirmed</p>
                  <p className="text-xs text-gray-400 mt-1">{guard} confirmed receipt of {inr(Number(amount))} via OTP (demo).</p>
                  <button onClick={reset} className="mt-4 text-sm font-semibold text-blue-600">Done</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
