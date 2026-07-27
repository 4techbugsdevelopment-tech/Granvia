import { useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, FlaskConical, Loader2 } from 'lucide-react';
import { createSurepassMockSession, SurepassMockResult } from '../../services/surepassTestService';

function errorMessage(error: unknown): string {
  const value = error as {
    response?: { data?: { message?: string; upstream_response?: unknown } };
    message?: string;
  };
  const message = value.response?.data?.message ?? value.message ?? 'The request failed.';
  const upstream = value.response?.data?.upstream_response;
  return upstream ? `${message}\n\nProvider response:\n${JSON.stringify(upstream, null, 2)}` : message;
}

export default function AadhaarMockTestScreen() {
  const [result, setResult] = useState<SurepassMockResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await createSurepassMockSession());
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full px-4 py-8" style={{ background: '#f1f5f9' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-blue-700">
            <FlaskConical size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Aadhaar Mock Verification</h1>
            <p className="text-sm text-slate-500">Surepass DigiLocker sandbox session test</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm leading-6 text-slate-600">
            This creates a short-lived Surepass sandbox session through the Granvia backend.
            Your account-level bearer credential remains on the server.
          </p>
          <button
            type="button"
            onClick={runTest}
            disabled={loading}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <FlaskConical size={18} />}
            {loading ? 'Calling sandbox…' : 'Create mock session'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertCircle size={18} /> Test failed
            </div>
            <pre className="whitespace-pre-wrap break-words text-xs">{error}</pre>
          </div>
        )}

        {result && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
              <CheckCircle2 size={18} /> Surepass responded successfully
            </div>
            <div className="p-4">
              <a
                href={result.response.data.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white"
              >
                Open hosted verification <ExternalLink size={16} />
              </a>
              <p className="mt-3 text-xs text-slate-500">
                Session expires in {result.response.data.expiry_seconds} seconds.
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  View complete response
                </summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
