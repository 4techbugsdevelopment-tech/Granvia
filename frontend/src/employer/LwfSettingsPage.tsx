import { useEffect, useState } from 'react';
import { Landmark, RotateCcw, Save } from 'lucide-react';
import { getErrorMessage } from '../services/apiErrors';
import { getEmployerLwfSetting, resetEmployerLwfSetting, saveEmployerLwfSetting, type LwfSetting, type LwfStatus } from '../services/lwfService';

type Draft = { employee_amount: string; employer_amount: string; status: LwfStatus; notes: string };

export default function LwfSettingsPage() {
  const [master, setMaster] = useState<LwfSetting | null>(null);
  const [override, setOverride] = useState<LwfSetting | null>(null);
  const [effective, setEffective] = useState<LwfSetting | null>(null);
  const [draft, setDraft] = useState<Draft>({ employee_amount: '', employer_amount: '', status: 'active', notes: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getEmployerLwfSetting();
      setMaster(data.master); setOverride(data.override); setEffective(data.effective);
      const editable = data.override || data.master;
      setDraft({ employee_amount: editable?.employee_amount || '', employer_amount: editable?.employer_amount || '', status: editable?.status || 'active', notes: data.override?.notes || '' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load().catch(cause => setError(getErrorMessage(cause, 'Unable to load LWF settings.'))); }, []);

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      await saveEmployerLwfSetting({ ...draft, notes: draft.notes.trim() || null });
      await load();
      setNotice('Your employer-specific LWF override is now active. Other employers continue using the Super Admin standard.');
    } catch (cause) { setError(getErrorMessage(cause, 'Unable to save your LWF override.')); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm('Remove your employer override and return to the Super Admin standard LWF rates?')) return;
    setSaving(true); setError(''); setNotice('');
    try { await resetEmployerLwfSetting(); await load(); setNotice('Override removed. The Super Admin standard LWF rates now apply.'); }
    catch (cause) { setError(getErrorMessage(cause, 'Unable to remove your LWF override.')); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading LWF settings...</div>;

  return <div className="p-4 md:p-6 space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">LWF Settings</h1><p className="mt-1 text-sm text-gray-500">The Super Admin standard applies automatically. Saving here creates an override only for your employer account.</p></div>
    {notice && <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
    {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {!master && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Super Admin has not configured the standard LWF rates yet. An employer override cannot be created until the standard exists.</div>}
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2"><Landmark size={19} className="text-slate-500"/><h2 className="font-bold text-gray-900">Currently Applied</h2></div>
        {effective ? <div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Source" value={effective.source === 'employer' ? 'Employer Override' : 'Super Admin Standard'}/><Metric label="Status" value={effective.status}/><Metric label="Employee LWF" value={`₹${effective.employee_amount}`}/><Metric label="Employer LWF" value={`₹${effective.employer_amount}`}/></div> : <p className="mt-4 text-sm text-gray-500">No LWF setting is currently applicable.</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-gray-900">Employer Override</h2><p className="mt-1 text-xs text-gray-500">Changes here affect only your employer account.</p></div>{override && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Override active</span>}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MoneyField label="Employee LWF (monthly)" value={draft.employee_amount} onChange={value => setDraft(current => ({ ...current, employee_amount: value }))}/>
          <MoneyField label="Employer LWF (monthly)" value={draft.employer_amount} onChange={value => setDraft(current => ({ ...current, employer_amount: value }))}/>
          <label><span className="form-label">Status</span><select className="form-input mt-1" value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as LwfStatus }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className="sm:col-span-2"><span className="form-label">Notes</span><textarea className="form-input mt-1 min-h-24" value={draft.notes} maxLength={500} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))}/></label>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">{override && <button onClick={reset} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold"><RotateCcw size={16}/>Use Super Admin Standard</button>}<button onClick={save} disabled={saving || !master || !draft.employee_amount || !draft.employer_amount} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{saving ? 'Saving...' : 'Save Employer Override'}</button></div>
      </section>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 font-bold text-gray-900">{value}</p></div>; }
function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="form-label">{label}</span><input inputMode="decimal" className="form-input mt-1" value={value} onChange={event => onChange(event.target.value.replace(/[^\d.]/g, ''))}/></label>; }
