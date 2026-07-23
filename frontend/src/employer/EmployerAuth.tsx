import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, Briefcase, Building2, ClipboardList, Eye, EyeOff, HardHat, Lock, Mail, MapPin, Phone, Shield, User, UserCheck, Users, Wallet } from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';
import { EmployerFieldKind, getInputMode, sanitizeEmployerInput } from '../lib/inputSanitizers';
import EmailVerificationPending from '../pages/auth/EmailVerificationPending';
import { registerEmployer, signInWithRole } from '../services/authService';
import { getErrorMessage } from '../services/apiErrors';

interface EmployerAuthProps {
  onLogin: () => void;
  onBackToLanding: () => void;
}

type Mode = 'login' | 'register';

const initialRegister = {
  companyName: '',
  contactPersonName: '',
  mobile: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyAddress: '',
  city: '',
  state: '',
  pincode: '',
  businessType: '',
  gstNumber: '',
  panNumber: '',
  website: '',
};

function validatePassword(password: string) {
  return password.length >= 8 && Boolean(password.match(/[A-Z]/)) && Boolean(password.match(/\d/));
}

export default function EmployerAuth({ onLogin, onBackToLanding }: EmployerAuthProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState(import.meta.env.VITE_DEMO_EMPLOYER_EMAIL || '');
  const [loginPassword, setLoginPassword] = useState(import.meta.env.VITE_DEMO_EMPLOYER_PASSWORD || '');
  const [showPassword, setShowPassword] = useState(false);
  const [register, setRegister] = useState(initialRegister);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateRegister = (key: keyof typeof initialRegister, value: string, kind: EmployerFieldKind = 'text') => {
    setRegister(current => ({ ...current, [key]: sanitizeEmployerInput(value, kind) }));
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signInWithRole(identifier, loginPassword, 'employer');
      onLogin();
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid employer credentials or blocked account.'));
      setSubmitting(false);
      return;
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (register.password && !validatePassword(register.password)) {
      setError('Password must be at least 8 characters and include one uppercase letter and one number.');
      return;
    }
    if (register.password !== register.confirmPassword) {
      setError('Password and confirm password must match.');
      return;
    }
    setSubmitting(true);
    try {
      await registerEmployer({
        companyName: register.companyName,
        contactPersonName: register.contactPersonName,
        mobile: register.mobile,
        email: register.email,
        password: register.password,
        companyAddress: register.companyAddress,
        city: register.city,
        state: register.state,
        pincode: register.pincode,
        businessType: register.businessType,
        gstNumber: register.gstNumber,
        panNumber: register.panNumber,
        website: register.website,
      });
      // Email verification disabled — sign in immediately after registration
      await signInWithRole(register.email, register.password, 'employer');
      onLogin();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create employer account.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingEmail) {
    return <EmailVerificationPending email={pendingEmail} onBackToLogin={() => { setPendingEmail(''); setMode('login'); }} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-4" style={{ background: 'linear-gradient(135deg, #eef2f7, #f8fafc)' }}>
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <motion.div
          className="hidden lg:flex flex-col justify-between rounded-2xl p-8 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {/* Floating background icons */}
          {[
            { Icon: HardHat,      x: '8%',  y: '12%', size: 28, delay: 0,    duration: 6  },
            { Icon: Shield,       x: '78%', y: '8%',  size: 22, delay: 1.2,  duration: 7  },
            { Icon: Users,        x: '60%', y: '22%', size: 26, delay: 0.5,  duration: 8  },
            { Icon: Briefcase,    x: '20%', y: '35%', size: 20, delay: 2,    duration: 6.5},
            { Icon: BadgeCheck,   x: '85%', y: '40%', size: 24, delay: 0.8,  duration: 7.5},
            { Icon: ClipboardList,x: '5%',  y: '55%', size: 22, delay: 1.5,  duration: 9  },
            { Icon: MapPin,       x: '70%', y: '60%', size: 20, delay: 3,    duration: 6  },
            { Icon: UserCheck,    x: '40%', y: '70%', size: 26, delay: 0.3,  duration: 8  },
            { Icon: Wallet,       x: '15%', y: '80%', size: 22, delay: 2.5,  duration: 7  },
            { Icon: Building2,    x: '82%', y: '78%', size: 24, delay: 1,    duration: 6.5},
            { Icon: HardHat,      x: '50%', y: '88%', size: 18, delay: 1.8,  duration: 9  },
            { Icon: Shield,       x: '30%', y: '18%', size: 18, delay: 3.5,  duration: 7  },
          ].map(({ Icon, x, y, size, delay, duration }, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{ left: x, top: y }}
              animate={{ y: [0, -14, 0], opacity: [0.07, 0.16, 0.07] }}
              transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Icon size={size} color="white" />
            </motion.div>
          ))}

          <GranviaLogo size={48} textColor="white" accentColor="#8b1a1a" />
          <div>
            <p className="text-blue-200 text-sm mb-2">Employer Portal</p>
            <h1 className="text-3xl font-bold leading-tight">Hire verified associates across your company sites.</h1>
            <p className="text-blue-100 text-sm mt-4 max-w-md">Post jobs, manage applicants, verify attendance, and track payments from one role-protected company workspace.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {['Sites', 'Hiring', 'Payments'].map(item => (
              <div key={item} className="rounded-xl py-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="text-xs text-blue-200">{item}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'white', boxShadow: '0 20px 60px rgba(15,30,60,0.12)' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#0f1e3c' }}>
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{mode === 'login' ? 'Employer Login' : 'Company Registration'}</h2>
                <p className="text-xs text-gray-400">Granvia company workspace</p>
              </div>
            </div>
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}
              className="text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ background: '#f1f5f9', color: '#0f1e3c' }}
            >
              {mode === 'login' ? 'Register' : 'Login'}
            </button>
          </div>

          <div className="p-5">
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email or Mobile" icon={<Mail size={16} />}>
                  <input value={identifier} onChange={e => setIdentifier(e.target.value)} className="form-input" placeholder="company@example.com" />
                </Field>
                <Field label="Password" icon={<Lock size={16} />}>
                  <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} type={showPassword ? 'text' : 'password'} className="form-input pr-10" placeholder="Password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </Field>
                <Message error={error} success={success} />
                <SubmitButton label={submitting ? 'Signing In...' : 'Login to Employer Dashboard'} disabled={submitting} />
                <LandingLink onClick={onBackToLanding} />
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <TextInput label="Company Name *" kind="name" value={register.companyName} onChange={value => updateRegister('companyName', value, 'name')} />
                  <TextInput label="Business Type *" kind="name" value={register.businessType} onChange={value => updateRegister('businessType', value, 'name')} />
                  <TextInput label="Contact Person *" kind="name" value={register.contactPersonName} onChange={value => updateRegister('contactPersonName', value, 'name')} />
                  <TextInput label="Mobile *" kind="mobile" value={register.mobile} onChange={value => updateRegister('mobile', value, 'mobile')} />
                  <TextInput label="Email *" value={register.email} onChange={value => updateRegister('email', value)} />
                  <TextInput label="Pincode *" kind="pincode" value={register.pincode} onChange={value => updateRegister('pincode', value, 'pincode')} />
                  <TextInput label="City *" kind="cityState" value={register.city} onChange={value => updateRegister('city', value, 'cityState')} />
                  <TextInput label="State *" kind="cityState" value={register.state} onChange={value => updateRegister('state', value, 'cityState')} />
                  <TextInput label="GST Number" kind="gst" value={register.gstNumber} onChange={value => updateRegister('gstNumber', value, 'gst')} />
                  <TextInput label="PAN Number" kind="pan" value={register.panNumber} onChange={value => updateRegister('panNumber', value, 'pan')} />
                  <TextInput label="Website" kind="url" value={register.website} onChange={value => updateRegister('website', value, 'url')} />
                  <TextInput label="Company Address *" value={register.companyAddress} onChange={value => updateRegister('companyAddress', value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextInput label="Password *" type="password" value={register.password} onChange={value => updateRegister('password', value)} />
                  <TextInput label="Confirm Password *" type="password" value={register.confirmPassword} onChange={value => updateRegister('confirmPassword', value)} />
                </div>
                <Message error={error} success={success} />
                <SubmitButton label={submitting ? 'Submitting...' : 'Register Company'} disabled={submitting} />
                <LandingLink onClick={onBackToLanding} />
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function LandingLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800"
    >
      <ArrowLeft size={14} />
      Main landing page
    </button>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 mb-1 block">{label}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        <div className="[&_.form-input]:pl-9">{children}</div>
      </div>
    </label>
  );
}

function TextInput({ label, value, onChange, type = 'text', kind = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string; kind?: EmployerFieldKind }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 mb-1 block">{label}</span>
      <div className="relative">
        {label.includes('Person') && <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        {label.includes('Mobile') && <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          inputMode={getInputMode(kind)}
          maxLength={kind === 'mobile' ? 10 : kind === 'pincode' ? 6 : kind === 'gst' ? 15 : kind === 'pan' ? 10 : undefined}
          className={`form-input ${label.includes('Person') || label.includes('Mobile') ? 'pl-9' : ''}`}
        />
      </div>
    </label>
  );
}

function Message({ error, success }: { error: string; success: string }) {
  if (error) return <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>;
  if (success) return <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{success}</div>;
  return null;
}

function SubmitButton({ label, disabled = false }: { label: string; disabled?: boolean }) {
  return (
    <motion.button
      type="submit"
      disabled={disabled}
      className="w-full py-3 rounded-xl font-bold text-white text-sm"
      style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
      whileTap={{ scale: 0.98 }}
    >
      {label}
    </motion.button>
  );
}
