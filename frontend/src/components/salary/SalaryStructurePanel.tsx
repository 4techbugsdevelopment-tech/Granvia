import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createDefaultSalaryStructure, createSalaryTemplate, listSalaryTemplates, type SalaryApiScope, type SalaryBasis, type SalaryCategory, type SalaryComponentDraft, type SalaryStructureDraft, type SalaryTemplate } from '../../services/salaryStructureService';

const input = 'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm';
const moneyToPaise = (raw: string | null | undefined) => {
  const value = String(raw ?? '').trim(); if (!/^\d*(?:\.\d{0,2})?$/.test(value) || !value) return 0n;
  const [whole = '0', fraction = ''] = value.split('.'); return BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0'));
};
const percentScaled = (raw: string | null | undefined) => {
  const value = String(raw ?? '').trim(); if (!/^\d*(?:\.\d{0,4})?$/.test(value) || !value) return 0n;
  const [whole = '0', fraction = ''] = value.split('.'); return BigInt(whole || '0') * 10000n + BigInt(fraction.padEnd(4, '0'));
};
const amount = (paise: bigint) => `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`;
const percentAmount = (basis: bigint, percentage: string | null) => (basis * percentScaled(percentage) + 500000n) / 1000000n;

export function calculateSalaryDraft(draft: SalaryStructureDraft) {
  const enabled = draft.components.filter(row => row.enabled);
  const fixedEarnings = enabled.filter(row => row.category === 'earning' && row.calculation_type === 'fixed');
  const basic = fixedEarnings.filter(row => row.code === 'BASIC_SALARY').reduce((sum, row) => sum + moneyToPaise(row.fixed_amount), 0n);
  const fixedTotal = fixedEarnings.reduce((sum, row) => sum + moneyToPaise(row.fixed_amount), 0n);
  const basis = (value: SalaryBasis | null, gross: bigint) => value === 'basic_salary' ? basic : value === 'fixed_earnings' ? fixedTotal : gross;
  const earningAmounts = new Map(enabled.filter(row => row.category === 'earning').map(row => [row.code, row.calculation_type === 'fixed' ? moneyToPaise(row.fixed_amount) : percentAmount(basis(row.percentage_basis, 0n), row.percentage)]));
  const gross = [...earningAmounts.values()].reduce((sum, value) => sum + value, 0n);
  const componentAmounts = new Map<string, bigint>();
  for (const row of draft.components) {
    let value = !row.enabled ? 0n : row.category === 'earning' ? earningAmounts.get(row.code) ?? 0n : row.calculation_type === 'fixed' ? moneyToPaise(row.fixed_amount) : percentAmount(basis(row.percentage_basis, gross), row.percentage);
    const min = moneyToPaise(row.applicability_min_gross), max = moneyToPaise(row.applicability_max_gross), cap = moneyToPaise(row.monthly_cap);
    if ((min > 0n && gross < min) || (max > 0n && gross > max)) value = 0n; if (cap > 0n && value > cap) value = cap;
    componentAmounts.set(row.code, value);
  }
  const total = (category: SalaryCategory) => draft.components.filter(row => row.category === category).reduce((sum, row) => sum + (componentAmounts.get(row.code) ?? 0n), 0n);
  const deductions = total('deduction'), contributions = total('employer_contribution'), net = gross - deductions, employerCost = gross + contributions;
  return { componentAmounts, gross: amount(gross), deductions: amount(deductions), net: amount(net < 0n ? 0n : net), contributions: amount(contributions), employerCost: amount(employerCost), annualCtc: amount(employerCost * 12n) };
}

export function validateSalaryDraft(draft: SalaryStructureDraft | null) {
  if (!draft) return 'Create a salary structure.';
  const codes = draft.components.map(row => row.code.trim().toUpperCase());
  if (new Set(codes).size !== codes.length) return 'Salary component identifiers must be unique.';
  if (draft.components.some(row => !/^[A-Za-z][A-Za-z0-9_]*$/.test(row.code.trim()))) return 'Component identifiers may contain letters, numbers and underscores.';
  if (draft.components.some(row => !row.name.trim())) return 'Every salary component needs a name.';
  if (draft.components.some(row => row.calculation_type === 'percentage' && (!row.percentage_basis || Number(row.percentage) < 0 || Number(row.percentage) > 100))) return 'Percentage components need a valid basis and rate between 0 and 100.';
  const totals = calculateSalaryDraft(draft); if (moneyToPaise(totals.gross) <= 0n) return 'Gross monthly salary must be greater than zero.';
  if (moneyToPaise(totals.deductions) > moneyToPaise(totals.gross)) return 'Total deductions cannot exceed gross salary.';
  return '';
}

