import { useEffect, useState } from 'react';
import { CheckCircle, Clock3, IndianRupee, LogOut, RefreshCw, XCircle } from 'lucide-react';
import { completeWithdrawal, decideWithdrawal, listFinanceWithdrawals, type WithdrawalRow } from '../services/withdrawalService';
import { signOut } from '../services/authService';

export default function FinanceApp({ onLogout }: { onLogout: () => void }) {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => listFinanceWithdrawals().then(setRows).catch((cause: any) => setError(cause.message));
  useEffect(() => { void load(); }, []);

  const decide = async (row: WithdrawalRow, decision: 'approve' | 'reject') => {
    const reason = window.prompt(decision === 'reject' ? 'Rejection reason (required):' : 'Approval remarks (optional):');
    if (decision === 'reject' && !reason) return;
    setBusy(row.id); setError(null);
    try { await decideWithdrawal(row.id, decision, reason || undefined); await load(); }
    catch (cause: any) { setError(cause.message); }
    finally { setBusy(null); }
  };
  const complete = async (row: WithdrawalRow) => {
    const reference = window.prompt('Enter verified payment-gateway reference:');
    if (!reference) return;
    setBusy(row.id);
    try { await completeWithdrawal(row.id, reference); await load(); }
    catch (cause: any) { setError(cause.message); }
    finally { setBusy(null); }
  };

  const requested = rows.filter(row => row.status === 'requested').length;
  const approved = rows.filter(row => ['approved', 'processing'].includes(row.status)).length;
  const completed = rows.filter(row => row.status === 'completed').length;
  return <div className="min-h-screen bg-slate-100 text-slate-900">
    <header className="bg-[#0f1e3c] px-5 py-4 text-white flex items-center justify-between"><div><h1 className="font-bold text-lg">Finance Workspace</h1><p className="text-xs text-blue-200">Withdrawals and payout reconciliation</p></div><button onClick={() => void signOut().finally(onLogout)} className="flex items-center gap-2 text-sm"><LogOut size={17} /> Logout</button></header>
    <main className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="grid grid-cols-3 gap-3 mb-6">{[[requested,'Requested',<Clock3 size={20}/>],[approved,'Approved',<IndianRupee size={20}/>],[completed,'Completed',<CheckCircle size={20}/>]].map(([value,label,icon]) => <div key={String(label)} className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-[#8b1a1a] mb-2">{icon}</div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-slate-500">{label}</div></div>)}</div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden"><div className="p-4 flex justify-between border-b"><div><h2 className="font-bold">Withdrawal queue</h2><p className="text-xs text-slate-500">Review bank destination and wallet request before deciding.</p></div><button onClick={() => void load()} className="p-2 rounded-lg bg-slate-100"><RefreshCw size={16}/></button></div>
      {error && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Associate</th><th className="p-3">Bank</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="p-3"><div className="font-semibold">{row.associate?.full_name ?? 'Associate'}</div><div className="text-xs text-slate-500">{row.associate?.email}</div></td><td className="p-3"><div>{row.associate?.bank_name ?? '—'}</div><div className="text-xs text-slate-500">{row.associate?.bank_account_number} · {row.associate?.bank_ifsc}</div></td><td className="p-3 font-bold">₹{Number(row.net_amount).toLocaleString('en-IN')}</td><td className="p-3 capitalize">{row.status}</td><td className="p-3"><div className="flex gap-2">{row.status === 'requested' && <><button disabled={busy===row.id} onClick={() => void decide(row,'approve')} className="p-2 rounded-lg bg-green-50 text-green-700" title="Approve"><CheckCircle size={16}/></button><button disabled={busy===row.id} onClick={() => void decide(row,'reject')} className="p-2 rounded-lg bg-red-50 text-red-700" title="Reject"><XCircle size={16}/></button></>}{['approved','processing'].includes(row.status) && <button disabled={busy===row.id} onClick={() => void complete(row)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Record payout</button>}</div></td></tr>)}{!rows.length && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No withdrawal requests.</td></tr>}</tbody></table></div></div>
    </main>
  </div>;
}
