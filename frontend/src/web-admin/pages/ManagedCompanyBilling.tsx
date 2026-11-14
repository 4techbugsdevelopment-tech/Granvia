import { useState } from 'react';
import { Building2, FileText, MapPin, ReceiptText, Save } from 'lucide-react';
import { gstError } from '../../lib/formValidation';
import { sanitizeEmployerInput } from '../../lib/inputSanitizers';

type Props = {
  companyId: string;
  companyName: string;
  invoiceCount: number;
  values: Record<string, string>;
  saving: boolean;
  onChange: (values: Record<string, string>) => void;
  onSave: () => Promise<void>;
};

export default function ManagedCompanyBilling({ companyId, companyName, invoiceCount, values, saving, onChange, onSave }: Props) {
  const [gstValidation, setGstValidation] = useState('');
  const update = (key: string, value: string) => onChange({ ...values, [key]: value });
  const save = async () => {
    const validation = gstError(values.gst_number || '', false);
    setGstValidation(validation);
    if (validation) return;
    await onSave();
  };

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 text-white sm:px-6" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10"><ReceiptText size={24}/></div>
        <div><h2 className="text-xl font-bold">Edit Billing Details</h2><p className="mt-0.5 text-xs text-blue-200">{companyName} · {companyId}</p></div>
      </div>
      <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm disabled:opacity-60"><Save size={16}/>{saving ? 'Saving...' : 'Save Changes'}</button>
    </div>

    <div className="space-y-7 p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Building2 size={15}/> Selected company</div><p className="mt-2 truncate font-bold text-slate-900">{companyName}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><FileText size={15}/> GST registration</div><p className="mt-2 font-bold text-slate-900">{values.gst_number ? 'GST number available' : 'Not provided'}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><ReceiptText size={15}/> Linked invoices</div><p className="mt-2 font-bold text-slate-900">{invoiceCount}</p></div>
      </div>

      <section>
        <div className="mb-4 flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><MapPin size={18}/></div><div><h3 className="font-bold text-slate-900">Billing Address</h3><p className="mt-0.5 text-xs text-slate-500">This is the company-specific billing address used for commercial correspondence.</p></div></div>
        <label className="block"><span className="form-label">Billing Address</span><textarea rows={5} maxLength={2000} className="form-input min-h-32 resize-y" placeholder="Enter the complete billing address" value={values.billing_address || ''} onChange={event => update('billing_address', event.target.value)} /><span className="mt-1 block text-right text-xs text-slate-400">{(values.billing_address || '').length}/2000</span></label>
      </section>

      <section className="border-t border-slate-100 pt-6">
        <div className="mb-4"><h3 className="font-bold text-slate-900">Tax Information</h3><p className="mt-1 text-xs text-slate-500">Keep the selected company’s GST number accurate for invoice and receipt references.</p></div>
        <label className="block max-w-xl"><span className="form-label">GST Number</span><input value={values.gst_number || ''} maxLength={15} className={`form-input uppercase ${gstValidation ? 'border-red-500 focus:border-red-500' : ''}`} placeholder="For example, 27ABCDE1234F1Z5" onChange={event => { update('gst_number', sanitizeEmployerInput(event.target.value, 'gst')); if (gstValidation) setGstValidation(''); }} />{gstValidation && <span className="mt-1 block text-xs font-medium text-red-600">{gstValidation}</span>}</label>
      </section>

      <div className="flex justify-end border-t border-slate-100 pt-5"><button type="button" onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"><Save size={16}/>{saving ? 'Saving...' : 'Save Changes'}</button></div>
    </div>
  </div>;
}
