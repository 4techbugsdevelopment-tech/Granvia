import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { AdminEmployee, listAdminEmployees } from '../../services/adminEmployeeService';
import { Card, PageHeader } from './_adminUi';
import { ManagedJobs, ManagedSites } from './ManagedCompanyCrud';
import ManagedCompanyProfile from './ManagedCompanyProfile';
import ManagedCompanyBilling from './ManagedCompanyBilling';

const DEPARTMENTS: Record<string, string> = { hr: 'Company HR', sales: 'Company Sales', operations: 'Company Operations', accounts: 'Company Accounts' };
const DEPARTMENT_MODULES: Record<string, string[]> = {
  hr: ['company.jobs', 'company.associates'], sales: ['company.profile'], operations: ['company.sites', 'company.attendance'], accounts: ['company.billing', 'company.invoices'],
};
type Assignment = { id: string; employeeId: string; companyId: string; department: string; company: { id?: string; companyName: string; employerUserId?: string }; employee?: { user: { fullName: string }; role: { name: string; permissions: string } } };
type Options = { companies: { id: string; companyName: string; employerUserId: string; accountStatus: string }[]; employers: { id: string; fullName: string; email: string }[] };
const button = 'rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50';
const COMPANY_STORAGE_KEY = 'granvia_managed_company_id';
export type ManagedCompanyView = 'profile' | 'jobs' | 'associates' | 'sites' | 'attendance' | 'billing' | 'invoices';
const VIEW_CONFIG: Record<ManagedCompanyView, { department: string; permission: string; title: string; subtitle: string }> = {
  profile: { department: 'sales', permission: 'company.profile', title: 'Company Profile', subtitle: 'View and edit the company currently selected in the top bar.' },
  jobs: { department: 'hr', permission: 'company.jobs', title: 'Manage Jobs', subtitle: 'View jobs belonging to the selected assigned company.' },
  associates: { department: 'hr', permission: 'company.associates', title: 'Hired / Current Associates', subtitle: 'Review applicants and complete the allowed hiring actions for the selected company.' },
  sites: { department: 'operations', permission: 'company.sites', title: 'Manage Sites', subtitle: 'View sites and maintain operational contact details for the selected company.' },
  attendance: { department: 'operations', permission: 'company.attendance', title: 'Attendance Verification', subtitle: 'Review completed attendance for the selected company.' },
  billing: { department: 'accounts', permission: 'company.billing', title: 'Billing Details', subtitle: 'Edit billing and tax details for the company selected in the top bar.' },
  invoices: { department: 'accounts', permission: 'company.invoices', title: 'Invoices / Receipts', subtitle: 'View company-linked invoices without employer-wide wallet access.' },
};
export default function CompanyDepartments({ allocation = false, employeePortal = false, view }: { allocation?: boolean; employeePortal?: boolean; view?: ManagedCompanyView }) {
  const requiredDepartment = view ? VIEW_CONFIG[view].department : null;
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
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => sessionStorage.getItem(COMPANY_STORAGE_KEY) || '');
  useEffect(() => {
    const change = (event: Event) => setSelectedCompanyId((event as CustomEvent<string>).detail || '');
    window.addEventListener('granvia-company-change', change);
    return () => window.removeEventListener('granvia-company-change', change);
  }, []);
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
  const open = async (row: Assignment, preserveData = false) => {
    setSelected(row); if (!preserveData) setData(null); setEdit({});
    const result = await apiClient.get(`/managed-companies/${row.companyId}/${row.department}`, { params: view ? { module: VIEW_CONFIG[view].permission } : undefined });
    setData(result.data);
    const c = result.data.company;
    setEdit(row.department === 'sales' ? {
      company_name: c.companyName || '', business_type: c.businessType || '', registration_type: c.registrationType || '', gst_number: c.gstNumber || '',
      pan_number: c.panNumber || '', company_email: c.companyEmail || '', company_phone: c.companyPhone || '', website: c.website || '', description: c.description || '',
      registered_address: c.registeredAddress || '', city: c.city || '', state: c.state || '', pincode: c.pincode || '',
    } : { billing_address: c.billingAddress || '', gst_number: c.gstNumber || '' });
  };
  const managedCompanies = useMemo(() => [...new Map(rows.map(row => [row.companyId, row.company])).entries()].map(([id, company]) => ({ id, ...company })), [rows]);
  const companyRows = rows.filter(row => row.companyId === selectedCompanyId);
  useEffect(() => {
    if (allocation || loading) return;
    const next = managedCompanies.some(company => company.id === selectedCompanyId) ? selectedCompanyId : managedCompanies[0]?.id || '';
    if (next !== selectedCompanyId) setSelectedCompanyId(next);
    if (next) sessionStorage.setItem(COMPANY_STORAGE_KEY, next); else sessionStorage.removeItem(COMPANY_STORAGE_KEY);
  }, [allocation, loading, managedCompanies, selectedCompanyId]);
  useEffect(() => {
    if (allocation || loading || !selectedCompanyId || !companyRows.length) return;
    const next = requiredDepartment
      ? companyRows.find(row => row.department === requiredDepartment)
      : companyRows.find(row => row.department === selected?.department) ?? companyRows[0];
    if (!next) { setSelected(null); setData(null); return; }
    if (selected?.companyId === next.companyId && selected.department === next.department && data) return;
    open(next).catch(e => setError(e?.response?.data?.message || 'Unable to open the selected company.'));
  }, [allocation, loading, selectedCompanyId, rows, requiredDepartment, selected?.department, selected?.companyId, data]);
  const change = async (resource: string, id: string, body: Record<string, unknown>) => {
    if (!selected) return;
    await apiClient.patch(`/managed-companies/${selected.companyId}/${selected.department}/${resource}/${id}`, body);
    await open(selected); setNotice('Changes saved.');
  };
  const eligible = employees.filter(e => e.account_status === 'active' && e.role_status === 'active' && (DEPARTMENT_MODULES[draft.department] || []).some(permission => e.permissions.includes(permission) || e.permissions.includes(DEPARTMENTS[draft.department])));
  const names = (id?: string) => options.employers.find(e => e.id === id);
  const visibleRows = rows.filter(row => `${row.company.companyName} ${DEPARTMENTS[row.department]} ${row.employee?.user.fullName || ''} ${row.employee?.role.name || ''} ${names(row.company.employerUserId)?.fullName || ''}`.toLowerCase().includes(search.toLowerCase()));
  const viewConfig = view ? VIEW_CONFIG[view] : null;
  return <div className="p-6 space-y-5">
    <PageHeader title={allocation ? 'Company Staff Allocation' : viewConfig?.title || (employeePortal ? 'My Company Workspace' : 'Assigned Company Workspace')} subtitle={allocation ? 'Assign each company department to your Granvia staff. Repeat to allocate several companies to one employee.' : viewConfig?.subtitle || (employeePortal ? 'Work only in your assigned company using the departments allowed by your role.' : 'Work only inside companies and menus allowed by your Granvia role.')} />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status" className="text-green-700">{notice}</p>}
    {allocation && <Card className="p-5"><form className="grid md:grid-cols-2 gap-4" onSubmit={e => { e.preventDefault(); run(async () => { await apiClient.post('/company-allocations', draft); await load(); setNotice('Company department allocated. You can select the next company for this employee.'); }); }}>
      <label>Employer<select className="form-input" value={employer} onChange={e => { setEmployer(e.target.value); setDraft({ ...draft, company_id: '' }); }}><option value="">All employers</option>{options.employers.map(e => <option key={e.id} value={e.id}>{e.fullName} — {e.email}</option>)}</select></label>
      <label>Company<select required className="form-input" value={draft.company_id} onChange={e => setDraft({ ...draft, company_id: e.target.value })}><option value="">Select company</option>{options.companies.filter(c => c.accountStatus === 'active' && (!employer || c.employerUserId === employer)).map(c => <option key={c.id} value={c.id}>{c.companyName} — {names(c.employerUserId)?.email}</option>)}</select></label>
      <label>Department<select className="form-input" value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value, employee_id: '' })}>{Object.entries(DEPARTMENTS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Granvia employee<select required className="form-input" value={draft.employee_id} onChange={e => setDraft({ ...draft, employee_id: e.target.value })}><option value="">Select employee</option>{eligible.map(e => <option key={e.id} value={e.id}>{e.full_name} — {e.role_name}</option>)}</select></label>
      <p className="text-sm text-gray-500">Create an active Granvia Employee Role with the matching company work permission first. Several employees may support the same company department.</p>
      <button disabled={busy || loading} className={button}>{busy ? 'Saving...' : 'Allocate Company'}</button>
    </form></Card>}
    {allocation && <><label className="block">Search allocations<input className="form-input mt-1" placeholder="Company, staff, employer or department" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <p className="text-sm text-gray-600">{visibleRows.length} department allocation(s) · {new Set(visibleRows.map(row => row.companyId)).size} companies</p>
    <Card className="p-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Employee / role', 'Employer', 'Company', 'Department', 'Access', 'Action'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{visibleRows.map(row => {
      let effective = false; try { effective = JSON.parse(row.employee?.role.permissions || '[]').includes(DEPARTMENTS[row.department]); } catch { /* invalid permissions deny access */ }
      return <tr key={row.id} className="border-t"><td className="p-3">{row.employee?.user.fullName}<br />{row.employee?.role.name}</td><td className="p-3">{names(row.company.employerUserId)?.fullName}<br />{names(row.company.employerUserId)?.email}</td><td className="p-3">{row.company.companyName}</td><td className="p-3">{DEPARTMENTS[row.department]}</td><td className="p-3">{effective ? 'Role permits department' : 'Role no longer permits department'}</td><td className="p-3"><button disabled={busy} className="text-red-700" onClick={() => { if (window.confirm('Remove this company department assignment?')) run(async () => { await apiClient.delete(`/company-allocations/${row.id}`); await load(); setNotice('Assignment removed.'); }); }}>Remove</button></td></tr>;
    })}</tbody></table>{!rows.length && <p className="p-4 text-gray-500">{loading ? 'Loading assignments...' : 'No company departments assigned.'}</p>}</Card></>}
    {!allocation && (employeePortal || (!view && !!companyRows.length) || (!loading && !rows.length)) && <Card className="p-5 space-y-4">
      {employeePortal && <div className="grid gap-4 md:grid-cols-[minmax(240px,420px)_1fr] md:items-end">
        <label className="block"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Working Company</span><select className="form-input mt-1" value={selectedCompanyId} disabled={employeePortal || managedCompanies.length <= 1} onChange={e => { setSelectedCompanyId(e.target.value); sessionStorage.setItem(COMPANY_STORAGE_KEY, e.target.value); setSelected(null); setData(null); }}><option value="">Select company</option>{managedCompanies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}</select></label>
        <p className="text-sm text-slate-600">{managedCompanies.length ? `${managedCompanies.length} assigned compan${managedCompanies.length === 1 ? 'y' : 'ies'}. Changing this selection changes the active company context; the server checks every request again.` : 'No active company is assigned to this account.'}</p>
      </div>}
      {!view && !!companyRows.length && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Allowed Departments</p><div className="flex flex-wrap gap-2">{companyRows.map(row => <button key={row.id} disabled={busy} onClick={() => run(() => open(row))} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${selected?.department === row.department ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{DEPARTMENTS[row.department]}</button>)}</div></div>}
      {!loading && !rows.length && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">No company department is available. Contact the Super Admin or Employer to check your role, company assignment and account status.</p>}
    </Card>}
    {!allocation && selected && data && view === 'profile' && <ManagedCompanyProfile companyId={selected.companyId} values={edit} saving={busy} onChange={setEdit} onSave={() => run(() => change('company', selected.companyId, { ...edit, ...(!edit.company_email ? { company_email: null } : {}) }))} />}
    {!allocation && selected && data && view === 'billing' && <ManagedCompanyBilling companyId={selected.companyId} companyName={data.company.companyName} invoiceCount={data.invoices?.length || 0} values={edit} saving={busy} onChange={setEdit} onSave={() => run(() => change('company', selected.companyId, { ...edit, ...(!edit.billing_address ? { billing_address: null } : {}), ...(!edit.gst_number ? { gst_number: null } : {}) }))} />}
    {!allocation && selected && data && view !== 'profile' && view !== 'billing' && <Card className="p-5 space-y-5">
      <h2 className="text-xl font-bold">{data.company.companyName} — {viewConfig?.title || DEPARTMENTS[selected.department]}</h2>
      {!view && ['sales', 'accounts'].includes(selected.department) && <form className="space-y-3 max-w-xl" onSubmit={e => { e.preventDefault(); run(() => change('company', selected.companyId, { ...edit, ...(selected.department === 'sales' && !edit.company_email ? { company_email: null } : {}) })); }}>
        {Object.entries(edit).map(([key, value]) => <label className="block capitalize" key={key}>{key.replace(/_/g, ' ')}<textarea className="form-input" value={value} onChange={e => setEdit({ ...edit, [key]: e.target.value })} /></label>)}
        <button disabled={busy} className={button}>Save {selected.department === 'sales' ? 'company contacts' : 'billing address'}</button>
      </form>}
      {(!view || view === 'jobs') && data.jobs && <ManagedJobs companyId={selected.companyId} jobs={data.jobs} sites={data.sites || []} associateTypes={data.associateTypes || []} onReload={() => open(selected, true)} />}
      {(!view || view === 'associates') && data.applications && <section><h3 className="font-bold">Applicants and associates</h3>{data.applications.map((a: any) => <div className="border-t py-3 flex flex-wrap gap-3 items-center" key={a.id}><span>{a.job.title} · {a.associateName} · {a.status}</span><select disabled={busy} aria-label={`Action for applicant ${a.guardUserId}`} value="" onChange={e => { const status = e.target.value; if (status) run(() => change('applications', a.id, { status })); }}><option value="">Hiring action</option><option value="shortlisted">Shortlist</option><option value="selected">Select</option><option value="hired">Send hire proposal</option><option value="not_hired">Mark not hired</option><option value="rejected">Reject</option></select><button disabled={busy} className="text-blue-700" onClick={() => { const remarks = window.prompt('Enter interview date, time, location, and instructions:'); if (remarks?.trim()) run(async () => { await apiClient.post(`/managed-companies/${selected.companyId}/${selected.department}/applications/${a.id}/schedule-interview`, { remarks: remarks.trim() }); await open(selected, true); setNotice('Interview scheduled.'); }); }}>Schedule interview</button></div>)}{!data.applications.length && <p className="py-3 text-sm text-gray-500">No applicants or associates are available for this company.</p>}</section>}
      {(!view || view === 'sites') && data.sites && <ManagedSites companyId={selected.companyId} sites={data.sites} onReload={() => open(selected, true)} />}
      {(!view || view === 'attendance') && data.attendance && <section><h3 className="font-bold">Attendance</h3>{data.attendance.map((a: any) => <div key={a.id} className="border-t py-3 flex flex-wrap gap-3"><span>{String(a.attendanceDate).slice(0, 10)} · {a.associateName} · {a.totalHours || 0} hours · {a.status}</span>{['approved', 'rejected'].map(status => <button key={status} disabled={busy} className="text-blue-700 capitalize" onClick={() => { if (window.confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this attendance record? Existing settlement rules apply.`)) { const remarks = status === 'rejected' ? window.prompt('Reason for rejection (required):') : undefined; if (status === 'rejected' && !remarks?.trim()) return; run(() => change('attendance', a.id, { status, employer_remarks: remarks })); } }}>{status === 'approved' ? 'Approve' : 'Reject'}</button>)}</div>)}{!data.attendance.length && <p className="py-3 text-sm text-gray-500">No completed attendance is awaiting review.</p>}</section>}
      {(!view || view === 'invoices') && data.invoices && <section><h3 className="font-bold">Company invoices</h3><p className="text-sm text-gray-500">Employer wallet balances and funds apply across companies and require employer access.</p>{data.invoices.map((i: any) => <p key={i.id} className="py-3 border-t">{i.invoiceNumber || i.id} · ₹{i.totalAmount} · {i.paymentStatus} · {String(i.invoiceDate).slice(0, 10)}</p>)}{!data.invoices.length && <p className="py-3 text-sm text-gray-500">No invoices are linked to this company.</p>}</section>}
    </Card>}
  </div>;
}
