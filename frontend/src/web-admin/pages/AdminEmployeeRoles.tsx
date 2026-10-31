import { useEffect, useState } from 'react';
import { ADMIN_EMPLOYEE_MODULES, AdminEmployeeRole, listAdminEmployeeRoles, saveAdminEmployeeRole, deleteAdminEmployeeRole } from '../../services/adminEmployeeService';
import { Card, PageHeader, Table } from './_adminUi';

const empty = { name: '', description: '', permissions: [] as string[], status: 'active' as 'active' | 'inactive' };
type ApiError = { response?: { data?: { message?: string } } };
const errorMessage = (error: unknown, fallback: string) => (error as ApiError)?.response?.data?.message || fallback;
export default function AdminEmployeeRoles() {
  const [rows, setRows] = useState<AdminEmployeeRole[]>([]);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<string>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setRows(await listAdminEmployeeRoles()); setLoading(false); };
  useEffect(() => { load().catch(e => { setError(e?.response?.data?.message || 'Unable to load roles.'); setLoading(false); }); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await saveAdminEmployeeRole(editing, draft); setOpen(false); await load(); setNotice('Role saved. Employees inherit these module permissions.'); }
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
    <PageHeader title="Super Admin Roles" subtitle="Define the modules your web panel employees can access." action={<button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { setEditing(undefined); setDraft(empty); setError(''); setOpen(true); }}>Add Role</button>} />
    {notice && <p role="status" className="text-green-700">{notice}</p>}
    {!open && error && <p role="alert" className="text-red-700">{error}</p>}
    <Card className="overflow-x-auto"><Table headers={['Role', 'Modules', 'Status', 'Actions']}>
      {rows.map(row => <tr key={row.id}><td className="p-4"><strong>{row.name}</strong><p className="text-sm text-gray-500">{row.description}</p></td><td className="p-4 text-sm">{row.permissions.join(', ') || 'No modules'}</td><td className="p-4">{row.status}</td><td className="p-4 whitespace-nowrap"><button className="text-blue-700 mr-4" onClick={() => { setEditing(row.id); setDraft({ ...row, description: row.description ?? '' }); setError(''); setOpen(true); }}>Edit</button><button disabled={busy} className="text-red-700" onClick={() => remove(row)}>Delete</button></td></tr>)}
      {!rows.length && <tr><td colSpan={4} className="p-8 text-center text-gray-500">{loading ? 'Loading roles...' : 'No Super Admin roles yet.'}</td></tr>}
    </Table></Card>
    {open && <div className="fixed inset-0 z-[70] bg-slate-900/50 overflow-y-auto p-4"><form onSubmit={save} className="mx-auto my-6 max-w-2xl rounded-2xl bg-white p-6 space-y-4">
      <h2 className="text-xl font-bold">{editing ? 'Edit' : 'Add'} Super Admin Role</h2>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <label className="block">Role name<input required minLength={2} maxLength={150} className="form-input mt-1" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="block">Description<textarea className="form-input mt-1" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block">Status<select className="form-input mt-1" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as typeof draft.status })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <p className="text-sm text-gray-500">Customize the role with any combination of permissions. Company HR, Sales, Operations and Accounts apply only to assigned employers and their companies; other modules grant platform-wide access. An inactive role blocks employee access. Employee and role management remain with Super Admin.</p>
      <div className="flex flex-wrap gap-4"><button type="button" className="text-blue-700" onClick={() => setDraft({ ...draft, permissions: [...ADMIN_EMPLOYEE_MODULES] })}>All permissions</button><button type="button" className="text-blue-700" onClick={() => setDraft({ ...draft, permissions: ADMIN_EMPLOYEE_MODULES.filter(item => item.startsWith('Company ')) })}>All company departments</button><button type="button" className="text-blue-700" onClick={() => setDraft({ ...draft, permissions: ADMIN_EMPLOYEE_MODULES.filter(item => !item.startsWith('Company ')) })}>All platform modules</button><button type="button" onClick={() => setDraft({ ...draft, permissions: [] })}>Clear</button></div>
      <div className="grid sm:grid-cols-2 gap-3">{ADMIN_EMPLOYEE_MODULES.map(module => <label key={module} className="flex items-center gap-2 border rounded-lg p-3"><input type="checkbox" checked={draft.permissions.includes(module)} onChange={e => setDraft({ ...draft, permissions: e.target.checked ? [...draft.permissions, module] : draft.permissions.filter(item => item !== module) })} />{module}</label>)}</div>
      <div className="flex justify-end gap-4"><button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>{busy ? 'Saving...' : 'Save Role'}</button></div>
    </form></div>}
  </div>;
}
