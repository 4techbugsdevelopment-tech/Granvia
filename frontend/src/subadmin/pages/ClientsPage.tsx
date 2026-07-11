// Client Management — employers scoped to this branch (live).
import { useEffect, useState } from 'react';
import { getBranchClients, BranchClient } from '../../services/subadminService';
import { PageHeader, Table, Pill } from '../ui';
import { NAVY, BROWN } from '../theme';

export default function ClientsPage() {
  const [clients, setClients] = useState<BranchClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBranchClients().then(setClients).finally(() => setLoading(false)); }, []);

  return (
    <div className="p-6">
      <PageHeader title="My Clients" subtitle="Employers and clients assigned to your branch" />
      {loading ? <div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div> : (
        <Table headers={['Company', 'Contact', 'Sites', 'Jobs', 'Status']}>
          {clients.map(c => (
            <tr key={c.id} className="border-b hover:bg-[#faf8f6]" style={{ borderColor: '#f1ece8' }}>
              <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: NAVY }}>{c.company}</td>
              <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{c.contact}</td>
              <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{c.sites}</td>
              <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{c.jobs}</td>
              <td className="px-4 py-3.5"><Pill label={c.status} /></td>
            </tr>
          ))}
          {clients.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No clients assigned to your branch yet.</td></tr>}
        </Table>
      )}
    </div>
  );
}
