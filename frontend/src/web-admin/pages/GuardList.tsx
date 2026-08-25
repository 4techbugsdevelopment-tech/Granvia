import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Eye, Shield, ShieldOff,
  Phone, Mail, MapPin, XCircle, User, AlertCircle, Pencil, Trash2
} from 'lucide-react';
import { Guard } from '../../lib/storage';
import { listGuards, setGuardAccountStatus, declareGuardAadhaar, getAdminGuardAgreement, fetchAdminGuardAgreementPdf, updateGuard, deleteGuard } from '../../services/adminGuardService';
import { listGuardDocuments, reviewGuardDocument, GUARD_DOCUMENT_LABELS, GuardDocumentType } from '../../services/guardVerificationService';
import { getErrorMessage } from '../../services/apiErrors';

interface GuardListProps {
  onAddGuard: () => void;
}

export default function GuardList({ onAddGuard }: GuardListProps) {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Blocked'>('All');
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [agreement, setAgreement] = useState<any | null>(null);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [editingGuard, setEditingGuard] = useState(false);
  const [guardSaving, setGuardSaving] = useState(false);
  const [editDraft, setEditDraft] = useState({ fullName: '', email: '', mobile: '', city: '', state: '', address: '' });

  useEffect(() => {
    listGuards()
      .then(setGuards)
      .catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGuard) { setDocs([]); return; }
    setDocsLoading(true);
    listGuardDocuments(selectedGuard.id)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }, [selectedGuard]);

  useEffect(() => {
    if (!selectedGuard) { setAgreement(null); return; }
    setAgreementLoading(true);
    getAdminGuardAgreement(selectedGuard.id).then(setAgreement).catch(() => setAgreement(null)).finally(() => setAgreementLoading(false));
  }, [selectedGuard]);

  const viewAgreement = async () => {
    if (!selectedGuard || !agreement) return;
    try {
      const blob = await fetchAdminGuardAgreementPdf(selectedGuard.id, agreement.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) { setError(e?.response?.data?.message || e.message); }
  };

  const reviewDoc = async (docId: string, status: 'verified' | 'rejected') => {
    try {
      const updated = await reviewGuardDocument(docId, status);
      setDocs(prev => prev.map(d => (d.id === docId ? updated : d)));
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const filtered = guards.filter(g => {
    const matchSearch = g.fullName.toLowerCase().includes(search.toLowerCase()) ||
      g.mobile.includes(search) || g.city.toLowerCase().includes(search.toLowerCase()) ||
      g.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || g.status === filter;
    return matchSearch && matchFilter;
  });

  const toggleBlock = async (id: string) => {
    const guard = guards.find(g => g.id === id);
    if (!guard) return;
    const newStatus = guard.status === 'Active' ? 'blocked' : 'active';
    try {
      const updated = await setGuardAccountStatus(id, newStatus);
      setGuards(prev => prev.map(g => (g.id === id ? updated : g)));
      if (selectedGuard?.id === id) setSelectedGuard(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const startEditGuard = (target?: Guard) => {
    const guard = target ?? selectedGuard;
    if (!guard) return;
    setSelectedGuard(guard);
    setEditDraft({
      fullName: guard.fullName, email: guard.email, mobile: guard.mobile,
      city: guard.city, state: guard.state, address: guard.address,
    });
    setEditingGuard(true);
  };

  const saveGuard = async () => {
    if (!selectedGuard) return;
    setGuardSaving(true);
    setError(null);
    try {
      const updated = await updateGuard(selectedGuard.id, {
        full_name: editDraft.fullName.trim(), email: editDraft.email.trim().toLowerCase(), mobile: editDraft.mobile.trim(),
        city: editDraft.city.trim(), state: editDraft.state.trim(), address: editDraft.address.trim(),
      });
      setGuards(current => current.map(guard => guard.id === updated.id ? updated : guard));
      setSelectedGuard(updated);
      setEditingGuard(false);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Failed to update associate.'));
    } finally { setGuardSaving(false); }
  };

  const removeGuard = async (target?: Guard) => {
    const guard = target ?? selectedGuard;
    if (!guard || !window.confirm(`Delete ${guard.fullName}? This permanently removes the associate and their related application, attendance, verification and agreement records.`)) return;
    setGuardSaving(true);
    setError(null);
    try {
      await deleteGuard(guard.id);
      setGuards(current => current.filter(item => item.id !== guard.id));
      setSelectedGuard(null);
      setEditingGuard(false);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Failed to delete associate.'));
    } finally { setGuardSaving(false); }
  };

  const declareAadhaar = async (id: string, status: 'verified' | 'rejected') => {
    const titled = (status.charAt(0).toUpperCase() + status.slice(1)) as Guard['aadhaarStatus'];
    try {
      await declareGuardAadhaar(id, status);
      setGuards(prev => prev.map(g => (g.id === id ? { ...g, aadhaarStatus: titled } : g)));
      if (selectedGuard?.id === id) setSelectedGuard({ ...selectedGuard, aadhaarStatus: titled });
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const statusColor = (status: string) => status === 'Active' ? '#166534' : '#7c2d12';
  const statusBg = (status: string) => status === 'Active' ? '#dcfce7' : '#fee2e2';
  const verifyColor = (status: string) => status === 'Verified' ? '#166534' : status === 'Rejected' ? '#7c2d12' : '#854d0e';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-4 md:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>Associate Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{guards.length} total associates registered</p>
        </div>
        <motion.button
          onClick={onAddGuard}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white sm:w-auto"
          style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
          whileHover={{ scale: 1.03, boxShadow: '0 8px 20px rgba(15,30,60,0.3)' }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={16} />
          Add Associate
        </motion.button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />{error}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, mobile, city, ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }}
          />
        </div>
        <div className="flex gap-2">
          {(['All', 'Active', 'Blocked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: filter === f ? '#0f1e3c' : 'white',
                color: filter === f ? 'white' : '#64748b',
                border: filter === f ? 'none' : '1.5px solid #e2e8f0',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="space-y-3 lg:hidden">
        {filtered.map(guard => (
          <div key={guard.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="break-words font-semibold text-gray-900">{guard.fullName}</p><p className="break-all text-xs text-gray-500">{guard.email}</p><p className="text-xs text-gray-400">{guard.mobile}</p></div>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: statusColor(guard.status), background: statusBg(guard.status) }}>{guard.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] font-semibold uppercase text-gray-400">Location</p><p className="break-words text-gray-700">{guard.city}, {guard.state}</p></div>
              <div><p className="text-[10px] font-semibold uppercase text-gray-400">Experience</p><p className="text-gray-700">{guard.experience || '--'}</p></div>
              <div><p className="text-[10px] font-semibold uppercase text-gray-400">Aadhaar</p><p style={{ color: verifyColor(guard.aadhaarStatus) }}>{guard.aadhaarStatus}</p></div>
              <div><p className="text-[10px] font-semibold uppercase text-gray-400">Police</p><p style={{ color: verifyColor(guard.policeVerification) }}>{guard.policeVerification}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              <button onClick={() => setSelectedGuard(guard)} className="table-action"><Eye size={13} className="inline mr-1" />View</button>
              <button onClick={() => startEditGuard(guard)} className="table-action tone-blue"><Pencil size={13} className="inline mr-1" />Edit</button>
              <button onClick={() => toggleBlock(guard.id)} className="table-action">{guard.status === 'Active' ? 'Block' : 'Unblock'}</button>
              <button onClick={() => removeGuard(guard)} className="table-action tone-red"><Trash2 size={13} className="inline mr-1" />Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="rounded-2xl bg-white py-10 text-center text-sm text-gray-400">{loading ? 'Loading associates…' : 'No associates found'}</div>}
      </div>

      <div className="hidden rounded-2xl overflow-hidden lg:block" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Associate ID', 'Name', 'Contact', 'Location', 'Skills', 'Verifications', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((guard, i) => (
                  <motion.tr
                    key={guard.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                    onClick={() => setSelectedGuard(guard)}
                  >
                    <td className="px-4 py-3.5 text-xs font-mono font-bold" style={{ color: '#8b1a1a' }}>
                      {guard.id}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}
                        >
                          {guard.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{guard.fullName}</div>
                          <div className="text-xs text-gray-400">{guard.gender} · {guard.experience}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-gray-700">{guard.mobile}</div>
                      <div className="text-xs text-gray-400 truncate max-w-32">{guard.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <MapPin size={10} />
                        {guard.city}, {guard.state.substring(0, 2)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 flex-wrap max-w-36">
                        {guard.skills.slice(0, 2).map(s => (
                          <span key={s} className="text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                            {s}
                          </span>
                        ))}
                        {guard.skills.length > 2 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                            +{guard.skills.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="w-12 text-gray-400">Aadhaar</span>
                          <span className="font-medium" style={{ color: verifyColor(guard.aadhaarStatus) }}>
                            {guard.aadhaarStatus}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="w-12 text-gray-400">Police</span>
                          <span className="font-medium" style={{ color: verifyColor(guard.policeVerification) }}>
                            {guard.policeVerification}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ color: statusColor(guard.status), background: statusBg(guard.status) }}
                      >
                        {guard.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <motion.button
                          onClick={() => setSelectedGuard(guard)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          title="View Profile"
                        >
                          <Eye size={14} />
                        </motion.button>
                        <motion.button onClick={() => startEditGuard(guard)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" whileHover={{ scale: 1.1 }} title="Edit Associate">
                          <Pencil size={14} />
                        </motion.button>
                        <motion.button onClick={() => removeGuard(guard)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" whileHover={{ scale: 1.1 }} title="Delete Associate">
                          <Trash2 size={14} />
                        </motion.button>
                        <motion.button
                          onClick={() => toggleBlock(guard.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: guard.status === 'Active' ? '#7c2d12' : '#166534' }}
                          whileHover={{ scale: 1.1 }}
                          title={guard.status === 'Active' ? 'Block' : 'Unblock'}
                        >
                          {guard.status === 'Active' ? <ShieldOff size={14} /> : <Shield size={14} />}
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <User size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{loading ? 'Loading associates…' : 'No associates found'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Guard Profile Modal */}
      <AnimatePresence>
        {selectedGuard && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedGuard(null)}
          >
            <motion.div
              className="w-full max-w-2xl rounded-2xl overflow-hidden"
              style={{ background: 'white', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Profile header */}
              <div
                className="px-8 py-6 flex items-center gap-6"
                style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white flex-shrink-0"
                  style={{ background: 'rgba(139,26,26,0.6)' }}
                >
                  {selectedGuard.fullName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{selectedGuard.fullName}</h2>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: statusColor(selectedGuard.status), background: statusBg(selectedGuard.status) }}
                    >
                      {selectedGuard.status}
                    </span>
                  </div>
                  <p className="text-blue-200 text-sm mt-0.5 font-mono">{selectedGuard.id}</p>
                  <div className="flex gap-4 mt-2 text-xs text-blue-200">
                    <span className="flex items-center gap-1"><Phone size={10} />{selectedGuard.mobile}</span>
                    <span className="flex items-center gap-1"><Mail size={10} />{selectedGuard.email}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGuard(null)}
                  className="text-white/40 hover:text-white transition-colors ml-auto self-start"
                >
                  <XCircle size={22} />
                </button>
              </div>

              {editingGuard && (
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-gray-100">
                  {([
                    ['Full Name', 'fullName'], ['Email', 'email'], ['Mobile', 'mobile'],
                    ['City', 'city'], ['State', 'state'], ['Address', 'address'],
                  ] as const).map(([label, key]) => (
                    <label key={key} className="block">
                      <span className="form-label">{label}</span>
                      <input
                        value={editDraft[key]}
                        onChange={event => setEditDraft(current => ({ ...current, [key]: key === 'mobile' ? event.target.value.replace(/\D/g, '').slice(0, 10) : event.target.value }))}
                        className="form-input"
                      />
                    </label>
                  ))}
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <button onClick={() => setEditingGuard(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700">Cancel</button>
                    <button disabled={guardSaving} onClick={saveGuard} className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#0f1e3c' }}>{guardSaving ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </div>
              )}

              <div className={`p-6 grid-cols-2 gap-6 max-h-96 overflow-y-auto ${editingGuard ? 'hidden' : 'grid'}`}>
                {[
                  { label: 'Gender', value: selectedGuard.gender },
                  { label: 'Date of Birth', value: selectedGuard.dob },
                  { label: 'Experience', value: selectedGuard.experience },
                  { label: 'City', value: selectedGuard.city },
                  { label: 'State', value: selectedGuard.state },
                  { label: 'Address', value: selectedGuard.address },
                  { label: 'Current Location', value: selectedGuard.currentLocation },
                  { label: 'GPS', value: `${selectedGuard.latitude}, ${selectedGuard.longitude}` },
                  { label: 'Aadhaar Status', value: selectedGuard.aadhaarStatus },
                  { label: 'Police Verification', value: selectedGuard.policeVerification },
                  { label: 'Bank Details', value: selectedGuard.bankDetails ? 'Added' : 'Not Added' },
                  { label: 'Joined', value: new Date(selectedGuard.createdAt).toLocaleDateString() },
                ].map(field => (
                  <div key={field.label}>
                    <div className="text-xs text-gray-400 font-medium">{field.label}</div>
                    <div className="text-sm font-semibold text-gray-800 mt-0.5">{field.value}</div>
                  </div>
                ))}
                <div>
                  <div className="text-xs text-gray-400 font-medium">Skills</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedGuard.skills.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-medium">Languages</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedGuard.languages.map(l => (
                      <span key={l} className="text-xs px-2 py-0.5 rounded-md bg-green-50 text-green-700">{l}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Document review */}
              <div className="px-6 pb-4 border-t border-gray-100 pt-4">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Documents</div>
                {docsLoading ? (
                  <p className="text-sm text-gray-400">Loading documents…</p>
                ) : docs.length === 0 ? (
                  <p className="text-sm text-gray-400">No documents uploaded.</p>
                ) : (
                  <div className="space-y-2">
                    {docs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: '#f8fafc' }}>
                        <div className="min-w-0">
                          <a href={doc.download_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:underline truncate block">
                            {GUARD_DOCUMENT_LABELS[doc.document_type as GuardDocumentType] ?? doc.document_type}
                          </a>
                          <span className="text-xs text-gray-400 truncate">{doc.file_name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                            background: doc.status === 'verified' ? '#dcfce7' : doc.status === 'rejected' ? '#fee2e2' : '#fef9c3',
                            color: doc.status === 'verified' ? '#166534' : doc.status === 'rejected' ? '#7c2d12' : '#854d0e',
                          }}>{doc.status}</span>
                          {doc.status !== 'verified' && (
                            <button onClick={() => reviewDoc(doc.id, 'verified')} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>Verify</button>
                          )}
                          {doc.status !== 'rejected' && (
                            <button onClick={() => reviewDoc(doc.id, 'rejected')} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: '#fee2e2', color: '#7c2d12' }}>Reject</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Aadhaar declaration (automated API disabled) */}
              <div className="px-6 pb-4 border-t border-gray-100 pt-4">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Aadhaar Verification (manual)</div>
                <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: '#f8fafc' }}>
                  <span className="text-sm font-semibold" style={{ color: verifyColor(selectedGuard.aadhaarStatus) }}>
                    {selectedGuard.aadhaarStatus}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedGuard.aadhaarStatus !== 'Verified' && (
                      <button onClick={() => declareAadhaar(selectedGuard.id, 'verified')} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>Mark Verified</button>
                    )}
                    {selectedGuard.aadhaarStatus !== 'Rejected' && (
                      <button onClick={() => declareAadhaar(selectedGuard.id, 'rejected')} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: '#fee2e2', color: '#7c2d12' }}>Reject</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Associate onboarding agreement and eSign audit */}
              <div className="px-6 pb-4 border-t border-gray-100 pt-4">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Associate Partner Agreement</div>
                {agreementLoading ? <p className="text-sm text-gray-400">Loading agreement…</p> : !agreement ? <p className="text-sm text-gray-400">No onboarding agreement generated.</p> : (
                  <div className="rounded-xl p-3 space-y-3" style={{ background: '#f8fafc' }}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-gray-400 block">Status</span><b className={agreement.production_verified ? 'text-green-700' : 'text-amber-700'}>{String(agreement.status).replace(/_/g, ' ')}</b></div>
                      <div><span className="text-gray-400 block">Agreement No.</span><b className="break-all">{agreement.agreement_number}</b></div>
                      <div><span className="text-gray-400 block">Version</span><b>{agreement.agreement_version}</b></div>
                      <div><span className="text-gray-400 block">Generated</span><b>{agreement.agreement_generated_at ? new Date(agreement.agreement_generated_at).toLocaleDateString('en-IN') : '—'}</b></div>
                      <div><span className="text-gray-400 block">Consent</span><b>{agreement.consent_given_at ? new Date(agreement.consent_given_at).toLocaleString('en-IN') : 'Pending'}</b></div>
                      <div><span className="text-gray-400 block">Signed</span><b>{agreement.esign_completed_at ? new Date(agreement.esign_completed_at).toLocaleString('en-IN') : 'Pending'}</b></div>
                      <div><span className="text-gray-400 block">Verification</span><b>{agreement.production_verified ? 'Production verified' : agreement.status === 'SANDBOX_SIGNED' ? 'Sandbox only' : 'Pending'}</b></div>
                      <div><span className="text-gray-400 block">Transaction</span><b className="break-all">{agreement.esign_transaction_id || '—'}</b></div>
                    </div>
                    <button onClick={viewAgreement} className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-blue-50 text-blue-700">View / Download Agreement</button>
                    {!!agreement.audit_events?.length && <details><summary className="text-xs font-semibold text-gray-600 cursor-pointer">View eSign Audit Trail ({agreement.audit_events.length})</summary><div className="mt-2 max-h-28 overflow-y-auto space-y-1">{agreement.audit_events.map((event: any) => <div key={event.id} className="text-[11px] flex justify-between gap-3 border-b border-gray-200 py-1"><span>{event.event_type}</span><span className="text-gray-400">{new Date(event.created_at).toLocaleString('en-IN')}</span></div>)}</div></details>}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => removeGuard()}
                  disabled={guardSaving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  onClick={() => startEditGuard()}
                  disabled={editingGuard || guardSaving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => toggleBlock(selectedGuard.id)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: selectedGuard.status === 'Active' ? '#fee2e2' : '#dcfce7',
                    color: selectedGuard.status === 'Active' ? '#7c2d12' : '#166534',
                  }}
                >
                  {selectedGuard.status === 'Active' ? 'Block Associate' : 'Unblock Associate'}
                </button>
                <button
                  onClick={() => setSelectedGuard(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: '#0f1e3c' }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
