import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, Edit, Eye, ExternalLink, Plus, Search, Shield, ShieldOff, Trash2, XCircle } from 'lucide-react';
import { EmployerFieldKind, getInputMode, sanitizeEmployerInput } from '../../lib/inputSanitizers';
import { Employer } from '../../lib/storage';
import {
  assertUniqueEmployerForEdit,
  createEmployerFromAdmin,
  deleteEmployerFromAdmin,
  EmployerManagementData,
  listEmployerManagementData,
  updateEmployerFromAdmin,
  declareEmployerAadhaar,
} from '../../services/adminEmployerService';
import { getErrorMessage, getValidationErrors, type ValidationErrors } from '../../services/apiErrors';
import { usePincodeAutofill } from '../../hooks/usePincodeAutofill';

const EMPTY_DATA: EmployerManagementData = {
  employers: [],
  companies: [],
  documents: [],
  sites: [],
  jobs: [],
  walletBalances: {},
};

export default function EmployerManagement() {
  const [data, setData] = useState<EmployerManagementData>(EMPTY_DATA);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employer | null>(null);
  const [editing, setEditing] = useState<Employer | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const { employers, companies, documents, sites, jobs, walletBalances } = data;
  const filtered = employers.filter(employer => {
    const query = search.toLowerCase();
    const employerCompanies = companies.filter(company => company.employerId === employer.id);
    return employer.contactPersonName.toLowerCase().includes(query) ||
      employer.email.toLowerCase().includes(query) ||
      employer.mobile.includes(search) ||
      employerCompanies.some(company => company.companyName.toLowerCase().includes(query));
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextData = await listEmployerManagementData();
      setData(nextData);
      setSelected(current => current ? nextData.employers.find(item => item.id === current.id) || null : null);
      setEditing(current => current ? nextData.employers.find(item => item.id === current.id) || null : null);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load employers from Supabase.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateEmployer = async (id: string, updates: Partial<Employer>) => {
    setNotice('');
    setError('');
    try {
      await updateEmployerFromAdmin(id, updates);
      await reload();
      setNotice('Employer updated.');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update employer.'));
    }
  };

  const declareAadhaar = async (id: string, status: 'verified' | 'rejected') => {
    setNotice('');
    setError('');
    try {
      await declareEmployerAadhaar(id, status);
      await reload();
      setNotice(`Aadhaar marked ${status}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update Aadhaar status.'));
    }
  };

  const deleteEmployer = async (employer: Employer) => {
    const confirmed = window.confirm(`Delete ${employer.companyName}? This will remove employer-owned sites, jobs, applications, payments, wallet records, documents, and Aadhaar verification records.`);
    if (!confirmed) return;
    setNotice('');
    setError('');
    try {
      await deleteEmployerFromAdmin(employer.id);
      setSelected(null);
      setEditing(null);
      await reload();
      setNotice('Employer deleted.');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete employer.'));
    }
  };

  return (
    <motion.div className="p-4 md:p-6 space-y-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>Employer Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{employers.length} employer accounts · {companies.length} companies</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:min-w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Search employers or companies..." />
          </div>
          <button onClick={() => setShowAdd(true)} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white sm:w-auto" style={{ background: '#0f1e3c' }}>
            <Plus size={16} /> Add Employer
          </button>
        </div>
      </div>
      {notice && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="rounded-xl bg-white border border-gray-100 px-4 py-3 text-sm text-gray-500">Loading employers from Supabase...</div>}

      <div className="space-y-3 lg:hidden">
        {filtered.map(employer => {
          const employerCompanies = companies.filter(company => company.employerId === employer.id);
          const employerJobs = jobs.filter(job => job.employerId === employer.id);
          const employerSites = sites.filter(site => site.employerId === employer.id);
          return (
            <div key={employer.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-gray-900">{employer.contactPersonName}</p><p className="break-all text-xs text-gray-500">{employer.email}</p><p className="text-xs text-gray-400">{employer.mobile}</p></div>{statusBadge(employer.accountStatus)}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <MobileDetail label="Location" value={`${employer.city}, ${employer.state}`} />
                <MobileDetail label="Aadhaar" value={statusBadge(employer.aadhaarVerificationStatus)} />
                <MobileDetail label="Companies" value={String(employerCompanies.length)} />
                <MobileDetail label="Jobs / Sites" value={`${employerJobs.length} / ${employerSites.length}`} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => setSelected(employer)} className="table-action"><Eye size={13} className="inline mr-1" />View</button>
                <button onClick={() => setEditing(employer)} className="table-action"><Edit size={13} className="inline mr-1" />Edit</button>
                <button onClick={() => updateEmployer(employer.id, { accountStatus: employer.accountStatus === 'Blocked' ? 'Active' : 'Blocked' })} className="table-action">{employer.accountStatus === 'Blocked' ? 'Unblock' : 'Block'}</button>
                <button onClick={() => deleteEmployer(employer)} className="table-action tone-red"><Trash2 size={13} className="inline mr-1" />Delete</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="rounded-2xl bg-white py-10 text-center text-sm text-gray-400">No employers found</div>}
      </div>

      <div className="hidden rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employer', 'Contact', 'Location', 'Created From', 'Aadhaar', 'Companies', 'Account', 'Jobs', 'Sites', 'Actions'].map(header => (
                  <th key={header} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(employer => {
                const employerCompanies = companies.filter(company => company.employerId === employer.id);
                const employerJobs = jobs.filter(job => job.employerId === employer.id);
                const employerSites = sites.filter(site => site.employerId === employer.id);
                return (
                  <tr key={employer.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{employer.contactPersonName}</div>
                      <div className="text-xs text-gray-400">{employer.id} · {employer.businessType}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {employer.contactPersonName}
                      <div className="text-xs text-gray-400">{employer.email} · {employer.mobile}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{employer.city}, {employer.state}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{employer.createdFrom === 'super_admin' ? 'Super Admin' : 'App'}</td>
                    <td className="px-4 py-3">{statusBadge(employer.aadhaarVerificationStatus)}<div className="text-xs text-gray-400 mt-1">{employer.aadhaarLastFour ? `Last four ${employer.aadhaarLastFour}` : 'Not available'}</div></td>
                    <td className="px-4 py-3">
                      {employerCompanies.length}
                      <div className="text-xs text-gray-400 mt-1">{employerCompanies.filter(company => company.accountStatus === 'Active').length} active</div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(employer.accountStatus)}</td>
                    <td className="px-4 py-3 text-sm">{employerJobs.length}</td>
                    <td className="px-4 py-3 text-sm">{employerSites.length}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(employer)} className="table-action"><Eye size={13} className="inline mr-1" />View</button>
                      <button onClick={() => setEditing(employer)} className="table-action"><Edit size={13} className="inline mr-1" />Edit</button>
                      <button onClick={() => updateEmployer(employer.id, { verificationStatus: 'Verified', accountStatus: 'Active', adminRemarks: 'Verified by Super Admin', rejectionReason: '' })} className="table-action tone-green">Approve</button>
                      <button onClick={() => updateEmployer(employer.id, { verificationStatus: 'Rejected', rejectionReason: 'Documents require correction', adminRemarks: 'Rejected by Super Admin' })} className="table-action tone-red">Reject</button>
                      {employer.aadhaarVerificationStatus !== 'verified' && (
                        <button onClick={() => declareAadhaar(employer.id, 'verified')} className="table-action tone-green" title="Manually declare Aadhaar verified">Aadhaar ✓</button>
                      )}
                      {employer.aadhaarVerificationStatus === 'verified' && (
                        <button onClick={() => declareAadhaar(employer.id, 'rejected')} className="table-action tone-red" title="Revoke Aadhaar verification">Aadhaar ✗</button>
                      )}
                      <button onClick={() => updateEmployer(employer.id, { accountStatus: employer.accountStatus === 'Blocked' ? 'Active' : 'Blocked' })} className="table-action">
                        {employer.accountStatus === 'Blocked' ? <Shield size={13} className="inline mr-1" /> : <ShieldOff size={13} className="inline mr-1" />}
                        {employer.accountStatus === 'Blocked' ? 'Unblock' : 'Block'}
                      </button>
                      <button onClick={() => deleteEmployer(employer)} className="table-action tone-red"><Trash2 size={13} className="inline mr-1" />Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No employers found</div>}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Companies</h2>
          <p className="text-xs text-gray-400 mt-1">Company profiles are separate from employer login accounts.</p>
        </div>
        <div className="space-y-3 p-3 lg:hidden">
          {companies.map(company => {
            const owner = employers.find(employer => employer.id === company.employerId);
            const companySites = sites.filter(site => site.employerId === company.employerId && site.companyId === company.id);
            const companyJobs = jobs.filter(job => job.employerId === company.employerId && job.companyId === company.id);
            return <div key={company.id} className="rounded-xl border border-gray-100 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-gray-900">{company.companyName}</p><p className="text-xs text-gray-500">{owner?.contactPersonName || company.employerId}</p></div>{statusBadge(company.accountStatus)}</div><div className="mt-3 grid grid-cols-2 gap-3"><MobileDetail label="Location" value={`${company.city}, ${company.state}`} /><MobileDetail label="Verification" value={statusBadge(company.verificationStatus)} /><MobileDetail label="Sites" value={String(companySites.length)} /><MobileDetail label="Jobs" value={String(companyJobs.length)} /></div></div>;
          })}
          {companies.length === 0 && <div className="py-8 text-center text-sm text-gray-400">No companies found</div>}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Company', 'Employer', 'GST / PAN', 'Location', 'Verification', 'Account', 'Sites', 'Jobs'].map(header => (
                  <th key={header} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map(company => {
                const owner = employers.find(employer => employer.id === company.employerId);
                const companySites = sites.filter(site => site.employerId === company.employerId && site.companyId === company.id);
                const companyJobs = jobs.filter(job => job.employerId === company.employerId && job.companyId === company.id);
                return (
                  <tr key={company.id} className="border-b border-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{company.companyName}</div>
                      <div className="text-xs text-gray-400">{company.id} - {company.businessType}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{owner?.contactPersonName || company.employerId}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{company.gstNumber || '--'} / {company.panNumber || '--'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{company.city}, {company.state}</td>
                    <td className="px-4 py-3">{statusBadge(company.verificationStatus)}</td>
                    <td className="px-4 py-3">{statusBadge(company.accountStatus)}</td>
                    <td className="px-4 py-3 text-sm">{companySites.length}</td>
                    <td className="px-4 py-3 text-sm">{companyJobs.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {companies.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No companies found</div>}
        </div>
      </div>

      {showAdd && <AddEmployerDialog onClose={() => setShowAdd(false)} onCreated={async (generatedPassword) => { setShowAdd(false); await reload(); setNotice(generatedPassword ? `Employer created. Temporary password: ${generatedPassword}` : 'Employer created.'); }} />}
      {editing && <EditEmployerDialog employer={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); setNotice('Employer updated.'); }} />}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setSelected(null)}>
          <motion.div className="w-full max-w-4xl rounded-2xl bg-white overflow-hidden shadow-2xl" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 text-white flex items-start justify-between" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <Building2 size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selected.companyName}</h2>
                  <p className="text-xs text-blue-200">{selected.email} · {selected.mobile}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/60 hover:text-white"><XCircle size={22} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">
              <InfoBlock title="Company Details" rows={[
                ['Created From', selected.createdFrom === 'super_admin' ? 'Super Admin' : 'App'],
                ['Created By', selected.createdBy || 'Not applicable'],
                ['Business Type', selected.businessType],
                ['GST', selected.gstNumber || 'Not provided'],
                ['PAN', selected.panNumber || 'Not provided'],
                ['Website', selected.website || 'Not provided'],
                ['Description', selected.description || 'Not provided'],
              ]} />
              <InfoBlock title="Address & Contact" rows={[
                ['Contact Person', selected.contactPersonName],
                ['Designation', selected.designation],
                ['Registered Address', selected.companyAddress],
                ['Billing Address', selected.billingAddress],
                ['City / State / Pincode', `${selected.city}, ${selected.state} ${selected.pincode}`],
              ]} />
              <InfoBlock title="Companies Under Employer" rows={companies.filter(company => company.employerId === selected.id).map(company => [company.companyName, `${company.accountStatus} / ${company.verificationStatus}`])} />
              <DocumentBlock documents={documents.filter(doc => doc.employerId === selected.id)} />
              <InfoBlock title="Jobs & Sites" rows={[
                ['Aadhaar Status', selected.aadhaarVerificationStatus],
                ['Aadhaar Last Four', selected.aadhaarLastFour || 'Not available'],
                ['Aadhaar Verified At', selected.aadhaarVerifiedAt || 'Not available'],
                ['Jobs', String(jobs.filter(job => job.employerId === selected.id).length)],
                ['Sites', String(sites.filter(site => site.employerId === selected.id).length)],
                ['Wallet', `Rs ${walletBalances[selected.id] || 0}`],
              ]} />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setEditing(selected); setSelected(null); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>Edit Employer</button>
              <button onClick={() => deleteEmployer(selected)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-700">Delete Employer</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function DocumentBlock({ documents }: { documents: EmployerManagementData['documents'] }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <h3 className="font-bold text-gray-900 mb-3">Documents</h3>
      {documents.length === 0 ? <p className="text-sm text-gray-400">No records</p> : documents.map(doc => (
        <div key={doc.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{doc.type}</p>
            <p className="text-xs text-gray-400 truncate">{doc.fileName} ({doc.status})</p>
          </div>
          {doc.downloadUrl ? (
            <a href={doc.downloadUrl} target="_blank" rel="noreferrer" className="table-action tone-blue inline-flex items-center gap-1 flex-shrink-0">
              <ExternalLink size={13} /> View
            </a>
          ) : <span className="text-xs text-gray-400">Unavailable</span>}
        </div>
      ))}
    </div>
  );
}

function InfoBlock({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <h3 className="font-bold text-gray-900 mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-gray-400">No records</p> : rows.map(([label, value]) => (
        <div key={label} className="py-2 border-b border-gray-50 last:border-0">
          <div className="text-xs text-gray-400">{label}</div>
          <div className="text-sm font-medium text-gray-800">{value}</div>
        </div>
      ))}
    </div>
  );
}

function AddEmployerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (temporaryPassword: string | null) => void | Promise<void> }) {
  const [form, setForm] = useState({
    companyName: '',
    contactPersonName: '',
    mobile: '',
    email: '',
    password: '',
    companyAddress: '',
    city: '',
    state: '',
    pincode: '',
    businessType: '',
    gstNumber: '',
    panNumber: '',
    website: '',
    accountStatus: 'Active' as Employer['accountStatus'],
    remarks: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});

  usePincodeAutofill(form.pincode, result => {
    setForm(current => ({ ...current, city: result.city, state: result.state }));
  });

  const update = (key: keyof typeof form, value: string, kind: EmployerFieldKind = 'text') => setForm(current => ({ ...current, [key]: sanitizeEmployerInput(value, kind) }));
  const submit = async () => {
    setError('');
    setFieldErrors({});
    try {
      const result = await createEmployerFromAdmin({
        companyName: form.companyName,
        contactPersonName: form.contactPersonName,
        mobile: form.mobile,
        email: form.email,
        password: form.password,
        companyAddress: form.companyAddress,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        businessType: form.businessType,
        gstNumber: form.gstNumber,
        panNumber: form.panNumber,
        website: form.website,
        accountStatus: form.accountStatus,
        remarks: form.remarks,
      });
      await onCreated(result.temporaryPassword);
    } catch (err) {
      const validationErrors = getValidationErrors(err);
      setFieldErrors(validationErrors);
      setError(Object.keys(validationErrors).length ? 'Please correct the highlighted fields.' : getErrorMessage(err, 'Unable to create employer.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50">
      <div className="mx-auto min-h-full w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        <button type="button" onClick={onClose} className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
          <ArrowLeft size={18} /> Back to Employers
        </button>
      <motion.div className="w-full rounded-2xl bg-white overflow-hidden border border-slate-200 shadow-sm" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="px-6 py-5 text-white flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
          <div>
            <h2 className="text-xl font-bold">Add Employer / Company</h2>
            <p className="text-xs text-blue-200">Uses the centralized employer creation service.</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><XCircle size={22} /></button>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DialogInput label="Company Name" kind="name" value={form.companyName} error={fieldErrors.company_name} onChange={value => update('companyName', value, 'name')} />
            <DialogInput label="Contact Person" kind="name" value={form.contactPersonName} error={fieldErrors.contact_person_name} onChange={value => update('contactPersonName', value, 'name')} />
            <DialogInput label="Mobile Number" kind="mobile" value={form.mobile} error={fieldErrors.mobile} onChange={value => update('mobile', value, 'mobile')} />
            <DialogInput label="Email Address" value={form.email} error={fieldErrors.email} onChange={value => update('email', value)} />
            <DialogInput label="Temporary Password" value={form.password} onChange={value => update('password', value)} />
            <DialogInput label="Business Type" kind="name" value={form.businessType} onChange={value => update('businessType', value, 'name')} />
            <DialogInput label="City" kind="cityState" value={form.city} onChange={value => update('city', value, 'cityState')} />
            <DialogInput label="State" kind="cityState" value={form.state} onChange={value => update('state', value, 'cityState')} />
            <DialogInput label="Pincode" kind="pincode" value={form.pincode} onChange={value => update('pincode', value, 'pincode')} />
            <DialogInput label="GST Number (Optional)" kind="gst" value={form.gstNumber} error={fieldErrors.gst_number} onChange={value => update('gstNumber', value, 'gst')} />
            <DialogInput label="PAN Number (Optional)" kind="pan" value={form.panNumber} error={fieldErrors.pan_number} onChange={value => update('panNumber', value, 'pan')} />
            <DialogInput label="Website" kind="url" value={form.website} onChange={value => update('website', value, 'url')} />
          </div>
          <DialogInput className="mt-3" label="Company Address" value={form.companyAddress} onChange={value => update('companyAddress', value)} />
          <DialogInput className="mt-3" label="Remarks" value={form.remarks} onChange={value => update('remarks', value)} />
          <label className="block mt-3">
            <span className="form-label">Account Status</span>
            <select value={form.accountStatus} onChange={event => update('accountStatus', event.target.value)} className="form-input">
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
            </select>
          </label>
          <p className="text-xs text-gray-400 mt-3">If the password is left blank, a temporary password is generated and shown once. TODO: connect email credentials delivery when provider configuration is available.</p>
          {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>Cancel</button>
            <button onClick={submit} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>Create Employer</button>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}

function EditEmployerDialog({ employer, onClose, onSaved }: { employer: Employer; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [form, setForm] = useState({
    companyName: employer.companyName,
    contactPersonName: employer.contactPersonName,
    designation: employer.designation,
    mobile: employer.mobile,
    email: employer.email,
    companyAddress: employer.companyAddress,
    billingAddress: employer.billingAddress,
    city: employer.city,
    state: employer.state,
    pincode: employer.pincode,
    businessType: employer.businessType,
    gstNumber: employer.gstNumber,
    panNumber: employer.panNumber,
    website: employer.website,
    description: employer.description,
    accountStatus: employer.accountStatus,
    verificationStatus: employer.verificationStatus,
    adminRemarks: employer.adminRemarks,
    rejectionReason: employer.rejectionReason,
  });
  const [error, setError] = useState('');

  usePincodeAutofill(form.pincode, result => {
    setForm(current => ({ ...current, city: result.city, state: result.state }));
  });

  const update = (key: keyof typeof form, value: string, kind: EmployerFieldKind = 'text') => setForm(current => ({ ...current, [key]: sanitizeEmployerInput(value, kind) }));
  const save = async () => {
    setError('');
    if (!form.companyName.trim() || !form.contactPersonName.trim() || !form.mobile.trim() || !form.email.trim()) {
      setError('Company, contact person, mobile, and email are required.');
      return;
    }
    if (!form.mobile.trim().match(/^[6-9]\d{9}$/)) {
      setError('Enter a valid 10 digit Indian mobile number.');
      return;
    }
    if (!form.email.trim().match(/^\S+@\S+\.\S+$/)) {
      setError('Enter a valid email address.');
      return;
    }
    try {
      await assertUniqueEmployerForEdit(employer.id, form.email.trim().toLowerCase(), form.mobile.trim());
      await updateEmployerFromAdmin(employer.id, {
        ...form,
        email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim(),
        gstNumber: form.gstNumber.trim().toUpperCase(),
        panNumber: form.panNumber.trim().toUpperCase(),
        accountStatus: form.accountStatus as Employer['accountStatus'],
        verificationStatus: form.verificationStatus as Employer['verificationStatus'],
        profileStatus: form.companyName && form.companyAddress ? 'Complete' : 'Incomplete',
      });
      await onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update employer.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <motion.div className="w-full max-w-5xl rounded-2xl bg-white overflow-hidden shadow-2xl" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={event => event.stopPropagation()}>
        <div className="px-6 py-5 text-white flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
          <div>
            <h2 className="text-xl font-bold">Edit Employer / Company</h2>
            <p className="text-xs text-blue-200">{employer.id} · {employer.createdFrom === 'super_admin' ? 'Created by Super Admin' : 'Created from App'}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><XCircle size={22} /></button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          <section>
            <h3 className="font-bold text-gray-900 mb-3">Company Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DialogInput label="Company Name" kind="name" value={form.companyName} onChange={value => update('companyName', value, 'name')} />
              <DialogInput label="Business Type" kind="name" value={form.businessType} onChange={value => update('businessType', value, 'name')} />
              <DialogInput label="Website" kind="url" value={form.website} onChange={value => update('website', value, 'url')} />
              <DialogInput label="GST Number" kind="gst" value={form.gstNumber} onChange={value => update('gstNumber', value, 'gst')} />
              <DialogInput label="PAN Number" kind="pan" value={form.panNumber} onChange={value => update('panNumber', value, 'pan')} />
            </div>
            <DialogInput className="mt-3" label="Description" value={form.description} onChange={value => update('description', value)} />
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-3">Contact & Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DialogInput label="Contact Person" kind="name" value={form.contactPersonName} onChange={value => update('contactPersonName', value, 'name')} />
              <DialogInput label="Designation" kind="name" value={form.designation} onChange={value => update('designation', value, 'name')} />
              <DialogInput label="Mobile Number" kind="mobile" value={form.mobile} onChange={value => update('mobile', value, 'mobile')} />
              <DialogInput label="Email Address" value={form.email} onChange={value => update('email', value)} />
              <DialogInput label="City" kind="cityState" value={form.city} onChange={value => update('city', value, 'cityState')} />
              <DialogInput label="State" kind="cityState" value={form.state} onChange={value => update('state', value, 'cityState')} />
              <DialogInput label="Pincode" kind="pincode" value={form.pincode} onChange={value => update('pincode', value, 'pincode')} />
            </div>
            <DialogInput className="mt-3" label="Registered Address" value={form.companyAddress} onChange={value => update('companyAddress', value)} />
            <DialogInput className="mt-3" label="Billing Address" value={form.billingAddress} onChange={value => update('billingAddress', value)} />
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-3">Admin Controls</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label>
                <span className="form-label">Account Status</span>
                <select value={form.accountStatus} onChange={event => update('accountStatus', event.target.value)} className="form-input">
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </label>
              <label>
                <span className="form-label">Verification Status</span>
                <select value={form.verificationStatus} onChange={event => update('verificationStatus', event.target.value)} className="form-input">
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </label>
              <DialogInput label="Rejection Reason" value={form.rejectionReason} onChange={value => update('rejectionReason', value)} />
            </div>
            <DialogInput className="mt-3" label="Admin Remarks" value={form.adminRemarks} onChange={value => update('adminRemarks', value)} />
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-3">Aadhaar Verification</h3>
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-600">
              Status: {employer.aadhaarVerificationStatus}. Last four digits: {employer.aadhaarLastFour || 'Not available'}. Super Admin cannot edit Aadhaar verification from this form.
            </div>
          </section>

          {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>Cancel</button>
            <button onClick={save} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>Save Changes</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DialogInput({ label, value, onChange, className = '', kind = 'text', error }: { label: string; value: string; onChange: (value: string) => void; className?: string; kind?: EmployerFieldKind; error?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="form-label">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        inputMode={getInputMode(kind)}
        maxLength={kind === 'mobile' ? 10 : kind === 'pincode' ? 6 : kind === 'gst' ? 15 : kind === 'pan' ? 10 : undefined}
        className={`form-input ${error ? 'border-red-500 focus:border-red-500' : ''}`}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

function MobileDetail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-gray-400">{label}</p><div className="break-words text-sm text-gray-700">{value}</div></div>;
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  const good = normalized === 'verified' || normalized === 'active';
  const bad = normalized === 'rejected' || normalized === 'blocked';
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{
      background: good ? '#dcfce7' : bad ? '#fee2e2' : '#fef9c3',
      color: good ? '#166534' : bad ? '#7c2d12' : '#854d0e',
    }}>
      {status}
    </span>
  );
}
