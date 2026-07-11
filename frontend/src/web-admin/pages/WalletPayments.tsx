// Admin wallet & payments overview (demo data; payment gateway pending client)
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { PageHeader, StatTile, Table, Pill } from './_adminUi';
import { demoPlatformPayments, demoPlatformTransactions } from '../../lib/demoData';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const tone = (s: string) => s === 'completed' ? 'green' : s === 'pending' ? 'amber' : 'red';

export default function WalletPayments() {
  return (
    <motion.div className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader title="Wallet & Payments" subtitle="Platform coin ledger, payouts and commission" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total Collected" value={inr(demoPlatformPayments.totalCollectedInr)} color="#0f1e3c" />
        <StatTile label="Paid to Guards" value={inr(demoPlatformPayments.paidToGuardsInr)} color="#166534" />
        <StatTile label="Commission Earned" value={inr(demoPlatformPayments.commissionInr)} color="#5b21b6" />
        <StatTile label="Pending Settlement" value={inr(demoPlatformPayments.pendingSettlementInr)} color="#854d0e" />
      </div>

      <h2 className="font-bold text-gray-900 mb-3">Recent Platform Transactions</h2>
      <Table headers={['Txn ID', 'Date', 'Purpose', 'Type', 'Amount', 'Status']}>
        {demoPlatformTransactions.map(tx => (
          <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/60">
            <td className="px-4 py-3.5 text-xs font-mono font-bold" style={{ color: '#8b1a1a' }}>{tx.id}</td>
            <td className="px-4 py-3.5 text-xs text-gray-500">{new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
            <td className="px-4 py-3.5 text-sm text-gray-700">{tx.purpose}</td>
            <td className="px-4 py-3.5">
              <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: tx.type === 'credit' ? '#166534' : '#7c2d12' }}>
                {tx.type === 'credit' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}{tx.type}
              </span>
            </td>
            <td className="px-4 py-3.5 text-sm font-bold" style={{ color: tx.type === 'credit' ? '#166534' : '#7c2d12' }}>
              {tx.type === 'credit' ? '+' : '−'}{inr(tx.amount)}
            </td>
            <td className="px-4 py-3.5"><Pill label={tx.status} tone={tone(tx.status) as any} /></td>
          </tr>
        ))}
      </Table>
    </motion.div>
  );
}