const labels: Record<SalaryCategory, string> = { earning: 'Earnings', deduction: 'Deductions', employer_contribution: 'Employer Contributions' };
export default function SalaryStructurePanel({ value, legacySalary, onChange, scope = 'employer' }: { value: SalaryStructureDraft | null; legacySalary?: string | number | null; onChange: (value: SalaryStructureDraft) => void; scope?: SalaryApiScope }) {
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]), [templateId, setTemplateId] = useState(''), [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { listSalaryTemplates(scope).then(setTemplates).catch(() => setMessage('Salary templates are unavailable until the salary migration is applied.')); }, [scope]);
  const totals = useMemo(() => value ? calculateSalaryDraft(value) : null, [value]);
  if (!value) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3"><h3 className="font-bold text-gray-900">Salary Structure</h3><p className="text-sm text-amber-900">This historical job contains only a legacy gross salary of ₹{legacySalary ?? '0'}. No component breakdown has been invented.</p><button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => onChange(createDefaultSalaryStructure(String(legacySalary ?? '')))}>Create structure from legacy gross as Basic Salary</button></section>;
  const update = (index: number, changes: Partial<SalaryComponentDraft>) => onChange({ components: value.components.map((row, i) => i === index ? { ...row, ...changes } : row) });
  const add = (category: SalaryCategory) => { const suffix = Date.now().toString().slice(-8); onChange({ components: [...value.components, { code: `CUSTOM_${suffix}`, name: 'Custom Component', category, calculation_type: 'fixed', fixed_amount: '0', percentage: null, percentage_basis: null, enabled: true, classification: 'optional', statutory_code: null, applicability_min_gross: null, applicability_max_gross: null, monthly_cap: null, is_custom: true, sort_order: value.components.length * 10 + 300 }] }); };
  const applyTemplate = () => { const selected = templates.find(row => row.id === templateId); if (selected) { onChange({ components: selected.components.map(row => ({ ...row })) }); setMessage(`Applied ${selected.name}.`); } };
  const saveTemplate = async () => { if (!templateName.trim()) return setMessage('Enter a template name.'); const error = validateSalaryDraft(value); if (error) return setMessage(error); try { const created = await createSalaryTemplate({ name: templateName.trim(), components: value.components }, scope); setTemplates(rows => [...rows, created].sort((a, b) => a.name.localeCompare(b.name))); setTemplateName(''); setMessage('Salary template saved.'); } catch (error: any) { setMessage(error?.response?.data?.message || 'Unable to save template.'); } };
  return <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 space-y-5">
    <div><h3 className="text-lg font-bold text-gray-900">Salary Structure</h3><p className="text-sm text-gray-500">Configure monthly earnings, employee deductions and employer costs. Server calculations remain authoritative.</p></div>
    <div className="grid gap-3 md:grid-cols-2"><div className="flex gap-2"><select className={input} value={templateId} onChange={event => setTemplateId(event.target.value)}><option value="">Apply saved template</option>{templates.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><button type="button" className="rounded-lg border px-3 text-sm" onClick={applyTemplate} disabled={!templateId}>Apply</button></div><div className="flex gap-2"><input className={input} placeholder="New template name" value={templateName} onChange={event => setTemplateName(event.target.value)}/><button type="button" className="rounded-lg border px-3 text-sm whitespace-nowrap" onClick={saveTemplate}>Save template</button></div></div>
    {message && <p className="text-sm text-amber-700">{message}</p>}
    {(['earning', 'deduction', 'employer_contribution'] as SalaryCategory[]).map(category => <div key={category} className="space-y-3"><div className="flex items-center justify-between"><h4 className="font-bold text-gray-800">{labels[category]}</h4><button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700" onClick={() => add(category)}><Plus size={15}/> Add Salary Component</button></div>
      <div className="space-y-3">{value.components.map((row, index) => row.category !== category ? null : <div key={`${row.code}-${index}`} className={`rounded-xl border p-3 ${row.enabled ? 'bg-white' : 'bg-gray-50 opacity-75'}`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
        <label className="lg:col-span-1 text-xs"><span className="block mb-1">Enabled</span><input type="checkbox" className="h-5 w-5" checked={row.enabled} disabled={row.classification === 'mandatory'} onChange={event => update(index, { enabled: event.target.checked })}/></label>
        <label className="lg:col-span-3 text-xs">Component name<input className={`${input} mt-1`} value={row.name} onChange={event => update(index, { name: event.target.value })}/></label>
        <label className="lg:col-span-2 text-xs">Identifier<input className={`${input} mt-1`} value={row.code} disabled={!row.is_custom} onChange={event => update(index, { code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}/></label>
        <label className="lg:col-span-2 text-xs">Calculation<select className={`${input} mt-1`} value={row.calculation_type} onChange={event => update(index, { calculation_type: event.target.value as any, fixed_amount: event.target.value === 'fixed' ? '0' : null, percentage: event.target.value === 'percentage' ? '0' : null, percentage_basis: event.target.value === 'percentage' ? (category === 'earning' ? 'basic_salary' : 'gross_salary') : null })}><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option></select></label>
        {row.calculation_type === 'fixed' ? <label className="lg:col-span-2 text-xs">Monthly amount<input inputMode="decimal" className={`${input} mt-1`} value={row.fixed_amount ?? ''} onChange={event => update(index, { fixed_amount: event.target.value.replace(/[^\d.]/g, '') })}/></label> : <><label className="lg:col-span-1 text-xs">Rate %<input inputMode="decimal" className={`${input} mt-1`} value={row.percentage ?? ''} onChange={event => update(index, { percentage: event.target.value.replace(/[^\d.]/g, '') })}/></label><label className="lg:col-span-2 text-xs">Basis<select className={`${input} mt-1`} value={row.percentage_basis ?? ''} onChange={event => update(index, { percentage_basis: event.target.value as SalaryBasis })}><option value="basic_salary">Basic Salary</option><option value="fixed_earnings">Fixed Earnings</option>{category !== 'earning' && <option value="gross_salary">Gross Salary</option>}</select></label></>}
        <label className="lg:col-span-2 text-xs">Classification<select className={`${input} mt-1`} value={row.classification} onChange={event => update(index, { classification: event.target.value as any, enabled: event.target.value === 'mandatory' ? true : row.enabled })}><option value="optional">Optional</option><option value="mandatory">Mandatory</option></select></label>
        <div className="lg:col-span-2 text-xs"><span>Calculated monthly</span><p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 font-bold">₹{amount(totals?.componentAmounts.get(row.code) ?? 0n)}</p></div>
        {row.statutory_code && <><label className="lg:col-span-2 text-xs">Applicable gross from<input className={`${input} mt-1`} value={row.applicability_min_gross ?? ''} onChange={event => update(index, { applicability_min_gross: event.target.value.replace(/[^\d.]/g, '') || null })}/></label><label className="lg:col-span-2 text-xs">Applicable gross through<input className={`${input} mt-1`} value={row.applicability_max_gross ?? ''} onChange={event => update(index, { applicability_max_gross: event.target.value.replace(/[^\d.]/g, '') || null })}/></label><label className="lg:col-span-2 text-xs">Monthly cap<input className={`${input} mt-1`} value={row.monthly_cap ?? ''} onChange={event => update(index, { monthly_cap: event.target.value.replace(/[^\d.]/g, '') || null })}/></label><p className="lg:col-span-4 text-xs text-gray-500">Rule: {row.statutory_code}. Rates are configurable and are not hardcoded.</p></>}
        {row.is_custom && <button type="button" aria-label={`Remove ${row.name}`} className="lg:col-span-1 text-red-700" onClick={() => onChange({ components: value.components.filter((_, i) => i !== index) })}><Trash2 size={18}/></button>}
      </div></div>)}</div></div>)}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[['Gross Monthly Salary', totals?.gross], ['Monthly Deductions', totals?.deductions], ['Estimated Net Monthly', totals?.net], ['Monthly Employer Cost', totals?.employerCost], ['Annual CTC', totals?.annualCtc]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-900 p-3 text-white"><p className="text-xs text-slate-300">{label}</p><p className="mt-1 text-lg font-bold">₹{value}</p></div>)}</div>
    <p className="text-xs text-gray-500">Employer contributions of ₹{totals?.contributions} are included in employer cost and Annual CTC, not deducted from employee net salary.</p>
  </section>;
}
