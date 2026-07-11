// Service Partner (Manpower) Management — partners scoped to this branch (live).
import { useEffect, useState } from 'react';
import { getBranchGuards, BranchGuard } from '../../services/subadminService';
import { PageHeader, Table, Pill } from '../ui';
import { NAVY, BROWN } from '../theme';

export default function GuardsPage() {
  const [guards, setGuards] = useState<BranchGuard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBranchGuards().then(setGuards).finally(() => setLoading(false)); }, []);

  return (
    <div className="p-6">
      <PageHeader title="Service Partners" subtitle="Manpower deployed under your branch" />
      {loading ? <div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div> : (
        <Table headers={['Name', 'City', 'Experience', 'Verification', 'Account']}>
          {guards.map(g => (
            <tr key={g.id} className="border-b hover:bg-[#faf8f6]" style={{ borderColor: '#f1ece8' }}>
              <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: NAVY }}>{g.name}</td>
              <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{g.city ?? '—'}</td>
              <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{g.experience ?? '—'}</td>
              <td className="px-4 py-3.5"><Pill label={g.status} /></td>
              <td className="px-4 py-3.5"><Pill label={g.account_status} /></td>
            </tr>
          ))}
          {guards.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No service partners assigned to your branch yet.</td></tr>}
        </Table>
      )}
    </div>
  );
}
