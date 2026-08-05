// Client Management — employers scoped to this branch (live).
import { useEffect, useState } from 'react';
import { getBranchClients, BranchClient } from '../../services/subadminService';
import { Page, PageHeader, DataTable, Pill, DataColumn } from '../ui';

const COLUMNS: DataColumn<BranchClient>[] = [
  { header: 'Company', primary: true, cell: c => c.company },
  { header: 'Contact', cell: c => c.contact },
  { header: 'Sites', cell: c => c.sites },
  { header: 'Jobs', cell: c => c.jobs },
  { header: 'Status', cell: c => <Pill label={c.status} /> },
];

export default function ClientsPage() {
  const [clients, setClients] = useState<BranchClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBranchClients().then(setClients).finally(() => setLoading(false)); }, []);

  return (
    <Page>
      <PageHeader title="My Clients" subtitle="Employers and clients assigned to your branch" />
      {loading ? <div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div> : (
        <DataTable columns={COLUMNS} rows={clients} rowKey={c => c.id} empty="No clients assigned to your branch yet." />
      )}
    </Page>
  );
}
