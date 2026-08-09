import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, ShieldCheck, Copy } from 'lucide-react';
import { sendSmtpTestEmail, SmtpTestReport } from '../../services/smtpService';
import { getErrorMessage } from '../../services/apiErrors';

function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-auto max-h-[360px]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function SmtpTestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<SmtpTestReport | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setReport(null);

    if (!email.trim()) {
      setError('Enter a recipient email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendSmtpTestEmail(email);
      setMessage(res.message);
      setReport(res.report);
    } catch (err) {
      setError(getErrorMessage(err, 'SMTP test request failed.'));
    } finally {
      setLoading(false);
    }
  };

  const copyReport = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: 'linear-gradient(160deg, #0f1e3c 0%, #16284b 45%, #eef2f7 45%, #eef2f7 100%)' }}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-white">
          <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center">
                <Mail size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold">SMTP Test</h1>
                <p className="text-xs text-blue-200">Send a real email and inspect the provider response</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 mb-1 block">RECIPIENT EMAIL</span>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none"
                    style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f1e3c' }}
                  />
                </div>
              </label>

              {error && <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
              {message && <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">{message}</div>}

              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #166534, #15803d)' }}
              >
                {loading ? (
                  <>
                    <ShieldCheck size={16} className="animate-pulse" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send SMTP Test
                  </>
                )}
              </motion.button>
            </form>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Response</h2>
              {report && (
                <button onClick={copyReport} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
                  <Copy size={14} />
                  Copy JSON
                </button>
              )}
            </div>

            {report ? (
              <div className="space-y-3">
                <div className={`rounded-2xl border px-4 py-3 text-sm ${report.error ? 'border-red-100 bg-red-50 text-red-700' : 'border-green-100 bg-green-50 text-green-700'}`}>
                  {report.error ? report.error : 'SMTP provider accepted the test email.'}
                </div>
                <JsonView value={report} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Send a test message to inspect messageId, accepted recipients, and SMTP response details here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
