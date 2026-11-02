import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Pencil } from 'lucide-react';
import { getErrorMessage } from '../../services/apiErrors';
import { getLwfMaster, saveLwfMaster, type LwfSetting, type LwfStatus } from '../../services/lwfService';
import { Card, PageHeader, Pill, Table } from './_adminUi';

type Draft = { employee_amount: string; employer_amount: string; status: LwfStatus; notes: string };
const EMPTY: Draft = { employee_amount: '', employer_amount: '', status: 'active', notes: '' };

export default function LwfMaster() {
  const [setting, setSetting] = useState<LwfSetting | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { setSetting(await getLwfMaster()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load().catch(cause => setError(getErrorMessage(cause, 'Unable to load the LWF master.'))); }, []);

  const startEditing = () => {
    setDraft(setting ? {
      employee_amount: setting.employee_amount,
      employer_amount: setting.employer_amount,
      status: setting.status,
      notes: setting.notes || '',
    } : EMPTY);
    setError('');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      await saveLwfMaster({ ...draft, notes: draft.notes.trim() || null });
      await load();
      setEditing(false);
      setNotice('Standard LWF rates saved. They apply to every employer without an employer-specific override.');
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to save the LWF master.'));
    } finally { setSaving(false); }
  };

  return <motion.div className="p-4 md:p-6 space-y-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
    <PageHeader title="LWF Master" subtitle="Set the standard Labour Welfare Fund amounts used by every employer unless that employer saves its own override." action={<button onClick={startEditing} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}><Pencil size={16}/>{setting ? 'Edit Standard Rates' : 'Set Standard Rates'}</button>} />
    {notice && <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
    {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <Card className="p-0 overflow-hidden">
      {loading ? <div className="p-10 text-center text-sm text-gray-500">Loading LWF master...</div> : setting ? <Table headers={['Policy', 'Employee LWF', 'Employer LWF', 'Status', 'Updated', 'Action']}>
        <tr>
          <td className="px-4 py-3 font-semibold text-gray-900"><span className="inline-flex items-center gap-2"><Landmark size={17} className="text-slate-400"/>Platform Standard</span></td>
          <td className="px-4 py-3 text-sm">₹{setting.employee_amount}</td>
          <td className="px-4 py-3 text-sm">₹{setting.employer_amount}</td>
          <td className="px-4 py-3"><Pill label={setting.status} tone={setting.status === 'active' ? 'green' : 'gray'}/></td>
          <td className="px-4 py-3 text-sm text-gray-500">{setting.updated_at ? new Date(setting.updated_at).toLocaleString('en-IN') : '--'}</td>
          <td className="px-4 py-3"><button onClick={startEditing} className="table-action">Edit</button></td>
        </tr>
      </Table> : <div className="p-10 text-center"><p className="font-semibold text-gray-800">No standard LWF rates configured</p><p className="mt-1 text-sm text-gray-500">LWF will not be added to salary structures until Super Admin sets the standard.</p></div>}
    </Card>
    {editing && <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 p-3 sm:p-4" onClick={() => setEditing(false)}><div className="mx-auto my-4 max-w-xl rounded-2xl bg-white p-5 sm:p-6" onClick={event => event.stopPropagation()}>
      <h2 className="text-lg font-bold text-gray-900">Standard LWF Rates</h2>
      <p className="mt-1 text-sm text-gray-500">These amounts apply platform-wide. Employer overrides remain isolated to their own account.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <MoneyField label="Employee LWF (monthly)" value={draft.employee_amount} onChange={value => setDraft(current => ({ ...current, employee_amount: value }))}/>
        <MoneyField label="Employer LWF (monthly)" value={draft.employer_amount} onChange={value => setDraft(current => ({ ...current, employer_amount: value }))}/>
        <label><span className="form-label">Status</span><select className="form-input mt-1" value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as LwfStatus }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="sm:col-span-2"><span className="form-label">Notes</span><textarea className="form-input mt-1 min-h-24" value={draft.notes} maxLength={500} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))}/></label>
      </div>
      <div className="mt-6 flex justify-end gap-3"><button onClick={() => setEditing(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold">Cancel</button><button onClick={save} disabled={saving || !draft.employee_amount || !draft.employer_amount} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save Standard'}</button></div>
    </div></div>}
  </motion.div>;
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="form-label">{label}</span><input inputMode="decimal" className="form-input mt-1" value={value} onChange={event => onChange(event.target.value.replace(/[^\d.]/g, ''))}/></label>;
}
