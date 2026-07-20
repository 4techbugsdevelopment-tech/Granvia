// Staff Management — live CRUD against the API.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { getStaff, createStaff, updateStaff, deleteStaff, StaffMember } from '../../services/subadminService';
import { PageHeader, Table, Pill, SlideOver, Field, TapButton } from '../ui';
import { BROWN, NAVY, BURGUNDY } from '../theme';

const STAFF_PERMISSIONS = ['Manage Staff', 'Verify Documents', 'Manage Clients', 'Manage Service Partners', 'View Reports', 'Post Jobs'];
type Draft = { name: string; role: string; email: string; mobile: string; status: 'Active' | 'Inactive'; permissions: string[] };
const EMPTY: Draft = { name: '', role: '', email: '', mobile: '', status: 'Active', permissions: [] };

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => getStaff().then(setStaff).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const startAdd = () => { setEditing(null); setDraft(EMPTY); setOpen(true); };
  const startEdit = (s: StaffMember) => {
    setEditing(s);
    setDraft({ name: s.name, role: s.role, email: s.email ?? '', mobile: s.mobile ?? '', status: s.status, permissions: s.permissions ?? [] });
    setOpen(true);
  };
  const togglePerm = (p: string) =>
    setDraft(d => ({ ...d, permissions: d.permissions.includes(p) ? d.permissions.filter(x => x !== p) : [...d.permissions, p] }));

  const save = async () => {
    setSaving(true);
    try {
      if (editing) await updateStaff(editing.id, draft);
      else await createStaff(draft);
      setOpen(false);
      await load();
    } finally { setSaving(false); }
  };
  const remove = async (id: string) => { await deleteStaff(id); setStaff(prev => prev.filter(s => s.id !== id)); setConfirmId(null); };

  return (
    <div className="p-6">
      <PageHeader
        title="Staff Management"
        subtitle="Add, edit or remove internal staff and set their access permissions"
        action={<TapButton onClick={startAdd}><Plus size={16} /> Add Staff</TapButton>}
      />

      {loading ? <div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div> : (
        <Table headers={['Name', 'Role', 'Contact', 'Permissions', 'Status', 'Actions']}>
          {staff.map(s => (
            <tr key={s.id} className="border-b hover:bg-[#faf8f6]" style={{ borderColor: '#f1ece8' }}>
              <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: NAVY }}>{s.name}</td>
              <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>{s.role}</td>
              <td className="px-4 py-3.5 text-sm" style={{ color: BROWN }}>
                <div>{s.email}</div>
                <div className="text-xs opacity-60">{s.mobile}</div>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex flex-wrap gap-1 max-w-[220px]">
                  {(!s.permissions || s.permissions.length === 0) && <span className="text-xs opacity-50" style={{ color: BROWN }}>None</span>}
                  {(s.permissions ?? []).map(p => (
                    <span key={p} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: NAVY, background: 'rgba(26,43,86,0.08)' }}>{p}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3.5"><Pill label={s.status} /></td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => startEdit(s)} className="p-1.5 rounded-lg hover:bg-[rgba(26,43,86,0.08)]" style={{ color: NAVY }} title="Edit"><Pencil size={15} /></motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setConfirmId(s.id)} className="p-1.5 rounded-lg hover:bg-[rgba(122,38,33,0.08)]" style={{ color: BURGUNDY }} title="Delete"><Trash2 size={15} /></motion.button>
                </div>
              </td>
            </tr>
          ))}
          {staff.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No staff members yet.</td></tr>}
        </Table>
      )}

      {confirmId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(15,27,56,0.45)' }} onClick={() => setConfirmId(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold" style={{ color: NAVY }}>Remove staff member?</h3>
            <p className="text-sm mt-1.5" style={{ color: BROWN }}>This will revoke their access immediately. This action cannot be undone.</p>
            <div className="flex gap-2 mt-5">
              <TapButton variant="ghost" onClick={() => setConfirmId(null)} className="flex-1">Cancel</TapButton>
              <TapButton variant="danger" onClick={() => remove(confirmId)} className="flex-1"><Trash2 size={15} /> Delete</TapButton>
            </div>
          </motion.div>
        </motion.div>
      )}

      <SlideOver open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Staff Member' : 'Add Staff Member'} subtitle={editing ? editing.name : 'New internal staff account'}>
        <Field label="Staff Name" value={draft.name} onChange={v => setDraft(d => ({ ...d, name: v }))} placeholder="e.g. Priya Menon" />
        <Field label="Role / Designation" value={draft.role} onChange={v => setDraft(d => ({ ...d, role: v }))} placeholder="e.g. Field Supervisor" />
        <Field label="Contact Email" value={draft.email} onChange={v => setDraft(d => ({ ...d, email: v }))} placeholder="name@region.com" type="email" />
        <Field label="Contact Number" value={draft.mobile} onChange={v => setDraft(d => ({ ...d, mobile: v }))} placeholder="10-digit mobile" />

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Status</label>
          <div className="flex gap-2">
            {(['Active', 'Inactive'] as const).map(st => (
              <motion.button key={st} whileTap={{ scale: 0.95 }} onClick={() => setDraft(d => ({ ...d, status: st }))}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={draft.status === st ? { background: NAVY, color: 'white' } : { background: '#faf8f6', color: BROWN, border: '1.5px solid #e6ddd8' }}>
                {st}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: BROWN }}>
            <ShieldCheck size={14} style={{ color: NAVY }} /> Access Permissions
          </label>
          <div className="flex flex-wrap gap-2">
            {STAFF_PERMISSIONS.map(p => {
              const on = draft.permissions.includes(p);
              return (
                <motion.button key={p} whileTap={{ scale: 0.94 }} onClick={() => togglePerm(p)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                  style={on ? { background: NAVY, color: 'white' } : { background: '#faf8f6', color: BROWN, border: '1.5px solid #e6ddd8' }}>
                  {p}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <TapButton variant="ghost" onClick={() => setOpen(false)} className="flex-1">Cancel</TapButton>
          <TapButton onClick={save} disabled={!draft.name || !draft.role || saving} className="flex-1">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Staff'}</TapButton>
        </div>
      </SlideOver>
    </div>
  );
}
