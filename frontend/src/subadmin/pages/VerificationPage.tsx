// Manual Verification Desk — live review of service-partner documents.
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Check, X, ShieldCheck, AlertCircle, Clock, Download } from 'lucide-react';
import {
  getVerificationQueue, reviewDocument, VerificationCandidate, VerificationDoc,
} from '../../services/subadminService';
import { PageHeader, Table, Pill, SlideOver, GlassStat, TapButton } from '../ui';
import { BROWN, NAVY, BURGUNDY } from '../theme';

const DOC_LABELS: Record<string, string> = {
  id_proof: 'Aadhaar / ID Proof',
  police_verification: 'Police Verification',
  bank_proof: 'Bank Details',
  other: 'Other Document',
};

function overallStatus(docs: VerificationDoc[]): string {
  if (docs.length === 0) return 'Pending';
  if (docs.some(d => d.status === 'rejected')) return 'Rejected';
  if (docs.every(d => d.status === 'verified')) return 'Verified';
  return 'Pending';
}

const docIcon: Record<string, React.ReactNode> = {
  verified: <Check size={14} />,
  rejected: <AlertCircle size={14} />,
  pending: <Clock size={14} />,
};

export default function VerificationPage() {
  const [queue, setQueue] = useState<VerificationCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ docId: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => getVerificationQueue().then(setQueue).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const active = queue.find(c => c.id === activeId) ?? null;

  const counts = useMemo(() => {
    const all = queue.flatMap(c => c.documents);
    return {
      pending: all.filter(d => d.status === 'pending').length,
      approved: all.filter(d => d.status === 'verified').length,
      rejected: all.filter(d => d.status === 'rejected').length,
    };
  }, [queue]);

  const patchDoc = (candidateId: string, docId: string, patch: Partial<VerificationDoc>) =>
    setQueue(prev => prev.map(c =>
      c.id !== candidateId ? c : { ...c, documents: c.documents.map(d => (d.id === docId ? { ...d, ...patch } : d)) }
    ));

  const approve = async (docId: string) => {
    if (!active) return;
    setBusy(true);
    try { await reviewDocument(docId, 'verified'); patchDoc(active.id, docId, { status: 'verified', admin_remarks: null }); }
    finally { setBusy(false); }
  };
  const confirmReject = async () => {
    if (!active || !rejecting) return;
    setBusy(true);
    try {
      await reviewDocument(rejecting.docId, 'rejected', rejecting.reason || 'Not specified');
      patchDoc(active.id, rejecting.docId, { status: 'rejected', admin_remarks: rejecting.reason || 'Not specified' });
      setRejecting(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6">
      <PageHeader title="Manual Verification Desk" subtitle="Review uploaded documents and approve or reject each associate" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <GlassStat label="Pending Review" value={String(counts.pending)} icon={<Clock size={18} />} accent="#854d0e" />
        <GlassStat label="Approved" value={String(counts.approved)} icon={<ShieldCheck size={18} />} accent={NAVY} />
        <GlassStat label="Rejected" value={String(counts.rejected)} icon={<AlertCircle size={18} />} accent={BURGUNDY} />
      </div>

      {loading ? <div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div> : (
        <Table headers={['Associate', 'City', 'Qualification', 'Documents', 'Status', '']}>
          {queue.map(c => {
            const approved = c.documents.filter(d => d.status === 'verified').length;
            return (
              <tr key={c.id} className="border-b hover:bg-[#faf8f6]" style={{ borderColor: '#f1ece8' }}>
                <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: NAVY }}>
                  {c.name}
                  <div className="text-xs font-normal opacity-60" style={{ color: BROWN }}>{c.mobile}</div>
                </td>
                <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{c.city ?? '—'}</td>
                <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{c.qualification ?? '—'}</td>
                <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{approved}/{c.documents.length} approved</td>
                <td className="px-4 py-3.5"><Pill label={overallStatus(c.documents)} /></td>
                <td className="px-4 py-3.5">
                  <TapButton variant="navy" onClick={() => setActiveId(c.id)} className="!px-3 !py-2 text-xs"><FileText size={14} /> Review</TapButton>
                </td>
              </tr>
            );
          })}
          {queue.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No associates in your branch yet.</td></tr>}
        </Table>
      )}

      <SlideOver
        open={!!active}
        onClose={() => { setActiveId(null); setRejecting(null); }}
        title={active ? active.name : ''}
        subtitle={active ? `${active.city ?? ''} · ${active.experience ?? ''} exp` : ''}
        width={520}
      >
        {active && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[['Mobile', active.mobile ?? '—'], ['Qualification', active.qualification ?? '—'], ['Languages', (active.languages ?? []).join(', ') || '—']].map(([l, v]) => (
                <div key={l} className="rounded-xl p-3" style={{ background: '#faf8f6', border: '1px solid #f1ece8' }}>
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: 'rgba(75,46,42,0.55)' }}>{l}</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: NAVY }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(75,46,42,0.55)' }}>Uploaded Documents</div>
            {active.documents.length === 0 && <p className="text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No documents uploaded by this associate yet.</p>}
            <div className="space-y-3">
              {active.documents.map(doc => {
                const t = doc.status === 'verified' ? { c: NAVY, bg: 'rgba(26,43,86,0.08)' }
                  : doc.status === 'rejected' ? { c: BURGUNDY, bg: 'rgba(122,38,33,0.08)' }
                  : { c: '#854d0e', bg: '#fef3c7' };
                return (
                  <div key={doc.id} className="rounded-2xl p-4" style={{ border: '1px solid #ece7e3' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(26,43,86,0.06)', color: NAVY }}>
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: BROWN }}>{DOC_LABELS[doc.document_type] ?? doc.document_type}</div>
                          <div className="text-xs opacity-60" style={{ color: BROWN }}>{doc.file_name}</div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ color: t.c, background: t.bg }}>
                        {docIcon[doc.status]} {doc.status}
                      </span>
                    </div>

                    <a href={doc.download_url} target="_blank" rel="noreferrer"
                      className="mt-3 rounded-xl h-24 flex items-center justify-center gap-2 text-xs font-medium hover:opacity-80"
                      style={{ background: 'repeating-linear-gradient(45deg, #faf8f6, #faf8f6 10px, #f3eee9 10px, #f3eee9 20px)', color: 'rgba(75,46,42,0.6)', border: '1px dashed #e0d6cf' }}>
                      <Download size={14} /> View {doc.file_name}
                    </a>

                    {doc.status === 'rejected' && doc.admin_remarks && (
                      <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(122,38,33,0.06)', color: BURGUNDY }}>
                        <strong>Reason:</strong> {doc.admin_remarks}
                      </div>
                    )}

                    {rejecting?.docId === doc.id ? (
                      <div className="mt-3">
                        <textarea autoFocus value={rejecting.reason} onChange={e => setRejecting({ docId: doc.id, reason: e.target.value })}
                          placeholder="Reason for rejection (shared with the associate)…"
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" rows={2}
                          style={{ border: `1.5px solid ${BURGUNDY}`, background: '#fff', color: BROWN }} />
                        <div className="flex gap-2 mt-2">
                          <TapButton variant="ghost" onClick={() => setRejecting(null)} className="flex-1 !py-2 text-xs">Cancel</TapButton>
                          <TapButton variant="danger" onClick={confirmReject} disabled={busy} className="flex-1 !py-2 text-xs">Confirm Reject</TapButton>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-3">
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => approve(doc.id)} disabled={doc.status === 'verified' || busy}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ background: NAVY }}>
                          <Check size={14} /> Approve
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setRejecting({ docId: doc.id, reason: '' })} disabled={doc.status === 'rejected' || busy}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ background: BURGUNDY }}>
                          <X size={14} /> Reject
                        </motion.button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: '#faf8f6', border: '1px solid #f1ece8' }}>
              <span className="text-sm font-medium" style={{ color: BROWN }}>Application status</span>
              <Pill label={overallStatus(active.documents)} />
            </div>
          </>
        )}
      </SlideOver>
    </div>
  );
}
