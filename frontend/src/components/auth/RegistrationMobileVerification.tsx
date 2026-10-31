import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Phone, X } from 'lucide-react';
import {
  getRegistrationMobileOtpConfig,
  requestRegistrationMobileOtp,
  verifyRegistrationMobileOtp,
} from '../../services/authService';
import { getErrorMessage } from '../../services/apiErrors';
import { indianMobileError, normalizeIndianMobile } from '../../lib/formValidation';

export type RegistrationMobileVerificationValue = {
  mobile: string;
  registrationSessionId: string;
  mobileVerificationGrant: string;
};

type ConfigStatus = 'loading' | 'enabled' | 'disabled' | 'error';
type BusyState = 'request' | 'verify' | '';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onVerificationChange: (value: RegistrationMobileVerificationValue | null) => void;
  error?: string;
  background?: string;
};

function retryAfterSeconds(error: unknown) {
  if (!error || typeof error !== 'object' || !('response' in error)) return 0;
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object' || !('data' in response)) return 0;
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || !('retry_after' in data)) return 0;
  return Number((data as { retry_after?: number | string }).retry_after ?? 0);
}

export default function RegistrationMobileVerification({
  value,
  onChange,
  onVerificationChange,
  error,
  background = 'white',
}: Props) {
  const inputId = useId();
  const [configStatus, setConfigStatus] = useState<ConfigStatus>('loading');
  const [modalOpen, setModalOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [verifiedMobile, setVerifiedMobile] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [busy, setBusy] = useState<BusyState>('');
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const mobile = normalizeIndianMobile(value);
  const verified = Boolean(verifiedMobile && verifiedMobile === mobile);

  useEffect(() => {
    getRegistrationMobileOtpConfig()
      .then(config => setConfigStatus(config.enabled ? 'enabled' : 'disabled'))
      .catch(() => setConfigStatus('error'));
  }, []);

  useEffect(() => {
    if (!resendAt) {
      setCountdown(0);
      return;
    }
    const update = () => setCountdown(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const resetVerification = () => {
    setOtp('');
    setSessionId('');
    setVerifiedMobile('');
    setMaskedMobile('');
    setMessage('');
    setLocalError('');
    setResendAt(0);
    setModalOpen(false);
    onVerificationChange(null);
  };

  const changeMobile = (raw: string) => {
    const next = normalizeIndianMobile(raw).slice(0, 10);
    if (next !== mobile) resetVerification();
    onChange(next);
  };

  const requestCode = async (resend = false) => {
    const validationMessage = indianMobileError(mobile);
    if (validationMessage) {
      setLocalError(validationMessage);
      return;
    }
    if (configStatus !== 'enabled') {
      setLocalError('Mobile verification is currently unavailable. Please refresh and try again.');
      return;
    }

    setBusy('request');
    setLocalError('');
    setMessage('');
    try {
      const result = await requestRegistrationMobileOtp(mobile, resend ? sessionId || undefined : undefined);
      setSessionId(result.registration_session_id);
      setMaskedMobile(result.masked_mobile);
      setResendAt(Date.now() + result.resend_after * 1000);
      setMessage(result.dev_otp
        ? `Code sent to ${result.masked_mobile}. Development code: ${result.dev_otp}`
        : `A six-digit verification code was sent to ${result.masked_mobile}.`);
      setOtp('');
      setModalOpen(true);
    } catch (requestError) {
      setLocalError(getErrorMessage(requestError, 'Unable to send the verification code.'));
      const retryAfter = retryAfterSeconds(requestError);
      if (retryAfter > 0) setResendAt(Date.now() + retryAfter * 1000);
    } finally {
      setBusy('');
    }
  };

  const openVerification = () => {
    if (verified) return;
    if (sessionId) {
      setModalOpen(true);
      return;
    }
    void requestCode();
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId || !/^\d{6}$/.test(otp)) {
      setLocalError('Enter the 6-digit verification code.');
      return;
    }

    setBusy('verify');
    setLocalError('');
    try {
      const result = await verifyRegistrationMobileOtp({ mobile, registrationSessionId: sessionId, otp });
      const verification = {
        mobile,
        registrationSessionId: sessionId,
        mobileVerificationGrant: result.mobile_verification_grant,
      };
      setVerifiedMobile(mobile);
      setMessage('Mobile number verified.');
      setOtp('');
      onVerificationChange(verification);
      setModalOpen(false);
    } catch (verifyError) {
      setLocalError(getErrorMessage(verifyError, 'The verification code is invalid or expired.'));
    } finally {
      setBusy('');
    }
  };

  const availabilityMessage = configStatus === 'loading'
    ? 'Loading mobile verification…'
    : configStatus === 'disabled'
      ? 'Mobile verification is disabled on the server.'
      : configStatus === 'error'
        ? 'Mobile verification settings could not be loaded.'
        : '';

  return (
    <div className="block">
      <label htmlFor={inputId} className="mb-1 block text-xs font-semibold text-gray-500">Mobile *</label>
      <div className="relative">
        <Phone size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          id={inputId}
          type="tel"
          value={value}
          onChange={event => changeMobile(event.target.value)}
          inputMode="numeric"
          autoComplete="tel"
          maxLength={10}
          className="register-input w-full rounded-2xl py-3.5 pl-10 pr-24 text-sm outline-none"
          style={{ background, border: `1.5px solid ${error || localError ? '#ef4444' : verified ? '#16a34a' : '#e2e8f0'}`, color: '#0f1e3c' }}
        />
        <button
          type="button"
          onClick={openVerification}
          disabled={configStatus !== 'enabled' || busy === 'request' || verified}
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${verified ? 'bg-green-700' : 'bg-slate-900'}`}
        >
          {verified ? <span className="inline-flex items-center gap-1"><CheckCircle size={13} /> Verified</span> : busy === 'request' ? 'Sending…' : 'Verify'}
        </button>
      </div>
      {(error || localError) && <span className="mt-1 block text-xs font-medium text-red-500" role="alert">{error || localError}</span>}
      {!error && !localError && availabilityMessage && <span className="mt-1 block text-xs text-gray-500">{availabilityMessage}</span>}

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/60 p-4 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget && busy === '') setModalOpen(false); }}>
          <form onSubmit={verifyCode} role="dialog" aria-modal="true" aria-labelledby="mobile-verification-title" className="mx-auto my-16 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="mobile-verification-title" className="text-lg font-bold text-slate-900">Verify mobile number</h2>
                <p className="mt-1 text-xs text-slate-500">Enter the OTP sent to {maskedMobile || mobile}.</p>
              </div>
              <button type="button" disabled={busy !== ''} onClick={() => setModalOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50" aria-label="Close mobile verification">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              {message && <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700" aria-live="polite">{message}</p>}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Six-digit verification code</span>
                <input
                  autoFocus
                  value={otp}
                  onChange={event => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setLocalError(''); }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Enter OTP"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg tracking-[0.35em] outline-none focus:border-slate-500"
                />
              </label>
              {localError && <p className="text-xs text-red-600" role="alert">{localError}</p>}
              <button
                type="button"
                onClick={() => void requestCode(true)}
                disabled={busy !== '' || countdown > 0}
                className="text-xs font-semibold text-blue-700 disabled:text-slate-400"
              >
                {busy === 'request' ? 'Sending…' : countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </button>
            </div>
            <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button type="button" disabled={busy !== ''} onClick={() => setModalOpen(false)} className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={busy !== '' || otp.length !== 6} className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === 'verify' ? 'Verifying…' : 'Verify OTP'}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
