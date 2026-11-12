import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../../services/apiErrors';
import { previewMinimumWage, type MinimumWagePreview } from '../../services/minimumWageService';
import type { SalaryStructureDraft } from '../../services/salaryStructureService';

type Props = {
  scope: 'employer' | 'admin'; state?: string | null; district?: string | null; jobRole?: string | null;
  employmentCategory?: string | null; effectiveDate?: string | null; paymentType: string; salaryStructure: SalaryStructureDraft | null;
};

const tone = (preview: MinimumWagePreview | null) => preview?.status === 'VERIFIED' && preview.comparison?.compliance_status === 'COMPLIANT'
  ? 'border-green-200 bg-green-50 text-green-900'
  : preview?.comparison?.compliance_status === 'NON_COMPLIANT' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900';

export default function MinimumWagePanel({ scope, state, district, jobRole, employmentCategory, effectiveDate, paymentType, salaryStructure }: Props) {
  const [preview, setPreview] = useState<MinimumWagePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const validFrequency = paymentType === 'Monthly' || paymentType === 'Daily';
  useEffect(() => {
    setError('');
    if (!state || !jobRole || !effectiveDate || !salaryStructure || !validFrequency) { setPreview(null); return; }
    const current = ++request.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      previewMinimumWage(scope, {
        state, district_code: district || undefined, job_role_code: jobRole, employment_category_code: employmentCategory || undefined,
        effective_date: effectiveDate, wage_unit: paymentType === 'Daily' ? 'DAILY' : 'MONTHLY', payment_type: paymentType as 'Monthly' | 'Daily', salary_structure: salaryStructure,
      }, controller.signal).then(result => { if (request.current === current) setPreview(result); })
        .catch(cause => { if (request.current === current && cause?.name !== 'CanceledError') setError(getErrorMessage(cause, 'Unable to check the minimum wage.')); })
        .finally(() => { if (request.current === current) setLoading(false); });
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [scope, state, district, jobRole, employmentCategory, effectiveDate, paymentType, salaryStructure, validFrequency]);

  return <section className={`mt-4 rounded-xl border p-4 ${tone(preview)}`} aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-bold">Applicable Minimum Wage</h4><p className="text-xs opacity-75">Checked from approved government notification data. Employers cannot change this amount.</p></div>{loading && <span className="text-xs font-semibold">Checking…</span>}</div>
    {!state || !jobRole || !effectiveDate ? <p className="mt-3 text-sm">Select the work location, associate type and job start date to check the wage.</p>
      : error ? <p role="alert" className="mt-3 text-sm font-semibold">{error}</p>
      : !preview ? <p className="mt-3 text-sm">Waiting for complete salary details.</p>
      : <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div><span className="text-xs opacity-70">Status</span><p className="font-bold">{preview.status.replaceAll('_', ' ')}</p></div>
        <div><span className="text-xs opacity-70">Required wage</span><p className="font-bold">{preview.applicable_rate ? `₹${preview.applicable_rate.amount} / ${preview.applicable_rate.unit.toLowerCase()}` : '--'}</p></div>
        <div><span className="text-xs opacity-70">Qualifying offered wage</span><p className="font-bold">{preview.comparison?.qualifying_wage ? `₹${preview.comparison.qualifying_wage}` : '--'}</p></div>
        <div><span className="text-xs opacity-70">Compliance</span><p className="font-bold">{preview.comparison?.compliance_status?.replaceAll('_', ' ') ?? 'REVIEW REQUIRED'}</p></div>
        <div className="sm:col-span-2"><span className="text-xs opacity-70">Government notification</span><p className="font-semibold">{preview.notification ? `${preview.notification.number} · effective ${new Date(preview.notification.effective_from).toLocaleDateString('en-IN')}` : '--'}</p></div>
        <div className="sm:col-span-2"><span className="text-xs opacity-70">Result</span><p className="font-semibold">{preview.comparison?.compliance_status === 'NON_COMPLIANT' ? `Salary is short by ₹${preview.comparison.shortfall}. Publishing will be blocked.` : preview.reason.replaceAll('_', ' ')}</p></div>
      </div>}
  </section>;
}

