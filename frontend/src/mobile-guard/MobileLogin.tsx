import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, Shield, CheckCircle } from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';
import { signInWithRole, LoginOtpRequiredError } from '../services/authService';
import { getErrorMessage } from '../services/apiErrors';
import { LoginOtpDialog, ForgotPasswordDialog } from '../components/auth/OtpDialogs';

interface MobileLoginProps {
  onLogin: () => void;
  onBackToLanding: () => void;
}

export default function MobileLogin({ onLogin, onBackToLanding }: MobileLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [otpChallenge, setOtpChallenge] = useState<{ email: string; devOtp?: string } | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  const finishLogin = () => { setSuccess(true); setTimeout(onLogin, 1100); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your credentials.'); return; }
    setLoading(true);
    try {
      await signInWithRole(email, password, 'guard');
    } catch (err) {
      setLoading(false);
      if (err instanceof LoginOtpRequiredError) {
        setOtpChallenge({ email: err.email, devOtp: err.devOtp });
        return;
      }
      setError(getErrorMessage(err, 'Invalid credentials or account blocked.'));
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }
    setLoading(false);
    finishLogin();
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
          <p className="text-sm text-gray-400 mb-6">Sign in to your associate account</p>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                className="flex flex-col items-center justify-center py-10 gap-4"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <CheckCircle size={60} style={{ color: '#22c55e' }} />
                </motion.div>
                <p className="font-bold text-gray-800 text-lg">Login Successful!</p>
                <p className="text-gray-400 text-sm">Loading your dashboard...</p>
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

                <button type="button" onClick={() => setShowForgot(true)}
                  className="mx-auto block text-xs font-semibold text-gray-500 active:text-gray-800 pt-1">
                  Forgot password?
                </button>
                <p className="text-center text-xs text-gray-400 pt-2">
                  Only admin-registered associates can access this app.
                </p>
                <button
                  type="button"
                  onClick={onBackToLanding}
                  className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-gray-500 active:text-gray-800"
                >
                  <ArrowLeft size={14} />
                  Main landing page
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {otpChallenge && (
        <LoginOtpDialog
          email={otpChallenge.email}
          role="guard"
          onVerified={() => { setOtpChallenge(null); finishLogin(); }}
          onClose={() => setOtpChallenge(null)}
        />
      )}
      {showForgot && <ForgotPasswordDialog initialEmail={email} onClose={() => setShowForgot(false)} />}
    </div>
  );
}
