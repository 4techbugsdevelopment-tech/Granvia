import { useEffect, useState } from 'react';
import { AdminEmployeeModuleOption, AdminEmployeeRole, listAdminEmployeeRoleModules, listAdminEmployeeRoles, saveAdminEmployeeRole, deleteAdminEmployeeRole } from '../../services/adminEmployeeService';
import { Card, PageHeader, Table } from './_adminUi';

const empty = { name: '', description: '', permissions: [] as string[], status: 'active' as 'active' | 'inactive' };
type ApiError = { response?: { data?: { message?: string } } };
const errorMessage = (error: unknown, fallback: string) => (error as ApiError)?.response?.data?.message || fallback;
export default function AdminEmployeeRoles() {
  const [rows, setRows] = useState<AdminEmployeeRole[]>([]);
  const [modules, setModules] = useState<AdminEmployeeModuleOption[]>([]);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<string>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { const [roleRows, moduleRows] = await Promise.all([listAdminEmployeeRoles(), listAdminEmployeeRoleModules()]); setRows(roleRows); setModules(moduleRows); setLoading(false); };
  useEffect(() => { load().catch(e => { setError(e?.response?.data?.message || 'Unable to load roles.'); setLoading(false); }); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const moduleKeys = new Set(modules.map(module => module.key)); await saveAdminEmployeeRole(editing, { ...draft, permissions: draft.permissions.filter(permission => moduleKeys.has(permission)) }); setOpen(false); await load(); setNotice('Role saved. Granvia employees will see and use only the selected modules.'); }
    catch (e: unknown) { setError(errorMessage(e, 'Unable to save role.')); }
    finally { setBusy(false); }
  };
  const remove = async (row: AdminEmployeeRole) => {
    if (!window.confirm(`Delete ${row.name}? Roles assigned to employees must be reassigned first.`)) return;
    setBusy(true); setError('');
    try { await deleteAdminEmployeeRole(row.id); await load(); setNotice('Role deleted.'); }
    catch (e: unknown) { setError(errorMessage(e, 'Unable to delete role.')); }
    finally { setBusy(false); }
  };
  return <div className="p-6 space-y-5">
    <PageHeader title="Granvia Employee Roles" subtitle="Choose every platform and assigned-company module that each employee role can use." action={<button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { setEditing(undefined); setDraft(empty); setError(''); setOpen(true); }}>Add Role</button>} />
    {notice && <p role="status" className="text-green-700">{notice}</p>}
    {!open && error && <p role="alert" className="text-red-700">{error}</p>}
    <Card className="overflow-x-auto"><Table headers={['Role', 'Module access', 'Status', 'Actions']}>
      {rows.map(row => { const moduleKeys = new Set(modules.map(module => module.key)); const selectedPermissions = row.permissions.filter(permission => moduleKeys.has(permission)); return <tr key={row.id}><td className="p-4"><strong>{row.name}</strong><p className="text-sm text-gray-500">{row.description}</p></td><td className="p-4 text-sm">{selectedPermissions.map(permission => modules.find(module => module.key === permission)?.label || permission).join(', ') || 'No modules'}</td><td className="p-4">{row.status}</td><td className="p-4 whitespace-nowrap"><button className="text-blue-700 mr-4" onClick={() => { setEditing(row.id); setDraft({ ...row, permissions: selectedPermissions, description: row.description ?? '' }); setError(''); setOpen(true); }}>Edit</button><button disabled={busy} className="text-red-700" onClick={() => remove(row)}>Delete</button></td></tr>; })}
      {!rows.length && <tr><td colSpan={4} className="p-8 text-center text-gray-500">{loading ? 'Loading roles...' : 'No Granvia employee roles yet.'}</td></tr>}
    </Table></Card>
    {open && <div className="fixed inset-0 z-[70] bg-slate-900/50 overflow-y-auto p-4"><form onSubmit={save} className="mx-auto my-6 max-w-2xl rounded-2xl bg-white p-6 space-y-4">
      <h2 className="text-xl font-bold">{editing ? 'Edit' : 'Add'} Granvia Employee Role</h2>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <label className="block">Role name<input required minLength={2} maxLength={150} className="form-input mt-1" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="block">Description<textarea className="form-input mt-1" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block">Status<select className="form-input mt-1" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as typeof draft.status })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <p className="text-sm text-gray-500">Platform modules operate across Granvia. Company modules operate only within companies assigned to the employee. Wallet, reports, logs and every management master are independently controlled.</p>
      <div className="flex flex-wrap gap-4"><button type="button" className="text-blue-700" onClick={() => setDraft({ ...draft, permissions: modules.map(module => module.key) })}>Select all modules</button><button type="button" onClick={() => setDraft({ ...draft, permissions: [] })}>Clear</button></div>
      {(['platform', 'company'] as const).map(scope => <section key={scope} className="space-y-3"><div><h3 className="font-bold text-slate-900">{scope === 'platform' ? 'Granvia platform modules' : 'Assigned company modules'}</h3><p className="text-xs text-slate-500">{scope === 'platform' ? 'Access applies to the complete Granvia administration area for that module.' : 'Access is restricted to companies selected on the employee account.'}</p></div><div className="grid sm:grid-cols-2 gap-3">{modules.filter(module => module.scope === scope).map(module => <label key={module.key} className="flex items-start gap-3 border rounded-lg p-3"><input className="mt-1" type="checkbox" checked={draft.permissions.includes(module.key)} onChange={e => setDraft({ ...draft, permissions: e.target.checked ? [...draft.permissions, module.key] : draft.permissions.filter(item => item !== module.key) })} /><span><strong className="block">{module.label}</strong><span className="text-xs text-gray-500">{module.description}</span></span></label>)}</div></section>)}
      {!draft.permissions.length && <p className="text-sm text-amber-700">Select at least one module.</p>}
      <div className="flex justify-end gap-4"><button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !draft.permissions.length}>{busy ? 'Saving...' : 'Save Role'}</button></div>
    </form></div>}
  </div>;
}
