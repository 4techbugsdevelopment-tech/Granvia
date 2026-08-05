// Service Partner (Manpower) Management — partners scoped to this branch (live).
import { useEffect, useState } from 'react';
import { getBranchGuards, BranchGuard } from '../../services/subadminService';
import { Page, PageHeader, DataTable, Pill, DataColumn } from '../ui';

const COLUMNS: DataColumn<BranchGuard>[] = [
  { header: 'Name', primary: true, cell: g => g.name },
  { header: 'City', cell: g => g.city ?? '—' },
  { header: 'Experience', cell: g => g.experience ?? '—' },
  { header: 'Verification', cell: g => <Pill label={g.status} /> },
  { header: 'Account', cell: g => <Pill label={g.account_status} /> },
];

export default function GuardsPage() {
  const [guards, setGuards] = useState<BranchGuard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBranchGuards().then(setGuards).finally(() => setLoading(false)); }, []);

  return (
    <Page>
      <PageHeader title="Associates" subtitle="Manpower deployed under your branch" />
      {loading ? <div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div> : (
        <DataTable columns={COLUMNS} rows={guards} rowKey={g => g.id} empty="No associates assigned to your branch yet." />
      )}
    </Page>
  );
}
