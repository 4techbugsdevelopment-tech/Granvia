// ProfileScreen — guard profile view/edit backed by the Laravel API
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Mail, MapPin, Shield, CreditCard, FileText,
  CheckCircle, ChevronRight, Pencil, X, AlertCircle, Upload,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { updateMyGuardProfile, GuardProfileUpdate } from '../../services/profileService';
import {
  GUARD_DOCUMENT_LABELS, GuardDocumentType,
  listMyDocuments, uploadMyDocument, verifyAadhaarInstant,
} from '../../services/guardVerificationService';

const QUALIFICATION_OPTIONS = ['Below 10th', '10th Pass', '12th Pass', 'Graduate', 'Post Graduate'];

const SKILL_OPTIONS = ['CCTV Monitoring', 'Access Control', 'Fire Safety', 'Patrolling', 'Emergency Response', 'First Aid', 'VIP Security', 'Crowd Management', 'Communication', 'Investigation'];
const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati', 'Kannada', 'Punjabi', 'Urdu'];

function statusBadge(status: string | null | undefined) {
  const s = (status ?? 'pending').toLowerCase();
  if (s === 'verified') return { label: 'Verified', color: '#166534', bg: '#dcfce7' };
  if (s === 'rejected') return { label: 'Rejected', color: '#7c2d12', bg: '#fee2e2' };
  return { label: 'Pending', color: '#854d0e', bg: '#fef9c3' };
}

function SheetInput({ label, value, onChange, placeholder = '', type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
        style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f1e3c' }}
      />
    </div>
  );
}

