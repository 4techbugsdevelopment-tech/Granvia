import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { passwordError } from '../../lib/formValidation';
import { AdminEmployee, AdminEmployeeRole, AdminEmployeeInput, AdminEmployerOption, listAdminEmployeeRoles, listAdminEmployees, listAdminEmployeeEmployers, saveAdminEmployee, deleteAdminEmployee, employeeWhatsAppLink } from '../../services/adminEmployeeService';
import { Card, PageHeader, Table } from './_adminUi';

const empty: AdminEmployeeInput = { full_name: '', email: '', mobile: '', role_id: '', account_status: 'active', password: '', employer_ids: [] };
export default function AdminEmployees() {
  const [rows, setRows] = useState<AdminEmployee[]>([]);
  const [roles, setRoles] = useState<AdminEmployeeRole[]>([]);
  const [employers, setEmployers] = useState<AdminEmployerOption[]>([]);
  const [employerCompanies, setEmployerCompanies] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<string>();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AdminEmployee | null>(null);
  const [share, setShare] = useState<{ employee: Pick<AdminEmployee, 'full_name' | 'email' | 'mobile' | 'role_name'>; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    const [employees, roleRows, employerOptions] = await Promise.all([listAdminEmployees(), listAdminEmployeeRoles(), listAdminEmployeeEmployers()]);
    setRows(employees); setRoles(roleRows); setEmployers(employerOptions.employers);
    setEmployerCompanies(employerOptions.companies.filter(company => company.accountStatus === 'active').reduce<Record<string, string[]>>((groups, company) => {
      (groups[company.employerUserId] ||= []).push(company.companyName); return groups;
    }, {}));
    setLoading(false);
  };
  useEffect(() => { load().catch(e => { setError(e?.response?.data?.message || 'Unable to load employees.'); setLoading(false); }); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const passwordMessage = passwordError(draft.password, !editing);
    if (passwordMessage) { setError(passwordMessage); return; }
    setBusy(true);
    try {
      await saveAdminEmployee(editing, { ...draft, password: draft.password || undefined });
      const role = roles.find(row => row.id === draft.role_id);
      setOpen(false); setNotice(editing ? 'Employee updated.' : 'Employee created. Login details are ready to share.');
      if (draft.password) setShare({ employee: { ...draft, role_name: role?.name ?? '' }, password: draft.password });
      setDraft(empty); await load();
    } catch (e: any) { setError(e?.response?.data?.message || 'Unable to save employee.'); }
    finally { setBusy(false); }
  };
  const remove = async (row: AdminEmployee) => {
    if (!window.confirm(`Delete ${row.full_name}? Their login and active sessions will be removed.`)) return;
    setBusy(true); setError('');
    try { await deleteAdminEmployee(row.id); await load(); setNotice('Employee deleted.'); }
    catch (e: any) { setError(e?.response?.data?.message || 'Unable to delete employee.'); }
    finally { setBusy(false); }
  };
  const startEdit = (row: AdminEmployee) => { setEditing(row.id); setDraft({ full_name: row.full_name, email: row.email, mobile: row.mobile, role_id: row.role_id, account_status: row.account_status, password: '', employer_ids: row.employer_ids }); setError(''); setOpen(true); };
  const toggleEmployer = (id: string) => setDraft(current => ({ ...current, employer_ids: current.employer_ids.includes(id) ? current.employer_ids.filter(item => item !== id) : [...current.employer_ids, id] }));
  return <div className="p-6 space-y-5">
    <PageHeader title="Super Admin Employees" subtitle="Create web panel accounts and assign your Super Admin roles." action={<button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { setEditing(undefined); setDraft(empty); setError(''); setOpen(true); }}>Add Employee</button>} />
    {notice && <p role="status" className="text-green-700">{notice}</p>}
    {!open && error && <p role="alert" className="text-red-700">{error}</p>}
    <Card className="overflow-x-auto"><Table headers={['Employee', 'Contact', 'Role', 'Status', 'Actions']}>
      {rows.map(row => <tr key={row.id}><td className="p-4 font-semibold">{row.full_name}</td><td className="p-4 text-sm">{row.email}<br />{row.mobile}</td><td className="p-4">{row.role_name}{row.role_status !== 'active' && <p className="text-red-700 text-xs">Role inactive</p>}</td><td className="p-4">{row.account_status}</td><td className="p-4"><div className="flex flex-wrap gap-3 text-sm"><button className="text-blue-700" onClick={() => setView(row)}>View</button><button className="text-blue-700" onClick={() => startEdit(row)}>Edit</button><button className="text-green-700" onClick={() => setShare({ employee: row, password: '' })}>WhatsApp Share</button><button disabled={busy} className="text-red-700" onClick={() => remove(row)}>Delete</button></div></td></tr>)}
      {!rows.length && <tr><td colSpan={5} className="p-8 text-center text-gray-500">{loading ? 'Loading employees...' : 'No Super Admin employees yet.'}</td></tr>}
    </Table></Card>
    {open && createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-3 backdrop-blur-[2px] sm:p-4"><form aria-labelledby="employee-modal-title" aria-modal="true" role="dialog" onSubmit={save} className="mx-auto my-3 grid max-h-[calc(100vh-1.5rem)] w-full max-w-5xl grid-cols-1 gap-x-5 gap-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl md:grid-cols-2 xl:grid-cols-3 sm:my-4 sm:max-h-[calc(100vh-2rem)] sm:p-6">
      <div className="md:col-span-2 xl:col-span-3"><h2 id="employee-modal-title" className="text-xl font-bold text-slate-900">{editing ? 'Edit' : 'Add'} Super Admin Employee</h2><p className="mt-1 text-sm text-slate-500">Enter the employee's login, role, and account details.</p></div>
      {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2 xl:col-span-3">{error}</p>}
      <label className="block">Full name<input required className="form-input mt-1" value={draft.full_name} onChange={e => setDraft({ ...draft, full_name: e.target.value })} /></label>
      <label className="block">Email (login)<input required type="email" className="form-input mt-1" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label>
      <label className="block">Mobile / WhatsApp<input required type="tel" placeholder="10-digit Indian mobile" className="form-input mt-1" value={draft.mobile} onChange={e => setDraft({ ...draft, mobile: e.target.value })} /></label>
      <label className="block">Super Admin role<select required className="form-input mt-1" value={draft.role_id} onChange={e => setDraft({ ...draft, role_id: e.target.value })}><option value="">Select a role</option>{roles.filter(row => row.status === 'active' || row.id === draft.role_id).map(row => <option key={row.id} value={row.id}>{row.name}{row.status !== 'active' ? ' (inactive — select an active role)' : ''}</option>)}</select></label>
      <label className="block">{editing ? 'New password (leave blank to keep current)' : 'Password'}<input type="password" autoComplete="new-password" required={!editing} minLength={6} className="form-input mt-1" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} /><span className="mt-1.5 block text-xs leading-5 text-gray-500">Use at least 6 characters with uppercase, lowercase, a number, and a symbol.</span></label>
      <label className="block">Status<select className="form-input mt-1" value={draft.account_status} onChange={e => setDraft({ ...draft, account_status: e.target.value as AdminEmployee['account_status'] })}>{['active', 'inactive', 'blocked'].map(status => <option key={status} value={status}>{status}</option>)}</select></label>
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-gray-600 md:col-span-2 xl:col-span-3">Modules: {roles.find(row => row.id === draft.role_id)?.permissions.join(', ') || 'None selected'}</p>
      {editing && <fieldset className="space-y-3 border-t border-slate-200 pt-4 md:col-span-2 xl:col-span-3">
        <legend className="font-semibold">Assign employers</legend>
        <p className="text-sm text-gray-500">The employee receives every selected employer's companies, limited to the Company modules enabled in the role above.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {employers.map(employer => <label key={employer.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${draft.employer_ids.includes(employer.id) ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
            <input type="checkbox" className="mt-1 h-4 w-4" checked={draft.employer_ids.includes(employer.id)} onChange={() => toggleEmployer(employer.id)} />
            <span className="min-w-0"><span className="block font-medium">{employer.fullName}</span><span className="block truncate text-xs text-gray-500">{employer.email}</span><span className="mt-1 block text-xs text-gray-600">{employerCompanies[employer.id]?.join(', ') || 'No active company yet'}</span></span>
          </label>)}
        </div>
        {!employers.length && <p className="text-sm text-gray-500">No active employers are available.</p>}
        <p className="text-sm font-medium">{draft.employer_ids.length} employer{draft.employer_ids.length === 1 ? '' : 's'} selected</p>
      </fieldset>}
      {!roles.some(row => row.status === 'active') && <p className="text-amber-700 md:col-span-2 xl:col-span-3">Create an active Super Admin role first.</p>}
      <div className="flex justify-end gap-4 border-t border-slate-200 pt-4 md:col-span-2 xl:col-span-3"><button type="button" disabled={busy} onClick={() => { setOpen(false); setDraft(empty); }}>Cancel</button><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !roles.some(row => row.id === draft.role_id && row.status === 'active')}>{busy ? 'Saving...' : 'Save Employee'}</button></div>
    </form></div>, document.body)}
    {view && <div className="fixed inset-0 z-[70] bg-slate-900/50 p-4 overflow-y-auto"><div className="mx-auto my-8 max-w-lg rounded-2xl bg-white p-6 space-y-3"><h2 className="text-xl font-bold">{view.full_name}</h2><p>{view.email}</p><p>{view.mobile}</p><p>Role: {view.role_name} ({view.role_status})</p><p>Account: {view.account_status}</p><p>Modules: {view.permissions.join(', ') || 'None'}</p><p>Employers: {employers.filter(employer => view.employer_ids.includes(employer.id)).map(employer => employer.fullName).join(', ') || 'None assigned'}</p><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => setView(null)}>Close</button></div></div>}
    {share && <div className="fixed inset-0 z-[80] bg-slate-900/50 p-4 overflow-y-auto"><div className="mx-auto my-8 max-w-lg rounded-2xl bg-white p-6 space-y-4"><h2 className="text-xl font-bold">Share employee login</h2><p>Send {share.employee.full_name} their web login link, email, and role on WhatsApp.</p><p className="text-sm text-gray-500">{share.password ? 'The password you just saved will be included in the message.' : 'The current password cannot be retrieved. Edit the employee to set a new password if you want to share it.'}</p><div className="flex gap-4"><button onClick={() => setShare(null)}>Close</button><a className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" href={employeeWhatsAppLink(share.employee, share.password)} target="_blank" rel="noopener noreferrer" onClick={() => setShare(null)}>Open WhatsApp</a></div></div></div>}
  </div>;
}
