import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Wallet } from 'lucide-react';
import { PageHeader, StatTile, Table, Pill } from './_adminUi';
import { grantEmployerWalletCredit, listAdminWallets } from '../../services/walletService';
import { getErrorMessage } from '../../services/apiErrors';

const inr = (n: number) => `Rs ${Number(n || 0).toLocaleString('en-IN')}`;
const tone = (s: string) => s === 'completed' ? 'green' : s === 'pending' ? 'amber' : 'red';

export default function WalletPayments() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listAdminWallets>> | null>(null);
  const [selectedEmployerId, setSelectedEmployerId] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await listAdminWallets();
      setData(next);
      setSelectedEmployerId(current => current || next.wallets[0]?.employer_user_id || '');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load wallet data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedWallet = useMemo(
    () => data?.wallets.find(wallet => wallet.employer_user_id === selectedEmployerId),
    [data?.wallets, selectedEmployerId],
  );

  const grantCredit = async () => {
    const value = Number(amount);
    if (!selectedEmployerId || !value || value <= 0) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await grantEmployerWalletCredit(selectedEmployerId, value, remarks.trim() || undefined);
      setAmount('');
      setRemarks('');
      setNotice(`Credit of ${inr(value)} added to ${selectedWallet?.employer?.full_name || 'employer'}.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to grant employer credit.'));
    } finally {
      setBusy(false);
    }
  };

  const totals = data?.totals ?? {
    balance: 0,
    deposit_balance: 0,
    credit_balance: 0,
    total_recharged: 0,
    total_credited: 0,
    total_debited: 0,
  };

  return (
    <motion.div className="p-4 md:p-6 space-y-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Wallet & Payments" subtitle="Employer recharge, Super Admin credit and debit ledger" />
        <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {notice && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="rounded-xl bg-white border border-gray-100 px-4 py-3 text-sm text-gray-500">Loading wallet data...</div>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatTile label="Wallet Balance" value={inr(totals.balance)} color="#0f1e3c" />
        <StatTile label="Deposited" value={inr(totals.deposit_balance)} color="#166534" />
        <StatTile label="Admin Credit" value={inr(totals.credit_balance)} color="#1d4ed8" />
        <StatTile label="Recharged" value={inr(totals.total_recharged)} color="#0f766e" />
        <StatTile label="Debited" value={inr(totals.total_debited)} color="#7c2d12" />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Wallet size={18} style={{ color: '#0f1e3c' }} />
          <h2 className="font-bold text-gray-900">Provide Employer Credit</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_minmax(220px,1fr)_auto]">
          <select value={selectedEmployerId} onChange={event => setSelectedEmployerId(event.target.value)} className="form-input">
            {data?.wallets.map(wallet => (
              <option key={wallet.id} value={wallet.employer_user_id}>
                {wallet.employer?.full_name || wallet.employer?.email || wallet.employer_user_id} - {inr(wallet.balance)}
              </option>
            ))}
          </select>
          <input inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value.replace(/[^\d.]/g, ''))} className="form-input" placeholder="Amount" />
          <input value={remarks} onChange={event => setRemarks(event.target.value)} className="form-input" placeholder="Credit note" />
          <button onClick={grantCredit} disabled={busy || !selectedEmployerId || !Number(amount)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#0f1e3c' }}>
            {busy ? 'Saving...' : 'Add Credit'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-3">Employer Wallets</h2>
        <Table headers={['Employer', 'Balance', 'Deposited', 'Admin Credit', 'Debited', 'Status']}>
          {data?.wallets.map(wallet => (
            <tr key={wallet.id} className="border-b border-gray-50 hover:bg-gray-50/60">
              <td className="px-4 py-3.5">
                <div className="text-sm font-semibold text-gray-900">{wallet.employer?.full_name || '--'}</div>
                <div className="text-xs text-gray-400">{wallet.employer?.email || wallet.employer_user_id}</div>
              </td>
              <td className="px-4 py-3.5 text-sm font-bold text-gray-900">{inr(wallet.balance)}</td>
              <td className="px-4 py-3.5 text-sm text-green-700">{inr(wallet.deposit_balance)}</td>
              <td className="px-4 py-3.5 text-sm text-blue-700">{inr(wallet.credit_balance)}</td>
              <td className="px-4 py-3.5 text-sm text-orange-700">{inr(wallet.total_debited)}</td>
              <td className="px-4 py-3.5"><Pill label={wallet.status} tone={tone(wallet.status) as any} /></td>
            </tr>
          ))}
        </Table>
        {data?.wallets.length === 0 && <div className="py-8 text-center text-sm text-gray-400">No employer wallets found</div>}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-3">Recent Platform Transactions</h2>
        <Table headers={['Txn ID', 'Date', 'Purpose', 'Type', 'Source', 'Amount', 'Balance', 'Status']}>
          {data?.transactions.map(tx => (
            <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/60">
              <td className="px-4 py-3.5 text-xs font-mono font-bold" style={{ color: '#8b1a1a' }}>{String(tx.id).slice(0, 8)}</td>
              <td className="px-4 py-3.5 text-xs text-gray-500">{new Date(tx.posted_at || tx.created_at).toLocaleString('en-IN')}</td>
              <td className="px-4 py-3.5 text-sm text-gray-700">{tx.purpose}</td>
              <td className="px-4 py-3.5">
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: tx.transaction_type === 'credit' ? '#166534' : '#7c2d12' }}>
                  {tx.transaction_type === 'credit' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}{tx.transaction_type}
                </span>
              </td>
              <td className="px-4 py-3.5 text-xs text-gray-500">{sourceLabel(tx.source)}</td>
              <td className="px-4 py-3.5 text-sm font-bold" style={{ color: tx.transaction_type === 'credit' ? '#166534' : '#7c2d12' }}>
                {tx.transaction_type === 'credit' ? '+' : '-'}{inr(Number(tx.amount))}
              </td>
              <td className="px-4 py-3.5 text-sm text-gray-700">{tx.balance_after == null ? '--' : inr(Number(tx.balance_after))}</td>
              <td className="px-4 py-3.5"><Pill label={tx.status} tone={tone(tx.status) as any} /></td>
            </tr>
          ))}
        </Table>
      </div>
    </motion.div>
  );
}

function sourceLabel(source?: string) {
  if (source === 'mock_gateway_recharge') return 'Mock gateway';
  if (source === 'admin_credit') return 'Admin credit';
  if (source === 'job_payment') return 'Job payment';
  return source || '--';
}
