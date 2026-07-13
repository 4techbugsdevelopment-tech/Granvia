import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { resendEmailVerification } from '../../services/authService';
import { getErrorMessage } from '../../services/apiErrors';

export default function EmailVerificationPending({ email, onBackToLogin }: { email: string; onBackToLogin: () => void }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resend = async () => {
    setMessage('');
    setError('');
    setSubmitting(true);
    try {
      await resendEmailVerification(email);
      setMessage('Verification email sent.');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to resend verification email.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #eef2f7, #f8fafc)' }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 p-7 text-center">
        <MailCheck size={52} className="mx-auto text-blue-700 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Verify Your Email</h1>
        <p className="text-sm text-gray-500 mt-3">We have sent a verification link to your registered email address. Please verify your email to continue.</p>
        {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button disabled={submitting} onClick={resend} className="mt-6 w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>
          {submitting ? 'Sending...' : 'Resend Verification Email'}
        </button>
        <button onClick={onBackToLogin} className="mt-3 w-full py-3 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>
          Back to Login
        </button>
      </div>
    </div>
  );
}
