import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, Eye, EyeOff, Lock, Mail, RefreshCw, CheckCircle } from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';
import { signInWithRole } from '../services/authService';
import { getErrorMessage } from '../services/apiErrors';

interface LoginScreenProps {
  onLogin: () => void;
  onBackToLanding: () => void;
}

function generateCaptcha() {
  const a = Math.floor(Math.random() * 12) + 2;
  const b = Math.floor(Math.random() * 10) + 1;
  const ops = ['+', '-', '*'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { question: `${a} ${op} ${b} = ?`, answer: String(answer) };
}

const floatingIcons = [
  { icon: '🛡️', x: '8%', y: '15%', delay: 0 },
  { icon: '🔒', x: '90%', y: '20%', delay: 0.3 },
  { icon: '👁️', x: '5%', y: '70%', delay: 0.6 },
  { icon: '📋', x: '88%', y: '65%', delay: 0.9 },
  { icon: '🏢', x: '15%', y: '85%', delay: 1.2 },
  { icon: '📡', x: '80%', y: '85%', delay: 1.5 },
];

const stats = [
  { label: 'Guards Deployed', value: 12400 },
  { label: 'Sites Secured', value: 3800 },
  { label: 'Cities Covered', value: 186 },
];

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / 80;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 20);
    return () => clearInterval(timer);
  }, [target]);
  return <>{count.toLocaleString()}+</>;
}

