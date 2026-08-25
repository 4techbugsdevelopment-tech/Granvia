import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, Check, CheckCircle2, Download, FileSignature, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  AgreementState, completeSandboxEsign, fetchAgreementPdf, generateAgreement,
  getAgreement, giveAgreementConsent, initiateAgreementEsign,
} from '../../services/associateAgreementService';

const COMPLETE = new Set(['SIGNED', 'SANDBOX_SIGNED']);
const PENDING = new Set(['ESIGN_INITIATED', 'ESIGN_PENDING', 'ESIGN_SUCCESS', 'VERIFICATION_PENDING']);
const FAILED = new Set(['ESIGN_FAILED', 'ESIGN_CANCELLED', 'EXPIRED']);
const message = (error: any) => error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';

export default function AgreementScreen() {
  const [state, setState] = useState<AgreementState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setState(await getAgreement()); setError(''); }
    catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!state?.agreement) return;
    let active = true;
    fetchAgreementPdf().then(blob => {
      if (!active) return;
      const next = URL.createObjectURL(blob);
      setPreviewUrl(previous => { if (previous) URL.revokeObjectURL(previous); return next; });
    }).catch(() => setPreviewUrl(null));
    return () => { active = false; };
  }, [state?.agreement?.id, state?.agreement?.status]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    if (!state || !PENDING.has(state.status)) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [state?.status, load]);

  const run = async (action: () => Promise<AgreementState>) => {
    setBusy(true); setError('');
    try { setState(await action()); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };

  const initiate = async () => {
    if (!state?.agreement) return;
    setBusy(true); setError('');
    try {
      if (!state.agreement.consent_given) await giveAgreementConsent(state.agreement.id);
      const result = await initiateAgreementEsign();
      if (result.signing_url) window.location.assign(result.signing_url);
      else await load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };

  const download = async () => {
    try {
      const blob = await fetchAgreementPdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${state?.agreement?.agreement_number ?? 'associate-agreement'}.pdf`; link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(message(e)); }
  };

  if (loading) return <div className="min-h-[70vh] grid place-items-center"><Loader2 className="animate-spin text-slate-500" /></div>;
  const agreement = state?.agreement;
  const signed = Boolean(state && COMPLETE.has(state.status));
  const sandboxSigned = state?.status === 'SANDBOX_SIGNED';
  const canInitiate = Boolean(agreement && state?.eligibility.eligible && (agreement.consent_given || checked) && !signed && !PENDING.has(state.status));
  const steps = [['Profile', state?.eligibility.profile_complete], ['Documents', state?.eligibility.documents_complete], ['KYC', state?.eligibility.kyc_complete], ['Agreement', signed], ['Activation', false]] as const;

  return <div className="pb-6 min-h-full" style={{ background: '#f1f5f9' }}>
    <div className="px-5 pt-6 pb-5 text-white" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
      <div className="flex items-center gap-3"><FileSignature size={24} /><div><h1 className="font-bold text-xl">Associate Partner Agreement</h1><p className="text-xs text-blue-200">Secure digital execution</p></div></div>
    </div>
    <div className="px-4 space-y-4 mt-4">
      <div className="rounded-2xl bg-white p-3 shadow-sm" aria-label="Onboarding progress"><div className="flex w-full items-start">
        {steps.map(([label, done], index) => <div key={label} className="flex-1 text-center relative">
          {index < steps.length - 1 && <div className="absolute h-0.5 bg-slate-200 top-3 left-1/2 w-full" />}
          <span className="relative mx-auto w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: done ? '#166534' : label === 'Agreement' ? '#8b1a1a' : '#e2e8f0', color: done || label === 'Agreement' ? 'white' : '#64748b' }}>{done ? <Check size={13} /> : index + 1}</span>
          <span className="block mt-1 break-words text-[9px] text-slate-500 sm:text-[10px]">{label}</span>
        </div>)}
      </div></div>
      {error && <div role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-sm flex gap-2"><AlertCircle size={17} className="shrink-0" />{error}</div>}
      {state?.sandbox_mode && <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3 text-xs font-semibold">TEST MODE — sandbox outcomes are not legally signed and cannot activate a production account.</div>}

      {!agreement ? <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-900">Agreement not generated</h2><p className="text-sm text-slate-500 mt-1">Complete all onboarding requirements, then create your fixed agreement version.</p>
        {!state?.eligibility.eligible && <div className="mt-4 text-xs text-amber-800 bg-amber-50 rounded-xl p-3">
          {!!state?.eligibility.missing_profile_fields.length && <p>Profile: {state.eligibility.missing_profile_fields.join(', ')}</p>}
          {!!state?.eligibility.missing_documents.length && <p>Verified documents: {state.eligibility.missing_documents.join(', ')}</p>}
          {!state?.eligibility.kyc_complete && <p>KYC: Aadhaar verification is pending</p>}
        </div>}
        <button disabled={!state?.eligibility.eligible || busy} onClick={() => run(generateAgreement)} className="w-full mt-4 py-3 rounded-xl text-white font-bold disabled:opacity-40" style={{ background: '#0f1e3c' }}>{busy ? 'Generating…' : 'Generate Agreement'}</button>
      </div> : <>
        <div className="rounded-2xl bg-white p-4 shadow-sm flex items-start justify-between gap-3"><div><p className="text-xs text-slate-400">Agreement No.</p><p className="font-bold text-slate-900 text-sm break-all">{agreement.agreement_number}</p><p className="text-xs text-slate-500 mt-1">Version {agreement.agreement_version}</p></div><span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-slate-100 text-slate-700">{state?.status.replace(/_/g, ' ')}</span></div>
        {signed && <div className={`rounded-2xl p-5 ${sandboxSigned ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-900'}`}><div className="flex gap-3"><CheckCircle2 size={24} /><div><h2 className="font-bold">{sandboxSigned ? 'Sandbox Test Completed' : 'Agreement Digitally Signed'}</h2><p className="text-sm mt-1">{sandboxSigned ? 'This is test evidence only and is not a legal digital signature.' : 'The backend verified the ESP result and locked your signed agreement.'}</p>{agreement.esign_completed_at && <p className="text-xs mt-2">Completed {new Date(agreement.esign_completed_at).toLocaleString('en-IN')}</p>}</div></div></div>}
        {PENDING.has(state!.status) && <div className="rounded-2xl bg-blue-50 text-blue-900 p-5 flex gap-3"><Loader2 className="animate-spin shrink-0" size={22} /><div><h2 className="font-bold">Digital Signature Verification in Progress</h2><p className="text-sm mt-1">Success is shown only after backend verification.</p></div></div>}
        {FAILED.has(state!.status) && <div className="rounded-2xl bg-red-50 text-red-800 p-4"><h2 className="font-bold">Digital Signature Could Not Be Completed</h2><p className="text-sm mt-1">Your data and original agreement are safe. You can retry the same document.</p></div>}
        <div className="rounded-2xl bg-white overflow-hidden shadow-sm"><div className="p-3 flex items-center justify-between"><h2 className="font-bold text-sm text-slate-800">Agreement preview</h2><button onClick={download} className="text-xs font-semibold text-blue-700 flex items-center gap-1"><Download size={14} /> Download</button></div>{previewUrl ? <iframe title="Associate Partner Agreement PDF" src={previewUrl} className="w-full border-0 h-[430px]" /> : <div className="h-52 grid place-items-center text-xs text-slate-400">Preview unavailable. Use Download Agreement.</div>}</div>
        {!signed && !PENDING.has(state!.status) && <div className="rounded-2xl bg-white p-4 shadow-sm"><label className="flex gap-3 cursor-pointer items-start"><input type="checkbox" checked={agreement.consent_given || checked} disabled={agreement.consent_given} onChange={e => setChecked(e.target.checked)} className="mt-1 w-5 h-5 accent-[#8b1a1a]" /><span className="text-sm text-slate-700">I confirm that I have reviewed the Associate Partner Agreement and agree to digitally sign this document.</span></label><p className="text-[11px] text-slate-400 mt-2">Consent authorizes the eSign process; it is not itself a digital signature.</p><button disabled={!canInitiate || busy} onClick={initiate} className="w-full mt-4 py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}>{busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} {FAILED.has(state!.status) ? 'Retry Digital eSign' : 'Proceed to Digital eSign'}</button></div>}
        {state?.sandbox_mode && state.status === 'ESIGN_PENDING' && <button disabled={busy} onClick={() => run(completeSandboxEsign)} className="w-full py-3 rounded-xl border border-amber-500 text-amber-800 bg-amber-50 font-bold">Complete Sandbox Test (Not Legal)</button>}
        {PENDING.has(state!.status) && <button onClick={load} className="w-full py-3 rounded-xl bg-white text-slate-700 font-semibold flex justify-center items-center gap-2"><RefreshCw size={15} /> Check verified status</button>}
      </>}
    </div>
  </div>;
}
