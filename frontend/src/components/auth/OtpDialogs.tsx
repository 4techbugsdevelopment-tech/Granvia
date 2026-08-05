// Reusable email-OTP dialogs shared by every portal login/registration screen:
//   • LoginOtpDialog     — 2FA step after password (AUTH_LOGIN_2FA)
//   • VerifyEmailDialog  — activate a new account with the signup code
//   • ForgotPasswordDialog — request a reset code and set a new password
import { useState } from 'react';
import { X, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import {
  verifyLoginOtp,
  verifyEmailOtp,
  resendEmailOtp,
  requestPasswordOtp,
  resetPassword,
} from '../../services/authService';
import { getErrorMessage } from '../../services/apiErrors';
import { UserRole } from '../../lib/apiTypes';

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(15,30,60,0.55)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Header({ icon, title, subtitle, onClose }: { icon: React.ReactNode; title: string; subtitle: string; onClose?: () => void }) {
  return (
    <div className="px-6 py-5 text-white relative" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white"><X size={18} /></button>
      )}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>{icon}</div>
        <div>
          <h3 className="font-bold text-base leading-tight">{title}</h3>
          <p className="text-blue-200 text-xs mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { background: '#f7f8fa', border: '1.5px solid #e2e8f0', color: '#0f1e3c' } as const;
const codeInput = 'w-full px-3 py-3 rounded-lg text-center text-lg font-bold tracking-[0.4em] outline-none';
const primaryBtn = 'w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50';

function DevHint({ otp }: { otp?: string }) {
  if (!otp) return null;
  return (
    <p className="text-[11px] text-center text-amber-700 bg-amber-50 border border-amber-100 rounded-lg py-2">
      Dev mode — code: <b className="tracking-widest">{otp}</b>
    </p>
  );
}

// ── Login 2FA ─────────────────────────────────────────────────────────────────

export function LoginOtpDialog({ email, role, devOtp, onVerified, onClose }: {
  email: string; role?: UserRole; devOtp?: string; onVerified: () => void; onClose: () => void;
}) {
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (otp.length < 4) return;
    setBusy(true); setError('');
    try {
      await verifyLoginOtp(email, otp, role);
      onVerified();
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid code. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <Header icon={<ShieldCheck size={20} />} title="Verify it's you" subtitle={`Code sent to ${email}`} onClose={onClose} />
      <div className="px-6 py-5 space-y-3">
        <DevHint otp={devOtp} />
        <input autoFocus inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className={codeInput} style={inputStyle} placeholder="••••••" />
        {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
        <button onClick={submit} disabled={busy || otp.length < 4} className={primaryBtn} style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
          {busy && <Loader2 size={15} className="animate-spin" />}{busy ? 'Verifying…' : 'Verify & sign in'}
        </button>
      </div>
    </Backdrop>
  );
}

// ── Signup email verification ───────────────────────────────────────────────────

export function VerifyEmailDialog({ email, devOtp, onVerified, onClose }: {
  email: string; devOtp?: string; onVerified: () => void; onClose?: () => void;
}) {
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [hint, setHint] = useState(devOtp);

  const submit = async () => {
    if (otp.length < 4) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await verifyEmailOtp(email, otp);
      onVerified();
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid or expired code.'));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(''); setMessage('');
    try {
      const res = await resendEmailOtp(email);
      setHint(res.dev_otp);
      setMessage('A new code has been sent.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not resend the code.'));
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <Header icon={<ShieldCheck size={20} />} title="Verify your email" subtitle={email} onClose={onClose} />
      <div className="px-6 py-5 space-y-3">
        <p className="text-xs text-gray-500">Enter the 6-digit code we emailed you to activate your account.</p>
        <DevHint otp={hint} />
        <input autoFocus inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className={codeInput} style={inputStyle} placeholder="••••••" />
        {message && <p className="text-green-700 text-xs bg-green-50 px-3 py-2 rounded-lg border border-green-100">{message}</p>}
        {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
        <button onClick={submit} disabled={busy || otp.length < 4} className={primaryBtn} style={{ background: 'linear-gradient(135deg, #166534, #15803d)' }}>
          {busy && <Loader2 size={15} className="animate-spin" />}{busy ? 'Verifying…' : 'Verify email'}
        </button>
        <button onClick={resend} className="w-full text-xs font-semibold text-gray-500 hover:text-gray-800 py-1">Resend code</button>
      </div>
    </Backdrop>
  );
}

// ── Forgot / reset password ─────────────────────────────────────────────────────

export function ForgotPasswordDialog({ initialEmail = '', onClose }: { initialEmail?: string; onClose: () => void }) {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState<string | undefined>();

  const request = async () => {
    if (!email) { setError('Enter your email.'); return; }
    setBusy(true); setError('');
    try {
      const res = await requestPasswordOtp(email);
      setHint(res.dev_otp);
      setStep('reset');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send a reset code.'));
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (otp.length < 4 || password.length < 8) { setError('Enter the code and a password of at least 8 characters.'); return; }
    setBusy(true); setError('');
    try {
      await resetPassword(email, otp, password);
      setStep('done');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reset your password.'));
    } finally { setBusy(false); }
  };

  return (
    <Backdrop onClose={onClose}>
      <Header icon={<KeyRound size={20} />} title="Reset password" subtitle={step === 'done' ? 'All set' : email || 'Enter your email'} onClose={onClose} />
      <div className="px-6 py-5 space-y-3">
        {step === 'request' && (
          <>
            <label className="text-xs font-semibold text-gray-500 block">EMAIL ADDRESS</label>
            <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-3 rounded-lg text-sm outline-none" style={inputStyle} placeholder="you@granvia.com" />
            {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
            <button onClick={request} disabled={busy} className={primaryBtn} style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
              {busy && <Loader2 size={15} className="animate-spin" />}{busy ? 'Sending…' : 'Send reset code'}
            </button>
          </>
        )}

        {step === 'reset' && (
          <>
            <p className="text-xs text-gray-500">Enter the code sent to <b>{email}</b> and choose a new password.</p>
            <DevHint otp={hint} />
            <input autoFocus inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={codeInput} style={inputStyle} placeholder="••••••" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-3 rounded-lg text-sm outline-none" style={inputStyle} placeholder="New password (min 8 chars)" />
            {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
            <button onClick={reset} disabled={busy} className={primaryBtn} style={{ background: 'linear-gradient(135deg, #166534, #15803d)' }}>
              {busy && <Loader2 size={15} className="animate-spin" />}{busy ? 'Updating…' : 'Reset password'}
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="flex flex-col items-center py-4 gap-2">
              <ShieldCheck size={44} style={{ color: '#22c55e' }} />
              <p className="font-semibold text-gray-800 text-sm">Password updated</p>
              <p className="text-xs text-gray-400 text-center">You can now sign in with your new password.</p>
            </div>
            <button onClick={onClose} className={primaryBtn} style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>Back to sign in</button>
          </>
        )}
      </div>
    </Backdrop>
  );
}
