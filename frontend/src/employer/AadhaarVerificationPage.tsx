import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { getAadhaarStatus, sendAadhaarOtp, verifyAadhaarOtp } from '../services/aadhaarVerificationService';

function statusBadge(status: string) {
  const s = status?.toLowerCase() ?? '';
  const green = ['active', 'verified', 'selected', 'approved', 'accepted', 'confirmed', 'paid', 'completed', 'joined'];
  const red = ['rejected', 'blocked', 'closed', 'cancelled', 'failed', 'inactive'];
  const isGreen = green.some(v => s.includes(v));
  const isRed = red.some(v => s.includes(v));
  const bg = isGreen ? '#dcfce7' : isRed ? '#fee2e2' : '#fef9c3';
  const color = isGreen ? '#166534' : isRed ? '#7c2d12' : '#854d0e';
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap capitalize" style={{ background: bg, color }}>{status}</span>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="form-label">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} className="form-input" />
    </label>
  );
}

export default function AadhaarVerificationPage({ onChanged, onVerified }: { onChanged: () => void; onVerified?: () => void }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'aadhaar' | 'otp'>('aadhaar');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAadhaarStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const state = status?.aadhaar_verification_status ?? 'pending';
  const isVerified = Boolean(status?.is_aadhaar_verified && state === 'verified');
  const selfServiceEnabled = status?.aadhaar_api_enabled !== false;

  const sendOtp = async () => {
    setError('');
    if (!/^\d{12}$/.test(aadhaarNumber.trim())) {
      setError('Enter a valid 12-digit Aadhaar number.');
      return;
    }
    setSending(true);
    try {
      const result = await sendAadhaarOtp(aadhaarNumber);
      setSentTo(result.sentTo);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP.');
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter a valid 6-digit OTP.');
      return;
    }
    setVerifying(true);
    try {
      await verifyAadhaarOtp(otp);
      await load();
      onChanged();
      onVerified?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify OTP.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Aadhaar Verification</h2>
            <p className="text-sm text-gray-500 mt-1">
              {selfServiceEnabled
                ? 'We send an OTP to your registered email address and mark Aadhaar verified after success.'
                : 'Aadhaar verification is handled manually by the Granvia team.'}
            </p>
          </div>
          {status && statusBadge(state)}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading status...</p>
        ) : isVerified ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-4 text-green-700">
              Aadhaar verified.{status.aadhaar_last_four ? <> Last four digits: <b>{status.aadhaar_last_four}</b></> : null}
            </div>
            <button onClick={() => { load(); onChanged(); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>
              Refresh status
            </button>
          </div>
        ) : !selfServiceEnabled ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 text-amber-900">
              <p className="font-semibold">Aadhaar verification required</p>
              <p className="text-sm mt-1">
                Please contact <b>admin@granvia.llc</b> to verify your Aadhaar.
                Once your Aadhaar is verified, you will be able to continue using your account.
              </p>
            </div>
            {status?.aadhaar_last_four ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                Last submitted Aadhaar ends in <b>{status.aadhaar_last_four}</b>.
              </div>
            ) : null}
            <button onClick={() => { load(); onChanged(); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>
              Refresh status
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {step === 'aadhaar' && (
              <>
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-4 text-amber-800">
                  <p className="font-semibold">Email OTP verification</p>
                  <p className="text-sm mt-1">Enter your Aadhaar number to receive a 6-digit code on your registered email address.</p>
                </div>
                <Input
                  label="Aadhaar Number"
                  value={aadhaarNumber}
                  onChange={v => setAadhaarNumber(v.replace(/\D/g, '').slice(0, 12))}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button onClick={sendOtp} disabled={sending} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>
                  {sending ? 'Sending OTP...' : 'Send OTP to Email'}
                </button>
              </>
            )}

            {step === 'otp' && (
              <>
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-4 text-blue-800">
                  <p className="font-semibold">OTP sent</p>
                  <p className="text-sm mt-1">We sent the verification code to <b>{sentTo}</b>. It will remain valid for 10 minutes.</p>
                </div>
                <Input
                  label="OTP"
                  value={otp}
                  onChange={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex flex-wrap gap-3">
                  <button onClick={verifyOtp} disabled={verifying} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#166534' }}>
                    {verifying ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button onClick={sendOtp} disabled={sending || verifying} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>
                    Resend OTP
                  </button>
                  <button onClick={() => { setStep('aadhaar'); setOtp(''); setError(''); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f8fafc', color: '#334155' }}>
                    Edit Aadhaar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
