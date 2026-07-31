// Single shared login for the universal mobile app.
// The backend resolves the account role from the database after email/password
// auth, then the shell opens the matching portal automatically.
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, RefreshCw, Shield, CheckCircle } from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';
import { signIn } from '../services/authService';
import { getErrorMessage } from '../services/apiErrors';

interface UniversalLoginProps {
  onLogin: () => void;
}

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

export default function UniversalLogin({ onLogin }: UniversalLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput('');
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    } catch (err) {
      setLoading(false);
      setError(getErrorMessage(err, 'Invalid credentials or account blocked.'));
      triggerShake();
      refreshCaptcha();
      return;
    }
    setLoading(false);
    setSuccess(true);
    setTimeout(onLogin, 1000);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #f0f4f8 0%, #e8ecf0 100%)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* Top decorative area */}
      <div
        className="relative flex flex-col items-center justify-center py-12 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #0f1e3c 0%, #1a2d50 100%)' }}
      >
        <motion.div
          className="absolute w-64 h-64 rounded-full opacity-10"
          style={{ background: '#8b1a1a', bottom: -60, right: -40 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-48 h-48 rounded-full opacity-10"
          style={{ background: 'white', top: -30, left: -30 }}
          animate={{ scale: [1.1, 1, 1.1] }}
          transition={{ duration: 5, repeat: Infinity }}
        />

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="relative z-10"
        >
          <GranviaLogo size={44} showText={false} iconColor="white" accentColor="#8b1a1a" />
        </motion.div>

        <motion.div
          className="mt-4 text-center relative z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h1 className="text-white font-bold text-xl tracking-widest" style={{ fontFamily: 'Georgia, serif' }}>
            GRANVIA
          </h1>
          <p className="text-xs tracking-widest mt-0.5" style={{ color: '#8b1a1a', letterSpacing: '0.2em' }}>
            ASSOCIATE APP
          </p>
        </motion.div>
      </div>

      {/* Login form */}
      <div className="flex-1 overflow-y-auto mobile-scroll">
        <motion.div
          className="px-5 pt-7 pb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold mb-1" style={{ color: '#0f1e3c' }}>Welcome Back</h2>
          <p className="text-sm text-gray-400 mb-6">Sign in — your portal opens automatically</p>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                className="flex flex-col items-center justify-center py-10 gap-4"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                  <CheckCircle size={60} style={{ color: '#22c55e' }} />
                </motion.div>
                <p className="font-bold text-gray-800 text-lg">Login Successful!</p>
                <p className="text-gray-400 text-sm">Loading your workspace...</p>
              </motion.div>
            ) : (
              <motion.form
                onSubmit={handleSubmit}
                animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block tracking-wide">EMAIL ADDRESS</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm outline-none"
                      style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block tracking-wide">PASSWORD</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-3.5 rounded-2xl text-sm outline-none"
                      style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block tracking-wide">SECURITY CHECK</label>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 flex items-center justify-center rounded-2xl py-3.5 font-bold text-sm select-none"
                      style={{ background: '#0f1e3c', color: 'white', fontFamily: 'monospace', letterSpacing: '0.1em' }}
                    >
                      {captcha.question}
                    </div>
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      aria-label="Refresh security question"
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
                    style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      className="text-red-500 text-xs px-1"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <p className="text-center text-xs text-gray-400 pt-1">
                  Enter your email and password. Your role will be detected automatically.
                </p>

                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl font-bold text-white text-sm tracking-wide flex items-center justify-center gap-2 mt-2 mobile-touch-interactive"
                  style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  {loading ? (
                    <motion.div
                      className="w-5 h-5 rounded-full border-2 border-white border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <>
                      <Shield size={16} />
                      SIGN IN
                    </>
                  )}
                </motion.button>

                <p className="text-center text-xs text-gray-400 pt-2">
                  Associates, Employers, Sales &amp; Sub Admins can sign in here.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
