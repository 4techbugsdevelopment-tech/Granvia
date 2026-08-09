import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, CheckCircle, Mail } from 'lucide-react';
import { sendAadhaarOtp, verifyAadhaarOtp } from '../../services/aadhaarVerificationService';
import { getErrorMessage } from '../../services/apiErrors';

type Step = 'aadhaar' | 'otp' | 'success';

export default function AadhaarVerificationSlider({ onCompleted }: { onCompleted: () => void }) {
  const [step, setStep] = useState<Step>('aadhaar');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sendOtp = async () => {
    setError('');
    if (!/^\d{12}$/.test(aadhaarNumber.trim())) {
      setError('Enter a valid 12-digit Aadhaar number.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await sendAadhaarOtp(aadhaarNumber);
      setSentTo(result.sentTo);
      setStep('otp');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to send OTP.'));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter a valid 6-digit OTP.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyAadhaarOtp(otp);
      setStep('success');
      window.setTimeout(onCompleted, 1200);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to verify OTP.'));
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = step === 'aadhaar' ? 1 : step === 'otp' ? 2 : 3;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #eef2f7, #f8fafc)' }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
          <div className="flex items-center gap-3">
            <BadgeCheck size={24} />
            <div>
              <h1 className="font-bold text-lg">Aadhaar Verification</h1>
              <p className="text-xs text-blue-100">Complete verification to continue</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-5">
            {[1, 2, 3].map(item => (
              <div key={item} className="h-1.5 rounded-full" style={{ background: item <= stepIndex ? '#ffffff' : 'rgba(255,255,255,0.25)' }} />
            ))}
          </div>
        </div>

        <div className="p-6 min-h-80">
          <AnimatePresence mode="wait">
            {step === 'aadhaar' && (
              <motion.div key="aadhaar" initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }}>
                <h2 className="text-xl font-bold text-gray-900">Enter Aadhaar Number</h2>
                <p className="text-sm text-gray-500 mt-1 mb-5">An OTP will be sent to your registered email address.</p>
                <label className="block">
                  <span className="form-label">Aadhaar Number</span>
                  <input value={aadhaarNumber} onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" className="form-input" />
                </label>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                <button disabled={submitting} onClick={sendOtp} className="mt-5 w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>
                  {submitting ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }}>
                <Mail size={34} className="text-blue-700 mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Enter OTP</h2>
                <p className="text-sm text-gray-500 mt-1 mb-5">
                  A 6-digit OTP has been sent to <strong>{sentTo}</strong>. Valid for 10 minutes.
                </p>
                <label className="block">
                  <span className="form-label">OTP</span>
                  <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="form-input text-center tracking-widest text-xl" placeholder="••••••" />
                </label>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                <button disabled={submitting} onClick={verifyOtp} className="mt-5 w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#166534' }}>
                  {submitting ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button disabled={submitting} onClick={sendOtp} className="mt-3 w-full py-3 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>
                  Resend OTP
                </button>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" className="text-center py-8" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <CheckCircle size={58} className="mx-auto text-green-600 mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Verification Completed</h2>
                <p className="text-sm text-gray-500 mt-2">Aadhaar verified successfully.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
