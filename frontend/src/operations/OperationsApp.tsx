import { useEffect, useState } from 'react';
import { ClipboardList, LogOut, RefreshCw, Users, UserCheck, MessageSquare } from 'lucide-react';
import { getOperationsDashboard, listOperationsApplications, updateOperationsApplication, type OperationsDashboard } from '../services/operationsService';
import { signOut } from '../services/authService';

const STATUSES = ['under_review', 'contacted', 'shortlisted', 'interview_requested', 'interview_completed', 'selected', 'rejected', 'onboarding', 'accepted', 'joined'];

export default function OperationsApp({ onLogout }: { onLogout: () => void }) {
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [stats, rows] = await Promise.all([getOperationsDashboard(), listOperationsApplications()]);
      setDashboard(stats);
      setApplications(rows);
    } catch (cause: any) {
      setError(cause.message || 'Could not load Operations workspace.');
    }
  };
  useEffect(() => { void load(); }, []);

  const changeStatus = async (application: any, status: string) => {
    const remarks = status === 'rejected' ? window.prompt('Enter the rejection reason:') : window.prompt('Optional remarks:');
    if (status === 'rejected' && !remarks) return;
    setBusy(application.id);
    try {
      await updateOperationsApplication(application.id, status, remarks || undefined, application.updated_at);
      await load();
    } catch (cause: any) {
      setError(cause.message || 'Could not update application.');
    } finally { setBusy(null); }
  };

  const cards = [
    ['New applications', dashboard?.new_applications ?? 0, <ClipboardList size={20} />],
    ['All applications', dashboard?.total_applications ?? 0, <Users size={20} />],
    ['Interviews', dashboard?.interviews ?? 0, <MessageSquare size={20} />],
    ['Onboarding', dashboard?.onboarding ?? 0, <UserCheck size={20} />],
  ] as const;

  return <div className="min-h-screen bg-slate-100 text-slate-900">
    <header className="bg-[#0f1e3c] px-5 py-4 text-white flex items-center justify-between">
      <div><h1 className="font-bold text-lg">Operations Workspace</h1><p className="text-xs text-blue-200">Employer-scoped hiring and onboarding</p></div>
      <button onClick={() => void signOut().finally(onLogout)} className="flex items-center gap-2 text-sm"><LogOut size={17} /> Logout</button>
    </header>
    <main className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{cards.map(([label, value, icon]) => <div key={label} className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-[#8b1a1a] mb-2">{icon}</div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-slate-500">{label}</div></div>)}</div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b"><div><h2 className="font-bold">Assigned applications</h2><p className="text-xs text-slate-500">Only records within your active Employer scope are shown.</p></div><button onClick={() => void load()} className="p-2 rounded-lg bg-slate-100"><RefreshCw size={16} /></button></div>
        {error && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Associate</th><th className="p-3">Job</th><th className="p-3">Applied</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>
          {applications.map(application => <tr key={application.id} className="border-t"><td className="p-3"><div className="font-semibold">{application.guard_profile?.full_name ?? 'Associate'}</div><div className="text-xs text-slate-500">{application.guard_profile?.mobile}</div></td><td className="p-3">{application.job?.title ?? '—'}</td><td className="p-3">{new Date(application.applied_at).toLocaleDateString('en-IN')}</td><td className="p-3 capitalize">{String(application.status).replaceAll('_', ' ')}</td><td className="p-3"><select disabled={busy === application.id} value="" onChange={event => void changeStatus(application, event.target.value)} className="rounded-lg border px-2 py-1.5"><option value="">Change status…</option>{STATUSES.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></td></tr>)}
          {!applications.length && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No assigned applications.</td></tr>}
        </tbody></table></div>
      </div>
    </main>
  </div>;
}
