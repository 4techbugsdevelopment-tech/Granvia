// WalletScreen — guard coin wallet + withdrawal (demo data; wallet API pending)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ArrowUpRight, ArrowDownLeft, Building2, X } from 'lucide-react';
import { demoGuardWallet, demoGuardTransactions } from '../../lib/demoData';

export default function WalletScreen() {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [done, setDone] = useState(false);

  const submitWithdraw = () => {
    setDone(true);
    setTimeout(() => { setWithdrawOpen(false); setDone(false); setAmount(''); }, 1600);
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
        <div className="text-3xl font-bold">{demoGuardWallet.balanceCoins.toLocaleString()} <span className="text-lg font-medium opacity-80">coins</span></div>
        <div className="text-xs text-blue-100 mt-1">≈ ₹{(demoGuardWallet.balanceCoins * demoGuardWallet.coinValueInr).toLocaleString()} · 1 coin = ₹{demoGuardWallet.coinValueInr}</div>
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
          {demoGuardTransactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              className="flex items-center justify-between rounded-2xl p-3.5"
              style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
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
                  <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
              <div className="text-sm font-bold flex-shrink-0" style={{ color: tx.type === 'credit' ? '#166534' : '#7c2d12' }}>
                {tx.type === 'credit' ? '+' : '−'}{tx.amount}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Withdraw sheet */}
      <AnimatePresence>
        {withdrawOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setWithdrawOpen(false)}
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
                  <h2 className="text-lg font-bold text-gray-900">Withdraw</h2>
                  <button onClick={() => setWithdrawOpen(false)} className="text-gray-400"><X size={18} /></button>
                </div>
                {done ? (
                  <div className="py-8 text-center">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="font-bold text-gray-800">Withdrawal requested</p>
                    <p className="text-xs text-gray-400 mt-1">Funds reach your bank in 1–2 business days (demo).</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 rounded-xl p-3 mb-3" style={{ background: '#f8fafc' }}>
                      <Building2 size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-600">Linked bank •••• 4521</span>
                    </div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (coins)</label>
                    <input
                      type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder={`Max ${demoGuardWallet.balanceCoins}`}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc' }}
                    />
                    <button
                      onClick={submitWithdraw}
                      disabled={!amount || Number(amount) <= 0 || Number(amount) > demoGuardWallet.balanceCoins}
                      className="w-full mt-4 py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
                    >
                      Request Withdrawal
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
