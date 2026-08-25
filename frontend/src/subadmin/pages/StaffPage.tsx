import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { getStaff, createStaff, updateStaff, deleteStaff, StaffMember } from '../../services/subadminService';
import { listActiveRoles, RoleOption } from '../../services/roleService';
import { Page, PageHeader, DataTable, Pill, SlideOver, Field, TapButton, DataColumn } from '../ui';
import { BROWN, NAVY, BURGUNDY } from '../theme';

type Draft = {
  name: string;
  role_id: string;
  email: string;
  mobile: string;
  status: 'Active' | 'Inactive';
};

const EMPTY: Draft = { name: '', role_id: '', email: '', mobile: '', status: 'Active' };

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [nextRoles, nextStaff] = await Promise.all([
      listActiveRoles().catch(() => []),
      getStaff().catch(() => []),
    ]);
    setRoles(nextRoles);
    setStaff(nextStaff);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setEditing(null);
    setDraft({ ...EMPTY, role_id: roles.find((role) => role.status === 'active')?.id ?? '' });
    setOpen(true);
  };

  const startEdit = (row: StaffMember) => {
    setEditing(row);
    setDraft({
      name: row.name,
      role_id: row.role_id ?? roles.find((role) => role.name === row.role)?.id ?? '',
      email: row.email ?? '',
      mobile: row.mobile ?? '',
      status: row.status,
    });
    setOpen(true);
  };

  const selectedRole = roles.find((role) => role.id === draft.role_id);

  const save = async () => {
    if (!draft.role_id) return;
    setSaving(true);
    try {
      const payload = { ...draft, role: selectedRole?.name ?? '' };
      if (editing) await updateStaff(editing.id, payload);
      else await createStaff(payload as any);
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await deleteStaff(id);
    setStaff((prev) => prev.filter((row) => row.id !== id));
    setConfirmId(null);
  };

  const columns: DataColumn<StaffMember>[] = [
    { header: 'Name', primary: true, cell: (row) => row.name },
    { header: 'Role', cell: (row) => row.role },
    { header: 'Contact', cell: (row) => (<><div>{row.email}</div><div className="text-xs opacity-60">{row.mobile}</div></>) },
    {
      header: 'Permissions',
      wide: true,
      cell: (row) => (
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {(!row.permissions || row.permissions.length === 0) && <span className="text-xs opacity-50" style={{ color: BROWN }}>None</span>}
          {(row.permissions ?? []).map((perm) => (
            <span key={perm} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: NAVY, background: 'rgba(26,43,86,0.08)' }}>{perm}</span>
          ))}
        </div>
      ),
    },
    { header: 'Status', cell: (row) => <Pill label={row.status} /> },
    {
      header: 'Actions',
      actions: true,
      cell: (row) => (
        <div className="flex items-center gap-1">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => startEdit(row)} className="p-1.5 rounded-lg hover:bg-[rgba(26,43,86,0.08)]" style={{ color: NAVY }} title="Edit"><Pencil size={15} /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setConfirmId(row.id)} className="p-1.5 rounded-lg hover:bg-[rgba(122,38,33,0.08)]" style={{ color: BURGUNDY }} title="Delete"><Trash2 size={15} /></motion.button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Staff Management"
        subtitle="Add, edit or remove internal staff and assign only super-admin-defined roles."
        action={<TapButton onClick={startAdd}><Plus size={16} /> Add Staff</TapButton>}
      />

      {loading ? (
        <div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading...</div>
      ) : (
        <DataTable columns={columns} rows={staff} rowKey={(row) => row.id} empty="No staff members yet." />
      )}

      {confirmId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(15,27,56,0.45)' }} onClick={() => setConfirmId(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold" style={{ color: NAVY }}>Remove staff member?</h3>
            <p className="text-sm mt-1.5" style={{ color: BROWN }}>This will revoke their access immediately. This action cannot be undone.</p>
            <div className="flex gap-2 mt-5">
              <TapButton variant="ghost" onClick={() => setConfirmId(null)} className="flex-1">Cancel</TapButton>
              <TapButton variant="danger" onClick={() => remove(confirmId)} className="flex-1"><Trash2 size={15} /> Delete</TapButton>
            </div>
          </motion.div>
        </motion.div>
      )}

      <SlideOver open={open} page={!editing} onClose={() => setOpen(false)} title={editing ? 'Edit Staff Member' : 'Add Staff Member'} subtitle={editing ? editing.name : 'New internal staff account'}>
        <Field label="Staff Name" value={draft.name} onChange={(v) => setDraft((cur) => ({ ...cur, name: v }))} placeholder="e.g. Priya Menon" />

        <label className="block mb-4">
          <span className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Role / Designation</span>
          <select value={draft.role_id} onChange={(e) => setDraft((cur) => ({ ...cur, role_id: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #e6ddd8', background: '#faf8f6', color: BROWN }}>
            <option value="">Select a role</option>
            {roles.filter((role) => role.status === 'active').map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </label>

        <Field label="Contact Email" value={draft.email} onChange={(v) => setDraft((cur) => ({ ...cur, email: v }))} placeholder="name@region.com" type="email" />
        <Field label="Contact Number" value={draft.mobile} onChange={(v) => setDraft((cur) => ({ ...cur, mobile: v }))} placeholder="10-digit mobile" />

        <div className="mb-4 rounded-2xl border px-4 py-3" style={{ borderColor: '#e6ddd8', background: '#fcfbfa' }}>
          <div className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: BROWN }}>
            <ShieldCheck size={14} style={{ color: NAVY }} /> Inherited Modules
          </div>
          <div className="flex flex-wrap gap-2">
            {(selectedRole?.permissions ?? []).length === 0 ? (
              <span className="text-xs opacity-50" style={{ color: BROWN }}>No modules assigned to this role.</span>
            ) : (
              selectedRole?.permissions.map((perm) => (
                <span key={perm} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: NAVY, background: 'rgba(26,43,86,0.08)' }}>{perm}</span>
              ))
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Status</label>
          <div className="flex gap-2">
            {(['Active', 'Inactive'] as const).map((st) => (
              <motion.button
                key={st}
                whileTap={{ scale: 0.95 }}
                onClick={() => setDraft((current) => ({ ...current, status: st }))}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={draft.status === st ? { background: NAVY, color: 'white' } : { background: '#faf8f6', color: BROWN, border: '1.5px solid #e6ddd8' }}
              >
                {st}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <TapButton variant="ghost" onClick={() => setOpen(false)} className="flex-1">Cancel</TapButton>
          <TapButton onClick={save} disabled={!draft.name || !draft.role_id || saving} className="flex-1">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Staff'}</TapButton>
        </div>
      </SlideOver>
    </Page>
  );
}