export default function LoginScreen({ onLogin, onBackToLanding }: LoginScreenProps) {
  const [email, setEmail] = useState(import.meta.env.VITE_DEMO_SUPERADMIN_EMAIL || '');
  const [password, setPassword] = useState(import.meta.env.VITE_DEMO_SUPERADMIN_PASSWORD || '');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const refreshCaptcha = () => {
    const nextCaptcha = generateCaptcha();
    setCaptcha(nextCaptcha);
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
      setError('Please fill all fields.');
      triggerShake();
      return;
    }
    if (captchaInput !== captcha.answer) {
      setError('Incorrect captcha. Please try again.');
      triggerShake();
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      await signInWithRole(email, password, 'super_admin');
    } catch (err) {
      setLoading(false);
      setError(getErrorMessage(err, 'Invalid credentials. Please try again.'));
      triggerShake();
      refreshCaptcha();
      return;
    }

    setLoading(false);
    setSuccess(true);
    setTimeout(onLogin, 1200);
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #f0f4f8 0%, #e8ecf0 50%, #f5f0f0 100%)' }}
      onMouseMove={handleMouseMove}
    >
      {/* Mouse-reactive glow */}
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(139,26,26,0.08) 0%, transparent 70%)',
          left: mousePos.x - 200,
          top: mousePos.y - 200,
        }}
        transition={{ type: 'tween', duration: 0.1 }}
      />

      {/* Background geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute rounded-full opacity-5"
          style={{ width: 500, height: 500, background: '#0f1e3c', top: -100, right: -100 }}
          animate={{ scale: [1, 1.1, 1], rotate: [0, 15, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute rounded-full opacity-5"
          style={{ width: 400, height: 400, background: '#8b1a1a', bottom: -100, left: -100 }}
          animate={{ scale: [1.1, 1, 1.1], rotate: [0, -10, 0] }}
          transition={{ duration: 7, repeat: Infinity }}
        />
      </div>

      {/* Floating icons */}
      {floatingIcons.map((item, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl select-none pointer-events-none opacity-20"
          style={{ left: item.x, top: item.y }}
          animate={{ y: [-8, 8, -8], rotate: [-5, 5, -5] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: item.delay }}
        >
          {item.icon}
        </motion.div>
      ))}

      <div className="w-full max-w-5xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side – Brand info */}
        <motion.div
          className="hidden lg:flex flex-col gap-8"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
        >
          <GranviaLogo size={56} textColor="#0f1e3c" accentColor="#8b1a1a" />
          <div>
            <h2 className="text-3xl font-bold text-gray-900 leading-tight">
              India's Premier<br />
              <span style={{ color: '#8b1a1a' }}>Service Partner</span><br />
              Management Platform
            </h2>
            <p className="mt-3 text-gray-500 text-sm leading-relaxed">
              Deploy, monitor, and manage your entire service partner workforce from one unified admin center.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map(s => (
              <motion.div
                key={s.label}
                className="rounded-xl p-4 text-center"
                style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
              >
                <div className="text-xl font-bold" style={{ color: '#0f1e3c' }}>
                  <AnimatedCounter target={s.value} />
                </div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Security badges */}
          <div className="flex gap-3">
            {['ISO Certified', 'PSARA Compliant', 'Data Encrypted'].map(badge => (
              <span
                key={badge}
                className="text-xs px-3 py-1 rounded-full border font-medium"
                style={{ borderColor: '#8b1a1a', color: '#8b1a1a', background: 'rgba(139,26,26,0.04)' }}
              >
                {badge}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Right side – Login card */}
        <div className="flex justify-center">
          <motion.div
            className="w-full max-w-sm"
            animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 60px rgba(15,30,60,0.12), 0 0 0 1px rgba(15,30,60,0.06)',
              }}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Card header */}
              <div
                className="px-8 py-6 text-center"
                style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
              >
                <div className="flex justify-center mb-3">
                  <GranviaLogo size={36} showText={false} iconColor="white" accentColor="#8b1a1a" />
                </div>
                <h3 className="text-white font-bold text-lg tracking-wide">Super Admin Login</h3>
                <p className="text-blue-200 text-xs mt-1 opacity-70">Authorized Personnel Only</p>
              </div>

              <div className="px-8 py-6">
                <AnimatePresence>
                  {success ? (
                    <motion.div
                      className="flex flex-col items-center justify-center py-8 gap-4"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <CheckCircle size={56} style={{ color: '#22c55e' }} />
                      </motion.div>
                      <p className="text-gray-700 font-semibold">Access Granted!</p>
                      <p className="text-gray-400 text-sm">Redirecting to dashboard...</p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                      {/* Email */}
                      <div className="relative">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block tracking-wide">EMAIL ADDRESS</label>
                        <div className="relative">
                          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full pl-9 pr-4 py-3 rounded-lg text-sm outline-none transition-all"
                            style={{
                              background: '#f7f8fa',
                              border: '1.5px solid #e2e8f0',
                              color: '#0f1e3c',
                            }}
                            onFocus={e => { e.target.style.borderColor = '#0f1e3c'; e.target.style.background = 'white'; }}
                            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f7f8fa'; }}
                            placeholder="admin@granvia.com"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block tracking-wide">PASSWORD</label>
                        <div className="relative">
                          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-3 rounded-lg text-sm outline-none transition-all"
                            style={{ background: '#f7f8fa', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }}
                            onFocus={e => { e.target.style.borderColor = '#0f1e3c'; e.target.style.background = 'white'; }}
                            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f7f8fa'; }}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Captcha */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block tracking-wide">SECURITY CHECK</label>
                        <div className="flex gap-2 items-center">
                          <div
                            className="flex-1 flex items-center justify-center rounded-lg py-2.5 font-bold text-sm select-none"
                            style={{ background: '#0f1e3c', color: 'white', fontFamily: 'monospace', letterSpacing: '0.1em' }}
                          >
                            {captcha.question}
                          </div>
                          <button
                            type="button"
                            onClick={refreshCaptcha}
                            className="p-2.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            style={{ background: '#f7f8fa', border: '1.5px solid #e2e8f0' }}
                          >
                            <RefreshCw size={16} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={captchaInput}
                          onChange={e => setCaptchaInput(e.target.value)}
                          className="w-full mt-2 px-3 py-3 rounded-lg text-sm outline-none"
                          style={{ background: '#f7f8fa', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }}
                          onFocus={e => { e.target.style.borderColor = '#0f1e3c'; }}
                          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
                          placeholder="Enter answer"
                        />
                      </div>

                      {/* Error */}
                      <AnimatePresence>
                        {error && (
                          <motion.div
                            className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                          >
                            {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Submit */}
                      <motion.button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {loading ? (
                            <motion.div
                              className="w-5 h-5 rounded-full border-2 border-white border-t-transparent"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            />
                          ) : (
                            <>
                              <Shield size={16} />
                              SECURE LOGIN
                            </>
                          )}
                        </span>
                        {/* Glow effect on hover */}
                        <motion.div
                          className="absolute inset-0 opacity-0"
                          style={{ background: 'linear-gradient(135deg, rgba(139,26,26,0.3), rgba(139,26,26,0))' }}
                          whileHover={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        />
                      </motion.button>
                    </form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <p className="text-center text-xs text-gray-400 mt-4">
              © 2024 Granvia Solutions. All rights reserved.
            </p>
            <button
              type="button"
              onClick={onBackToLanding}
              className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft size={14} />
              Main landing page
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
