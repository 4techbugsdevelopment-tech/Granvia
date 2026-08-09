import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, CheckCircle, Eye, EyeOff, Lock, Mail, RefreshCw, Shield, User, UserCheck } from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';
import {
  LoginOtpRequiredError,
  registerEmployer,
  registerGuard,
  signIn,
} from '../services/authService';
import { getErrorMessage } from '../services/apiErrors';
import { ForgotPasswordDialog, LoginOtpDialog, VerifyEmailDialog } from '../components/auth/OtpDialogs';
import { lookupIndianPincode } from '../services/pincodeService';

interface UniversalLoginProps {
  onLogin: () => void;
}

type AuthMode = 'login' | 'register';
type RegisterRole = 'employer' | 'guard';

const emptyRegister = {
  fullName: '',
  mobile: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  city: '',
  state: '',
  pincode: '',
};

function generateCaptcha() {
  const a = Math.floor(Math.random() * 12) + 2;
  const b = Math.floor(Math.random() * 10) + 1;
  const ops = ['+', '-', '*'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const left = op === '-' ? Math.max(a, b) : a;
  const right = op === '-' ? Math.min(a, b) : b;
  const answer = op === '+' ? left + right : op === '-' ? left - right : left * right;
  return { question: `${left} ${op} ${right} = ?`, answer: String(answer) };
}

function validatePassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 mb-1 block">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        <div className="[&_.register-input]:pl-10">{children}</div>
      </div>
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  icon,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: React.ReactNode;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 mb-1 block">{label}</span>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          inputMode={inputMode}
          maxLength={maxLength}
          className={`register-input w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm outline-none ${icon ? '' : ''}`}
          style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }}
        />
      </div>
    </label>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 mb-1 block">{label}</span>
      <div className="relative">
        <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="register-input w-full pl-10 pr-11 py-3.5 rounded-2xl text-sm outline-none"
          style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

function ActionButton({ label, disabled = false }: { label: string; disabled?: boolean }) {
  return (
    <motion.button
      type="submit"
      disabled={disabled}
      className="w-full py-4 rounded-2xl font-bold text-white text-sm tracking-wide flex items-center justify-center gap-2"
      style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
      whileTap={{ scale: 0.98 }}
    >
      {label}
    </motion.button>
  );
}

