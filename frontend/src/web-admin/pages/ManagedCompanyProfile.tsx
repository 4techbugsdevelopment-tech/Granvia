import { useState } from 'react';
import { Building2, Save } from 'lucide-react';
import CityStateSelect from '../../components/CityStateSelect';
import { EmployerFieldKind, getInputMode, sanitizeEmployerInput } from '../../lib/inputSanitizers';
import { emailError, gstError, httpUrlError, indianMobileError, panError, pincodeError } from '../../lib/formValidation';

type CompanyProfileValues = Record<string, string>;

type Props = {
  companyId: string;
  values: CompanyProfileValues;
  saving: boolean;
  onChange: (values: CompanyProfileValues) => void;
  onSave: () => Promise<void>;
};

type FieldErrors = Record<string, string>;

function ProfileInput({ label, value, onChange, error, kind = 'text', required = false, className = '' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  kind?: EmployerFieldKind;
  required?: boolean;
  className?: string;
}) {
  return <label className={`block ${className}`}>
    <span className="form-label">{label}{required ? ' *' : ''}</span>
    <input
      value={value}
      required={required}
      inputMode={getInputMode(kind)}
      maxLength={kind === 'mobile' ? 10 : kind === 'pincode' ? 6 : kind === 'gst' ? 15 : kind === 'pan' ? 10 : undefined}
      className={`form-input ${error ? 'border-red-500 focus:border-red-500' : ''}`}
      aria-invalid={Boolean(error)}
      onChange={event => onChange(sanitizeEmployerInput(event.target.value, kind))}
    />
    {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
  </label>;
}

export default function ManagedCompanyProfile({ companyId, values, saving, onChange, onSave }: Props) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const update = (key: string, value: string, kind: EmployerFieldKind = 'text') => {
    onChange({ ...values, [key]: sanitizeEmployerInput(value, kind) });
    if (fieldErrors[key]) setFieldErrors(current => ({ ...current, [key]: '' }));
  };

  const save = async () => {
    const errors: FieldErrors = {};
    if (!values.company_name?.trim() || values.company_name.trim().length < 2) errors.company_name = 'Company name must contain at least 2 characters.';
    const checks: Array<[string, string]> = [
      ['company_email', emailError(values.company_email || '', false)],
      ['company_phone', indianMobileError(values.company_phone || '', false)],
      ['website', httpUrlError(values.website || '', false)],
      ['gst_number', gstError(values.gst_number || '', false)],
      ['pan_number', panError(values.pan_number || '', false)],
      ['pincode', pincodeError(values.pincode || '', false)],
    ];
    checks.forEach(([key, message]) => { if (message) errors[key] = message; });
    if (values.city && !values.state) errors.state = 'Select the state for this city.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    await onSave();
  };

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 text-white sm:px-6" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10"><Building2 size={24} /></div>
        <div>
          <h2 className="text-xl font-bold">Edit Company Profile</h2>
          <p className="mt-0.5 text-xs text-blue-200">{values.company_name || 'Selected company'} · {companyId}</p>
        </div>
      </div>
      <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm disabled:opacity-60"><Save size={16}/>{saving ? 'Saving...' : 'Save Changes'}</button>
    </div>

    <div className="space-y-7 p-5 sm:p-6">
      <section>
        <div className="mb-4"><h3 className="font-bold text-slate-900">Company Details</h3><p className="mt-1 text-xs text-slate-500">Edit the profile of the company currently selected in the top bar.</p></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ProfileInput label="Company Name" required value={values.company_name || ''} error={fieldErrors.company_name} onChange={value => update('company_name', value, 'name')} />
          <ProfileInput label="Business Type" value={values.business_type || ''} onChange={value => update('business_type', value)} />
          <ProfileInput label="Registration Type" value={values.registration_type || ''} onChange={value => update('registration_type', value)} />
          <ProfileInput label="GST Number" kind="gst" value={values.gst_number || ''} error={fieldErrors.gst_number} onChange={value => update('gst_number', value, 'gst')} />
          <ProfileInput label="PAN Number" kind="pan" value={values.pan_number || ''} error={fieldErrors.pan_number} onChange={value => update('pan_number', value, 'pan')} />
          <ProfileInput label="Website" kind="url" value={values.website || ''} error={fieldErrors.website} onChange={value => update('website', value, 'url')} />
        </div>
        <label className="mt-3 block"><span className="form-label">Description</span><textarea rows={3} className="form-input" value={values.description || ''} onChange={event => update('description', event.target.value)} /></label>
      </section>

      <section className="border-t border-slate-100 pt-6">
        <div className="mb-4"><h3 className="font-bold text-slate-900">Contact & Address</h3><p className="mt-1 text-xs text-slate-500">These details are used for company communication and operational records.</p></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ProfileInput label="Company Email" value={values.company_email || ''} error={fieldErrors.company_email} onChange={value => update('company_email', value)} />
          <ProfileInput label="Company Phone" kind="mobile" value={values.company_phone || ''} error={fieldErrors.company_phone} onChange={value => update('company_phone', value, 'mobile')} />
          <ProfileInput label="Pincode" kind="pincode" value={values.pincode || ''} error={fieldErrors.pincode} onChange={value => update('pincode', value, 'pincode')} />
          <div className="md:col-span-3">
            <CityStateSelect city={values.city || ''} state={values.state || ''} cityError={fieldErrors.city} stateError={fieldErrors.state} onCityChange={value => update('city', value, 'cityState')} onStateChange={value => update('state', value, 'cityState')} />
          </div>
        </div>
        <label className="mt-3 block"><span className="form-label">Registered Address</span><textarea rows={3} className="form-input" value={values.registered_address || ''} onChange={event => update('registered_address', event.target.value)} /></label>
      </section>

      <div className="flex justify-end border-t border-slate-100 pt-5">
        <button type="button" onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"><Save size={16}/>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </div>
  </div>;
}