function ChipSelect({ label, selected, options, onChange }: {
  label: string; selected: string[]; options: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (item: string) =>
    onChange(selected.includes(item) ? selected.filter(s => s !== item) : [...selected, item]);
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="text-xs px-3 py-1.5 rounded-full border font-medium"
            style={{
              borderColor: selected.includes(opt) ? '#0f1e3c' : '#e2e8f0',
              background: selected.includes(opt) ? '#0f1e3c' : 'white',
              color: selected.includes(opt) ? 'white' : '#64748b',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProfileScreen() {
  const { profile, guardProfile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<GuardProfileUpdate>({});

  // Documents sheet
  const [docsOpen, setDocsOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docType, setDocType] = useState<GuardDocumentType>('id_proof');
  const [uploading, setUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Aadhaar sheet
  const [aadhaarOpen, setAadhaarOpen] = useState(false);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarBusy, setAadhaarBusy] = useState(false);
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [aadhaarDone, setAadhaarDone] = useState(false);

  const apiError = (e: any, fallback: string) => {
    const data = e?.response?.data;
    const firstFieldError = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null;
    return firstFieldError || data?.message || fallback;
  };

  const openDocs = () => {
    setDocError(null);
    setDocsOpen(true);
    listMyDocuments().then(setDocuments).catch(e => setDocError(apiError(e, 'Could not load documents.')));
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setDocError(null);
    try {
      const doc = await uploadMyDocument(docType, file);
      setDocuments(prev => [doc, ...prev]);
      await refreshProfile();
    } catch (e: any) {
      setDocError(apiError(e, 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const openAadhaar = () => {
    setAadhaarNumber('');
    setAadhaarError(null);
    setAadhaarDone(false);
    setAadhaarOpen(true);
  };

  const handleVerifyAadhaar = async () => {
    setAadhaarBusy(true);
    setAadhaarError(null);
    try {
      await verifyAadhaarInstant(aadhaarNumber);
      await refreshProfile();
      setAadhaarDone(true);
      setTimeout(() => setAadhaarOpen(false), 1500);
    } catch (e: any) {
      setAadhaarError(apiError(e, 'Verification failed.'));
    } finally {
      setAadhaarBusy(false);
    }
  };

  const fullName = guardProfile?.full_name || profile?.full_name || 'Guard';
  const skills = guardProfile?.skills ?? [];
  const languages = guardProfile?.languages ?? [];
  const hasBank = Boolean(guardProfile?.bank_account_number);
  const aadhaar = statusBadge(guardProfile?.aadhaar_status);
  const police = statusBadge(guardProfile?.police_verification_status);
  const active = profile?.account_status === 'active';

  const openEdit = () => {
    setForm({
      full_name: fullName,
      gender: guardProfile?.gender ?? '',
      address: guardProfile?.address ?? '',
      city: guardProfile?.city ?? '',
      state: guardProfile?.state ?? '',
      pincode: guardProfile?.pincode ?? '',
      experience: guardProfile?.experience ?? '',
      qualification: guardProfile?.qualification ?? '',
      search_radius_km: guardProfile?.search_radius_km ?? 10,
      skills: skills,
      languages: languages,
      bank_account_number: guardProfile?.bank_account_number ?? '',
      bank_ifsc: guardProfile?.bank_ifsc ?? '',
      bank_name: guardProfile?.bank_name ?? '',
      account_holder_name: guardProfile?.account_holder_name ?? '',
    });
    setError(null);
    setEditing(true);
  };

  const set = (key: keyof GuardProfileUpdate) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Empty strings would fail backend format validation — send null to clear a field.
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
      ) as GuardProfileUpdate;
      if (!payload.full_name) delete payload.full_name;
      await updateMyGuardProfile(payload);
      await refreshProfile();
      setEditing(false);
    } catch (e: any) {
      const data = e?.response?.data;
      const firstFieldError = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null;
      setError(firstFieldError || data?.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { icon: <FileText size={16} />, label: 'Document Upload', badge: 'Upload', color: '#0f1e3c', bg: '#f0f4f8', onClick: openDocs },
    { icon: <Shield size={16} />, label: 'Aadhaar Verification', badge: aadhaar.label, color: aadhaar.color, bg: aadhaar.bg, onClick: openAadhaar },
    { icon: <CheckCircle size={16} />, label: 'Police Verification', badge: police.label, color: police.color, bg: police.bg, onClick: openDocs },
    { icon: <CreditCard size={16} />, label: 'Bank Details', badge: hasBank ? 'Added' : 'Pending', color: hasBank ? '#166534' : '#854d0e', bg: hasBank ? '#dcfce7' : '#fef9c3', onClick: openEdit },
  ];

  return (
    <div className="pb-6">
      {/* Profile header */}
      <div
        className="px-4 pt-6 pb-10 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)',
          paddingTop: 'max(24px, env(safe-area-inset-top, 24px))',
        }}
      >
        <motion.div
          className="absolute w-48 h-48 rounded-full opacity-10"
          style={{ background: '#8b1a1a', bottom: -40, right: -40 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        <div className="flex items-center gap-4 relative z-10">
          <motion.div
            className="rounded-3xl flex items-center justify-center text-3xl font-bold text-white flex-shrink-0"
            style={{ width: 72, height: 72, background: 'rgba(139,26,26,0.5)' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {fullName.charAt(0)}
          </motion.div>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-xl truncate">{fullName}</h1>
            <div className="flex items-center gap-1.5 mt-2">
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{ background: active ? '#22c55e' : '#ef4444' }}
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-xs text-white opacity-80">{active ? 'Active' : 'Blocked'}</span>
              {guardProfile?.experience && (
                <span className="text-xs text-blue-200 ml-2">· {guardProfile.experience}</span>
              )}
            </div>
          </div>
          <motion.button
            onClick={openEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0 mobile-touch-interactive"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.94 }}
          >
            <Pencil size={12} /> Edit
          </motion.button>
        </div>
      </div>

      {/* Contact info card */}
      <motion.div
        className="mx-4 -mt-5 rounded-2xl p-4 relative z-10"
        style={{ background: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Phone size={14} style={{ color: '#8b1a1a' }} className="flex-shrink-0" />
            <span className="text-gray-700 truncate">{profile?.mobile || guardProfile?.mobile || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail size={14} style={{ color: '#8b1a1a' }} className="flex-shrink-0" />
            <span className="text-gray-700 truncate">{profile?.email || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MapPin size={14} style={{ color: '#8b1a1a' }} className="flex-shrink-0" />
            <span className="text-gray-700 truncate">
              {[guardProfile?.address, guardProfile?.city, guardProfile?.state].filter(Boolean).join(', ') || 'No address added'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Skills */}
      <div className="px-4 mt-5">
        <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Skills</h3>
        <div className="flex flex-wrap gap-2">
          {skills.length > 0 ? skills.map(skill => (
            <span key={skill} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: '#f0f4f8', color: '#0f1e3c' }}>
              {skill}
            </span>
          )) : <span className="text-xs text-gray-400">No skills added yet</span>}
        </div>
      </div>

      {/* Languages */}
      <div className="px-4 mt-4">
        <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Languages</h3>
        <div className="flex flex-wrap gap-2">
          {languages.length > 0 ? languages.map(lang => (
            <span key={lang} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: '#fef9c3', color: '#854d0e' }}>
              {lang}
            </span>
          )) : <span className="text-xs text-gray-400">No languages added yet</span>}
        </div>
      </div>

      {/* Documents & Verification */}
      <div className="px-4 mt-5">
        <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Documents & Verification</h3>
        <div className="space-y-2">
          {menuItems.map((item, i) => (
            <motion.button
              key={item.label}
              className="w-full flex items-center justify-between rounded-2xl p-4 mobile-touch-interactive"
              style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              whileTap={{ scale: 0.98 }}
              onClick={item.onClick}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0f4f8', color: '#0f1e3c' }}>
                  {item.icon}
                </div>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: item.bg, color: item.color }}
                >
                  {item.badge}
                </span>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Edit bottom sheet */}
      <AnimatePresence>
        {editing && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !saving && setEditing(false)}
          >
            <motion.div
              className="w-full rounded-t-3xl"
              style={{ background: 'white', maxHeight: '90vh', overflow: 'auto', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pt-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Edit Profile</h2>
                  <button onClick={() => !saving && setEditing(false)} className="text-gray-400">
                    <X size={18} />
                  </button>
                </div>

                {error && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs">
                    <AlertCircle size={13} className="flex-shrink-0" />{error}
                  </div>
                )}

                <div className="space-y-3">
                  <SheetInput label="Full Name" value={form.full_name ?? ''} onChange={set('full_name')} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Gender</label>
                      <select
                        value={form.gender ?? ''}
                        onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                        style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f1e3c' }}
                      >
                        <option value="">Select</option>
                        {['Male', 'Female', 'Other'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <SheetInput label="Experience" value={form.experience ?? ''} onChange={set('experience')} placeholder="e.g. 3 years" />
                  </div>
                  <SheetInput label="Address" value={form.address ?? ''} onChange={set('address')} placeholder="Full address" />
                  <div className="grid grid-cols-2 gap-3">
                    <SheetInput label="City" value={form.city ?? ''} onChange={set('city')} />
                    <SheetInput label="State" value={form.state ?? ''} onChange={set('state')} />
                  </div>
                  <SheetInput label="Pincode" value={form.pincode ?? ''} onChange={set('pincode')} placeholder="6-digit pincode" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Qualification</label>
                      <select
                        value={form.qualification ?? ''}
                        onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                        style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f1e3c' }}
                      >
                        <option value="">Select</option>
                        {QUALIFICATION_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Job Radius (km)</label>
                      <input
                        type="number" min={1} max={100}
                        value={form.search_radius_km ?? 10}
                        onChange={e => setForm(f => ({ ...f, search_radius_km: Number(e.target.value) }))}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                        style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f1e3c' }}
                      />
                    </div>
                  </div>

                  <ChipSelect
                    label="Skills"
                    selected={form.skills ?? []}
                    options={SKILL_OPTIONS}
                    onChange={v => setForm(f => ({ ...f, skills: v }))}
                  />
                  <ChipSelect
                    label="Languages"
                    selected={form.languages ?? []}
                    options={LANGUAGE_OPTIONS}
                    onChange={v => setForm(f => ({ ...f, languages: v }))}
                  />

                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Bank Details</h3>
                  <SheetInput label="Account Holder Name" value={form.account_holder_name ?? ''} onChange={set('account_holder_name')} />
                  <SheetInput label="Account Number" value={form.bank_account_number ?? ''} onChange={set('bank_account_number')} placeholder="9–18 digits" />
                  <div className="grid grid-cols-2 gap-3">
                    <SheetInput label="IFSC Code" value={form.bank_ifsc ?? ''} onChange={v => setForm(f => ({ ...f, bank_ifsc: v.toUpperCase() }))} placeholder="e.g. SBIN0001234" />
                    <SheetInput label="Bank Name" value={form.bank_name ?? ''} onChange={set('bank_name')} />
                  </div>
                </div>

                <motion.button
                  onClick={save}
                  disabled={saving}
                  className="w-full mt-5 py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  {saving ? (
                    <motion.div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : 'Save Profile'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Documents bottom sheet */}
      <AnimatePresence>
        {docsOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !uploading && setDocsOpen(false)}
          >
            <motion.div
              className="w-full rounded-t-3xl"
              style={{ background: 'white', maxHeight: '85vh', overflow: 'auto', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pt-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">My Documents</h2>
                  <button onClick={() => !uploading && setDocsOpen(false)} className="text-gray-400"><X size={18} /></button>
                </div>

                {docError && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs">
                    <AlertCircle size={13} className="flex-shrink-0" />{docError}
                  </div>
                )}

                <label className="block text-xs font-semibold text-gray-500 mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={e => setDocType(e.target.value as GuardDocumentType)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none mb-3"
                  style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f1e3c' }}
                >
                  {(Object.keys(GUARD_DOCUMENT_LABELS) as GuardDocumentType[]).map(t => (
                    <option key={t} value={t}>{GUARD_DOCUMENT_LABELS[t]}</option>
                  ))}
                </select>

                <label
                  className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
                >
                  {uploading ? (
                    <motion.div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : (
                    <><Upload size={16} /> Choose file (JPG/PNG/PDF)</>
                  )}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={e => handleUpload(e.target.files?.[0] ?? null)}
                  />
                </label>

                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-5 mb-2">Uploaded</h3>
                {documents.length === 0 ? (
                  <p className="text-xs text-gray-400 pb-4">No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-2 pb-2">
                    {documents.map(doc => {
                      const badge = statusBadge(doc.status);
                      return (
                        <div key={doc.id} className="flex items-center justify-between rounded-xl p-3" style={{ background: '#f8fafc' }}>
                          <div className="min-w-0 mr-2">
                            <p className="text-sm font-medium text-gray-800 truncate">{GUARD_DOCUMENT_LABELS[doc.document_type as GuardDocumentType] ?? doc.document_type}</p>
                            <p className="text-xs text-gray-400 truncate">{doc.file_name}</p>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aadhaar verification bottom sheet */}
      <AnimatePresence>
        {aadhaarOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !aadhaarBusy && setAadhaarOpen(false)}
          >
            <motion.div
              className="w-full rounded-t-3xl"
              style={{ background: 'white', maxHeight: '85vh', overflow: 'auto', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pt-2 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Aadhaar Verification</h2>
                  <button onClick={() => !aadhaarBusy && setAadhaarOpen(false)} className="text-gray-400"><X size={18} /></button>
                </div>

                {aadhaarDone ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <CheckCircle size={40} style={{ color: '#22c55e' }} />
                    <p className="font-bold text-gray-800">Aadhaar Verified!</p>
                  </div>
                ) : (
                  <>
                    {aadhaarError && (
                      <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs">
                        <AlertCircle size={13} className="flex-shrink-0" />{aadhaarError}
                      </div>
                    )}
                    <SheetInput label="Aadhaar Number" value={aadhaarNumber} onChange={v => setAadhaarNumber(v.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit Aadhaar" />
                    <p className="text-xs text-gray-400 mt-2">Enter your 12-digit Aadhaar number to verify your identity instantly.</p>
                    <motion.button
                      onClick={handleVerifyAadhaar}
                      disabled={aadhaarBusy || aadhaarNumber.length !== 12}
                      className="w-full mt-4 py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {aadhaarBusy ? (
                        <motion.div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                      ) : 'Verify Aadhaar'}
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
