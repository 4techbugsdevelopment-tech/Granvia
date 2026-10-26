import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { AdminEmployee, listAdminEmployees } from '../../services/adminEmployeeService';
import { Card, PageHeader } from './_adminUi';

const DEPARTMENTS: Record<string, string> = { hr: 'Company HR', sales: 'Company Sales', operations: 'Company Operations', accounts: 'Company Accounts' };
type Assignment = { id: string; employeeId: string; companyId: string; department: string; company: { id?: string; companyName: string; employerUserId?: string }; employee?: { user: { fullName: string }; role: { name: string; permissions: string } } };
type Options = { companies: { id: string; companyName: string; employerUserId: string; accountStatus: string }[]; employers: { id: string; fullName: string; email: string }[] };
const button = 'rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50';
export default function CompanyDepartments({ allocation = false }: { allocation?: boolean }) {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [options, setOptions] = useState<Options>({ companies: [], employers: [] });
  const [draft, setDraft] = useState({ employee_id: '', company_id: '', department: 'hr' });
  const [employer, setEmployer] = useState('');
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [data, setData] = useState<any>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const load = async () => {
    const response = await apiClient.get(allocation ? '/company-allocations' : '/managed-companies');
    setRows(response.data);
    if (allocation) {
      const [staff, choices] = await Promise.all([listAdminEmployees(), apiClient.get('/company-allocations/options')]);
      setEmployees(staff); setOptions(choices.data);
    }
  };
  useEffect(() => { setLoading(true); load().catch(e => setError(e?.response?.data?.message || 'Unable to load company assignments.')).finally(() => setLoading(false)); }, [allocation]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e: any) { setError(e?.response?.data?.message || 'Unable to complete the action.'); }
    finally { setBusy(false); }
  };
  const open = async (row: Assignment) => {
    setSelected(row); setData(null); setEdit({});
    const result = await apiClient.get(`/managed-companies/${row.companyId}/${row.department}`);
    setData(result.data);
    const c = result.data.company;
    setEdit(row.department === 'sales' ? { company_email: c.companyEmail || '', company_phone: c.companyPhone || '', website: c.website || '', description: c.description || '' } : { billing_address: c.billingAddress || '' });
  };
  const change = async (resource: string, id: string, body: Record<string, unknown>) => {
    if (!selected) return;
    await apiClient.patch(`/managed-companies/${selected.companyId}/${selected.department}/${resource}/${id}`, body);
    await open(selected); setNotice('Changes saved.');
  };
  const eligible = employees.filter(e => e.account_status === 'active' && e.role_status === 'active' && e.permissions.includes(DEPARTMENTS[draft.department]));
  const names = (id?: string) => options.employers.find(e => e.id === id);
  const visibleRows = rows.filter(row => `${row.company.companyName} ${DEPARTMENTS[row.department]} ${row.employee?.user.fullName || ''} ${row.employee?.role.name || ''} ${names(row.company.employerUserId)?.fullName || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="p-6 space-y-5">
    <PageHeader title={allocation ? 'Company Staff Allocation' : 'My Company Departments'} subtitle={allocation ? 'Assign each company department to your Granvia staff. Repeat to allocate several companies to one employee.' : 'Manage the company departments allocated to you by Granvia.'} />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status" className="text-green-700">{notice}</p>}
    {allocation && <Card className="p-5"><form className="grid md:grid-cols-2 gap-4" onSubmit={e => { e.preventDefault(); run(async () => { await apiClient.post('/company-allocations', draft); await load(); setNotice('Company department allocated. You can select the next company for this employee.'); }); }}>
      <label>Employer<select className="form-input" value={employer} onChange={e => { setEmployer(e.target.value); setDraft({ ...draft, company_id: '' }); }}><option value="">All employers</option>{options.employers.map(e => <option key={e.id} value={e.id}>{e.fullName} — {e.email}</option>)}</select></label>
      <label>Company<select required className="form-input" value={draft.company_id} onChange={e => setDraft({ ...draft, company_id: e.target.value })}><option value="">Select company</option>{options.companies.filter(c => c.accountStatus === 'active' && (!employer || c.employerUserId === employer)).map(c => <option key={c.id} value={c.id}>{c.companyName} — {names(c.employerUserId)?.email}</option>)}</select></label>
      <label>Department<select className="form-input" value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value, employee_id: '' })}>{Object.entries(DEPARTMENTS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Granvia employee<select required className="form-input" value={draft.employee_id} onChange={e => setDraft({ ...draft, employee_id: e.target.value })}><option value="">Select employee</option>{eligible.map(e => <option key={e.id} value={e.id}>{e.full_name} — {e.role_name}</option>)}</select></label>
      <p className="text-sm text-gray-500">Create an active Super Admin role with the matching Company permission first. Several employees may support the same company department.</p>
      <button disabled={busy || loading} className={button}>{busy ? 'Saving...' : 'Allocate Company'}</button>
    </form></Card>}
    <label className="block">Search allocations<input className="form-input mt-1" placeholder="Company, staff, employer or department" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <p className="text-sm text-gray-600">{visibleRows.length} department allocation(s) · {new Set(visibleRows.map(row => row.companyId)).size} companies</p>
    <Card className="p-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{(allocation ? ['Employee / role', 'Employer', 'Company', 'Department', 'Access', 'Action'] : ['Company', 'Department', 'Action']).map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{visibleRows.map(row => {
      let effective = false; try { effective = JSON.parse(row.employee?.role.permissions || '[]').includes(DEPARTMENTS[row.department]); } catch { /* invalid permissions deny access */ }
      return <tr key={row.id} className="border-t">{allocation && <><td className="p-3">{row.employee?.user.fullName}<br />{row.employee?.role.name}</td><td className="p-3">{names(row.company.employerUserId)?.fullName}<br />{names(row.company.employerUserId)?.email}</td></>}<td className="p-3">{row.company.companyName}</td><td className="p-3">{DEPARTMENTS[row.department]}</td>{allocation && <td className="p-3">{effective ? 'Role permits department' : 'Role no longer permits department'}</td>}<td className="p-3">{allocation ? <button disabled={busy} className="text-red-700" onClick={() => { if (window.confirm('Remove this company department assignment?')) run(async () => { await apiClient.delete(`/company-allocations/${row.id}`); await load(); setNotice('Assignment removed.'); }); }}>Remove</button> : <button disabled={busy} className="text-blue-700" onClick={() => run(() => open(row))}>Open department</button>}</td></tr>;
    })}</tbody></table>{!rows.length && <p className="p-4 text-gray-500">{loading ? 'Loading assignments...' : 'No company departments assigned.'}</p>}</Card>
    {!allocation && selected && data && <Card className="p-5 space-y-5">
      <h2 className="text-xl font-bold">{data.company.companyName} — {DEPARTMENTS[selected.department]}</h2>
      {['sales', 'accounts'].includes(selected.department) && <form className="space-y-3 max-w-xl" onSubmit={e => { e.preventDefault(); run(() => change('company', selected.companyId, { ...edit, ...(selected.department === 'sales' && !edit.company_email ? { company_email: null } : {}) })); }}>
        {Object.entries(edit).map(([key, value]) => <label className="block capitalize" key={key}>{key.replace(/_/g, ' ')}<textarea className="form-input" value={value} onChange={e => setEdit({ ...edit, [key]: e.target.value })} /></label>)}
        <button disabled={busy} className={button}>Save {selected.department === 'sales' ? 'company contacts' : 'billing address'}</button>
      </form>}
      {data.jobs && <section><h3 className="font-bold">Jobs</h3>{data.jobs.map((job: any) => <p key={job.id} className="py-2">{job.title} — {job.status}</p>)}</section>}
      {data.applications && <section><h3 className="font-bold">Applicants</h3>{data.applications.map((a: any) => <div className="border-t py-3 flex flex-wrap gap-3 items-center" key={a.id}><span>{a.job.title} · {a.associateName} · {a.status}</span><select disabled={busy} aria-label={`Action for applicant ${a.guardUserId}`} value="" onChange={e => { const status = e.target.value; if (status) run(() => change('applications', a.id, { status })); }}><option value="">Hiring action</option><option value="shortlisted">Shortlist</option><option value="rejected">Reject</option><option value="hired">Send hire proposal</option></select></div>)}</section>}
      {data.sites && <section><h3 className="font-bold">Sites</h3>{data.sites.map((s: any) => <form className="border-t py-3 flex flex-wrap gap-3" key={s.id} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); run(() => change('sites', s.id, { contact_person: form.get('contact_person'), ...(form.get('contact_mobile') ? { contact_mobile: form.get('contact_mobile') } : {}), notes: form.get('notes') })); }}><span>{s.siteName} · {s.status}</span><input aria-label="Site contact name" name="contact_person" placeholder="Contact name" defaultValue={s.contactPerson || ''} /><input aria-label="Site contact mobile" name="contact_mobile" placeholder="Contact mobile" defaultValue={s.contactMobile || ''} /><input aria-label="Site notes" name="notes" placeholder="Notes" defaultValue={s.notes || ''} /><button disabled={busy} className={button}>Save site</button></form>)}</section>}
      {data.attendance && <section><h3 className="font-bold">Attendance</h3>{data.attendance.map((a: any) => <div key={a.id} className="border-t py-3 flex flex-wrap gap-3"><span>{String(a.attendanceDate).slice(0, 10)} · {a.associateName} · {a.totalHours || 0} hours · {a.status}</span>{['approved', 'rejected'].map(status => <button key={status} disabled={busy} className="text-blue-700 capitalize" onClick={() => { if (window.confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this attendance record? Existing settlement rules apply.`)) { const remarks = status === 'rejected' ? window.prompt('Reason for rejection (required):') : undefined; if (status === 'rejected' && !remarks?.trim()) return; run(() => change('attendance', a.id, { status, employer_remarks: remarks })); } }}>{status === 'approved' ? 'Approve' : 'Reject'}</button>)}</div>)}</section>}
      {data.invoices && <section><h3 className="font-bold">Company invoices</h3><p className="text-sm text-gray-500">Employer wallet balances and funds apply across companies and require employer access.</p>{data.invoices.map((i: any) => <p key={i.id} className="py-3 border-t">{i.invoiceNumber || i.id} · ₹{i.totalAmount} · {i.paymentStatus} · {String(i.invoiceDate).slice(0, 10)}</p>)}</section>}
    </Card>}
  </div>;
}