export default function UniversalLogin({ onLogin }: UniversalLoginProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [registerRole, setRegisterRole] = useState<RegisterRole>('employer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [otpChallenge, setOtpChallenge] = useState<{ email: string; devOtp?: string } | null>(null);
  const [verifyEmail, setVerifyEmail] = useState<{ email: string; devOtp?: string } | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [registerOtp, setRegisterOtp] = useState<{ email: string; devOtp?: string } | null>(null);
  const [register, setRegister] = useState(emptyRegister);

  useEffect(() => {
    const pincode = register.pincode.trim();
    if (pincode.length !== 6) return;

    const controller = new AbortController();
    let cancelled = false;

    lookupIndianPincode(pincode, controller.signal)
      .then(result => {
        if (cancelled || !result) return;
        setRegister(current => ({
          ...current,
          city: result.city,
          state: result.state,
        }));
      })
      .catch(() => {
        // Keep manual entry available if the lookup fails.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [register.pincode]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput('');
  };

  const updateRegister = (key: keyof typeof emptyRegister, value: string) => {
    setRegister(current => ({ ...current, [key]: value }));
  };

  const finishLogin = () => {
    setSuccess(true);
    setTimeout(onLogin, 1000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter your credentials.');
      triggerShake();
      return;
    }
    if (captchaInput.trim() !== captcha.answer) {
      setError('Incorrect security answer. Please try again.');
      triggerShake();
      refreshCaptcha();
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      finishLogin();
    } catch (err) {
      setLoading(false);
      if (err instanceof LoginOtpRequiredError) {
        setOtpChallenge({ email: err.email, devOtp: err.devOtp });
        return;
      }
      if ((err as any)?.response?.data?.code === 'email_unverified') {
        setVerifyEmail({ email: (err as any).response.data.email || email });
        return;
      }
      setError(getErrorMessage(err, 'Invalid credentials or account blocked.'));
      triggerShake();
      refreshCaptcha();
      return;
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');

    const emailValue = register.email.trim().toLowerCase();
    if (!register.fullName.trim() || !register.mobile.trim() || !emailValue || !register.password) {
      setRegisterError('Full name, mobile, email, and password are required.');
      return;
    }
    if (!validatePassword(register.password)) {
      setRegisterError('Password must be at least 8 characters and include one uppercase letter and one number.');
      return;
    }
    if (register.password !== register.confirmPassword) {
      setRegisterError('Password and confirm password must match.');
      return;
    }
    if (registerRole === 'employer' && !register.companyName.trim()) {
      setRegisterError('Company name is required for employer registration.');
      return;
    }

    setRegisterLoading(true);
    try {
      const res = registerRole === 'employer'
        ? await registerEmployer({
            contactPersonName: register.fullName.trim(),
            mobile: register.mobile.trim(),
            email: emailValue,
            password: register.password,
            city: register.city.trim(),
            state: register.state.trim(),
            pincode: register.pincode.trim(),
            companyName: register.companyName.trim(),
          })
        : await registerGuard({
            fullName: register.fullName.trim(),
            mobile: register.mobile.trim(),
            email: emailValue,
            password: register.password,
            city: register.city.trim(),
            state: register.state.trim(),
            pincode: register.pincode.trim(),
          });

      setRegisterOtp({ email: emailValue });
      setRegisterSuccess('Registration submitted. Verify the code sent to your email to activate the account.');
      setRegister(emptyRegister);
    } catch (err) {
      setRegisterError(getErrorMessage(err, 'Unable to create account.'));
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #f0f4f8 0%, #e8ecf0 100%)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="relative flex flex-col items-center justify-center py-12 flex-shrink-0 overflow-hidden" style={{ background: 'linear-gradient(160deg, #0f1e3c 0%, #1a2d50 100%)' }}>
        <motion.div
          className="absolute w-64 h-64 rounded-full opacity-10 pointer-events-none"
          style={{ background: '#8b1a1a', bottom: -60, right: -40 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'white', top: -30, left: -30 }}
          animate={{ scale: [1.1, 1, 1.1] }}
          transition={{ duration: 5, repeat: Infinity }}
        />

        <div className="relative z-10">
          <GranviaLogo size={44} showText={false} iconColor="white" accentColor="#8b1a1a" />
        </div>

        <div className="mt-4 text-center relative z-10">
          <h1 className="text-white font-bold text-xl tracking-widest" style={{ fontFamily: 'Georgia, serif' }}>
            GRANVIA
          </h1>
          <p className="text-xs tracking-widest mt-0.5" style={{ color: '#8b1a1a', letterSpacing: '0.2em' }}>
            UNIVERSAL LOGIN
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mobile-scroll">
        <motion.div className="px-5 pt-7 pb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 mb-5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setRegisterError(''); setRegisterSuccess(''); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${mode === 'login' ? 'text-white' : 'text-slate-600'}`}
                style={mode === 'login' ? { background: '#0f1e3c' } : { background: '#eef2f7' }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setRegisterError(''); setRegisterSuccess(''); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${mode === 'register' ? 'text-white' : 'text-slate-600'}`}
                style={mode === 'register' ? { background: '#0f1e3c' } : { background: '#eef2f7' }}
              >
                Register
              </button>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: '#0f1e3c' }}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {mode === 'login'
              ? 'Sign in and your portal opens automatically.'
              : 'Self-registration is available only for employer and associate partner accounts.'}
          </p>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div className="flex flex-col items-center justify-center py-10 gap-4" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                <CheckCircle size={60} style={{ color: '#22c55e' }} />
                <p className="font-bold text-gray-800 text-lg">Login Successful!</p>
                <p className="text-gray-400 text-sm">Loading your workspace...</p>
              </motion.div>
            ) : mode === 'login' ? (
              <motion.form
                key="login"
                onSubmit={handleLogin}
                animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                <Field label="Email Address" icon={<Mail size={16} />}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm outline-none"
                    style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }}
                  />
                </Field>

                <Field label="Password" icon={<Lock size={16} />}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3.5 rounded-2xl text-sm outline-none"
                    style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </Field>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-400 mb-1.5 block tracking-wide">SECURITY CHECK</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-center rounded-2xl py-3.5 font-bold text-sm select-none" style={{ background: '#0f1e3c', color: 'white', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                      {captcha.question}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCaptcha(generateCaptcha()); setCaptchaInput(''); }}
                      className="flex items-center justify-center rounded-2xl text-gray-400 active:text-gray-600"
                      style={{ width: 48, height: 48, background: 'white', border: '1.5px solid #e2e8f0' }}
                    >
                      <RefreshCw size={17} />
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={captchaInput}
                    onChange={e => setCaptchaInput(e.target.value)}
                    placeholder="Enter answer"
                    autoComplete="off"
                    className="w-full mt-2 px-4 py-3.5 rounded-2xl text-sm outline-none"
                    style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }}
                  />
                </label>

                <AnimatePresence>
                  {error && (
                    <motion.p className="text-red-500 text-xs px-1" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <ActionButton label={loading ? 'Signing In...' : 'Sign In'} disabled={loading} />
                <button type="button" onClick={() => setShowForgot(true)} className="mx-auto block text-xs font-semibold text-gray-500 active:text-gray-800 pt-1">
                  Forgot password?
                </button>
              </motion.form>
            ) : (
              <motion.form key="register" onSubmit={handleRegister} className="space-y-4">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">Register as</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegisterRole('employer')}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold border ${registerRole === 'employer' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      Employer
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterRole('guard')}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold border ${registerRole === 'guard' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      Associate Partner
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Only employers and associate partners can self-register. Admin, sales, and sub-admin accounts are created internally.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={registerRole === 'employer' ? 'Contact Person *' : 'Full Name *'}
                    value={register.fullName}
                    onChange={value => updateRegister('fullName', value)}
                    icon={registerRole === 'employer' ? <UserCheck size={14} /> : <User size={14} />}
                  />
                  <Input label="Mobile *" value={register.mobile} onChange={value => updateRegister('mobile', value)} icon={<UserCheck size={14} />} />
                  <Input label="Email *" value={register.email} onChange={value => updateRegister('email', value)} type="email" icon={<Mail size={14} />} />
                  <div className="sm:col-span-2">
                    <Input
                      label="Pincode"
                      value={register.pincode}
                      onChange={value => updateRegister('pincode', value.replace(/\D/g, '').slice(0, 6))}
                      icon={<Building2 size={14} />}
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </div>
                  <Input label="City" value={register.city} onChange={value => updateRegister('city', value)} icon={<Building2 size={14} />} />
                  <Input label="State" value={register.state} onChange={value => updateRegister('state', value)} icon={<Building2 size={14} />} />
                  {registerRole === 'employer' && (
                    <div className="sm:col-span-2">
                      <Input label="Company Name *" value={register.companyName} onChange={value => updateRegister('companyName', value)} icon={<Building2 size={14} />} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <PasswordInput
                    label="Password *"
                    value={register.password}
                    onChange={value => updateRegister('password', value)}
                    visible={showRegisterPassword}
                    onToggle={() => setShowRegisterPassword(current => !current)}
                  />
                  <PasswordInput
                    label="Confirm Password *"
                    value={register.confirmPassword}
                    onChange={value => updateRegister('confirmPassword', value)}
                    visible={showRegisterConfirmPassword}
                    onToggle={() => setShowRegisterConfirmPassword(current => !current)}
                  />
                </div>

                <AnimatePresence>
                  {registerError && (
                    <motion.p className="text-red-500 text-xs px-1" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {registerError}
                    </motion.p>
                  )}
                </AnimatePresence>
                {registerSuccess && (
                  <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                    {registerSuccess}
                  </div>
                )}

                <ActionButton label={registerLoading ? 'Submitting...' : `Register ${registerRole === 'employer' ? 'Employer' : 'Associate Partner'}`} disabled={registerLoading} />
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {otpChallenge && (
        <LoginOtpDialog
          email={otpChallenge.email}
          onVerified={() => {
            setOtpChallenge(null);
            finishLogin();
          }}
          onClose={() => setOtpChallenge(null)}
        />
      )}

      {showForgot && <ForgotPasswordDialog initialEmail={email} onClose={() => setShowForgot(false)} />}

      {verifyEmail && (
        <VerifyEmailDialog
          email={verifyEmail.email}
          onVerified={() => {
            setVerifyEmail(null);
            setMode('login');
            setEmail(verifyEmail.email);
            setSuccess(false);
            setError('Email verified — please sign in.');
          }}
          onClose={() => setVerifyEmail(null)}
        />
      )}

      {registerOtp && (
        <VerifyEmailDialog
          email={registerOtp.email}
          onVerified={() => {
            setRegisterOtp(null);
            setMode('login');
            setEmail(registerOtp.email);
            setSuccess(false);
            setError('Email verified — please sign in.');
          }}
          onClose={() => setRegisterOtp(null)}
        />
      )}
    </div>
  );
}
