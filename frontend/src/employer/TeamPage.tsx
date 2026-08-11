import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Users, UserCog, ShieldCheck } from 'lucide-react';
import { listActiveRoles, RoleOption } from '../services/roleService';
import {
  createEmployerStaff,
  deleteEmployerStaff,
  listEmployerStaff,
  updateEmployerStaff,
  createEmployerSubAdmin,
  deleteEmployerSubAdmin,
  listEmployerSubAdmins,
  updateEmployerSubAdmin,
  StaffMember,
  EmployerSubAdmin,
} from '../services/teamService';
import type { ReactNode } from 'react';

type Tab = 'staff' | 'subadmins';
type Modal = { kind: 'staff' | 'subadmin'; id?: string } | null;

type StaffDraft = {
  name: string;
  role_id: string;
  email: string;
  mobile: string;
  status: 'Active' | 'Inactive';
};

type SubAdminDraft = {
  full_name: string;
  email: string;
  mobile: string;
  branch_name: string;
  password: string;
  status: 'active' | 'inactive';
};

const EMPTY_STAFF: StaffDraft = { name: '', role_id: '', email: '', mobile: '', status: 'Active' };
const EMPTY_SUBADMIN: SubAdminDraft = { full_name: '', email: '', mobile: '', branch_name: '', password: '', status: 'active' };

export default function TeamPage() {
  const [tab, setTab] = useState<Tab>('staff');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [subAdmins, setSubAdmins] = useState<EmployerSubAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [staffDraft, setStaffDraft] = useState<StaffDraft>(EMPTY_STAFF);
  const [subAdminDraft, setSubAdminDraft] = useState<SubAdminDraft>(EMPTY_SUBADMIN);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [nextRoles, nextStaff, nextSubAdmins] = await Promise.all([
        listActiveRoles().catch(() => []),
        listEmployerStaff().catch(() => []),
        listEmployerSubAdmins().catch(() => []),
      ]);
      setRoles(nextRoles);
      setStaff(nextStaff);
      setSubAdmins(nextSubAdmins);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const activeRoles = roles.filter((role) => role.status === 'active');

  const startAddStaff = () => {
    setModal({ kind: 'staff' });
    setStaffDraft({ ...EMPTY_STAFF, role_id: activeRoles[0]?.id ?? '' });
  };

  const startEditStaff = (row: StaffMember) => {
    setModal({ kind: 'staff', id: row.id });
    setStaffDraft({
      name: row.name,
      role_id: row.role_id ?? activeRoles[0]?.id ?? '',
      email: row.email ?? '',
      mobile: row.mobile ?? '',
      status: row.status,
    });
  };

  const startAddSubAdmin = () => {
    setModal({ kind: 'subadmin' });
    setSubAdminDraft(EMPTY_SUBADMIN);
  };

  const startEditSubAdmin = (row: EmployerSubAdmin) => {
    setModal({ kind: 'subadmin', id: row.id });
    setSubAdminDraft({
      full_name: row.full_name,
      email: row.email,
      mobile: row.mobile ?? '',
      branch_name: row.branch_name ?? '',
      password: '',
      status: row.account_status === 'inactive' ? 'inactive' : 'active',
    });
  };

  const selectedRole = roles.find((role) => role.id === staffDraft.role_id);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    setError('');
    try {
      let message = modal.kind === 'staff' ? 'Staff saved.' : 'Sub admin saved.';
      if (modal.kind === 'staff') {
        if (!staffDraft.role_id) throw new Error('Select a role.');
        if (modal.id) await updateEmployerStaff(modal.id, staffDraft);
        else await createEmployerStaff(staffDraft as any);
      } else {
        if (modal.id) await updateEmployerSubAdmin(modal.id, subAdminDraft);
        else {
          const result = await createEmployerSubAdmin(subAdminDraft);
          if (result.temporary_password) {
            message = `Sub admin created. Temporary password: ${result.temporary_password}`;
          }
        }
      }
      await load();
      setModal(null);
      setNotice(message);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Unable to save record.');
    } finally {
      setSaving(false);
    }
  };

  const removeStaff = async (id: string) => {
    if (!window.confirm('Remove this staff member?')) return;
    await deleteEmployerStaff(id);
    await load();
    setNotice('Staff removed.');
  };

  const removeSubAdmin = async (id: string) => {
    if (!window.confirm('Remove this sub admin account?')) return;
    await deleteEmployerSubAdmin(id);
    await load();
    setNotice('Sub admin removed.');
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Use the shared role master to assign staff roles. Manage sub-admin access separately.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('staff')} className={`px-3.5 py-2 rounded-xl text-sm font-semibold border ${tab === 'staff' ? 'text-white border-transparent' : 'text-gray-700 border-gray-200'}`} style={tab === 'staff' ? { background: '#0f1e3c' } : { background: 'white' }}>
            <Users size={15} className="inline mr-1.5" /> Staff
          </button>
          <button onClick={() => setTab('subadmins')} className={`px-3.5 py-2 rounded-xl text-sm font-semibold border ${tab === 'subadmins' ? 'text-white border-transparent' : 'text-gray-700 border-gray-200'}`} style={tab === 'subadmins' ? { background: '#0f1e3c' } : { background: 'white' }}>
            <UserCog size={15} className="inline mr-1.5" /> Sub Admins
          </button>
          <button onClick={tab === 'staff' ? startAddStaff : startAddSubAdmin} className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2" style={{ background: '#8b1a1a' }}>
            <Plus size={16} /> Add {tab === 'staff' ? 'Staff' : 'Sub Admin'}
          </button>
        </div>
      </div>

      {notice && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="rounded-xl bg-white border border-gray-100 px-4 py-3 text-sm text-gray-500">Loading team data...</div>}

      {tab === 'staff' ? (
        <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Name', 'Role', 'Contact', 'Permissions', 'Status', 'Actions'].map((header) => (
                  <th key={header} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((row) => (
                <tr key={row.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.role}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.email ?? '--'}<div className="text-xs text-gray-400">{row.mobile ?? '--'}</div></td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                      {(row.permissions ?? []).length === 0 ? <span className="text-xs text-gray-400">None</span> : (row.permissions ?? []).map((perm) => (
                        <span key={perm} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">{perm}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEditStaff(row)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
                      <button onClick={() => removeStaff(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No staff members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Name', 'Branch', 'Contact', 'Status', 'Actions'].map((header) => (
                  <th key={header} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subAdmins.map((row) => (
                <tr key={row.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.branch_name || '--'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.email}<div className="text-xs text-gray-400">{row.mobile ?? '--'}</div></td>
                  <td className="px-4 py-3"><StatusPill status={row.account_status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEditSubAdmin(row)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
                      <button onClick={() => removeSubAdmin(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {subAdmins.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No sub admins yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal?.kind === 'staff' && (
        <ModalShell title={modal.id ? 'Edit Staff' : 'Add Staff'} onClose={() => setModal(null)}>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Staff Name</span>
            <input value={staffDraft.name} onChange={(e) => setStaffDraft((cur) => ({ ...cur, name: e.target.value }))} className="form-input mt-1" />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Role</span>
            <select value={staffDraft.role_id} onChange={(e) => setStaffDraft((cur) => ({ ...cur, role_id: e.target.value }))} className="form-input mt-1">
              <option value="">Select a role</option>
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </label>
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-2 text-slate-700">
              <ShieldCheck size={14} style={{ color: '#0f1e3c' }} /> Inherited Modules
            </div>
            <div className="flex flex-wrap gap-2">
              {(selectedRole?.permissions ?? []).length === 0 ? (
                <span className="text-xs text-slate-400">No modules assigned to this role.</span>
              ) : (
                selectedRole?.permissions.map((perm) => (
                  <span key={perm} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">{perm}</span>
                ))
              )}
            </div>
          </div>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Email</span>
            <input value={staffDraft.email} onChange={(e) => setStaffDraft((cur) => ({ ...cur, email: e.target.value }))} className="form-input mt-1" />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Mobile</span>
            <input value={staffDraft.mobile} onChange={(e) => setStaffDraft((cur) => ({ ...cur, mobile: e.target.value }))} className="form-input mt-1" />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Status</span>
            <select value={staffDraft.status} onChange={(e) => setStaffDraft((cur) => ({ ...cur, status: e.target.value as StaffDraft['status'] }))} className="form-input mt-1">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>Cancel</button>
            <button onClick={save} disabled={saving || !staffDraft.name.trim() || !staffDraft.role_id} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#0f1e3c' }}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </ModalShell>
      )}

      {modal?.kind === 'subadmin' && (
        <ModalShell title={modal.id ? 'Edit Sub Admin' : 'Add Sub Admin'} onClose={() => setModal(null)}>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Full Name</span>
            <input value={subAdminDraft.full_name} onChange={(e) => setSubAdminDraft((cur) => ({ ...cur, full_name: e.target.value }))} className="form-input mt-1" />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Email</span>
            <input value={subAdminDraft.email} onChange={(e) => setSubAdminDraft((cur) => ({ ...cur, email: e.target.value }))} className="form-input mt-1" />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Mobile</span>
            <input value={subAdminDraft.mobile} onChange={(e) => setSubAdminDraft((cur) => ({ ...cur, mobile: e.target.value }))} className="form-input mt-1" />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Branch Name</span>
            <input value={subAdminDraft.branch_name} onChange={(e) => setSubAdminDraft((cur) => ({ ...cur, branch_name: e.target.value }))} className="form-input mt-1" />
          </label>
          {!modal.id && (
            <label className="block mb-4">
              <span className="text-xs font-semibold text-gray-500">Temporary Password</span>
              <input value={subAdminDraft.password} onChange={(e) => setSubAdminDraft((cur) => ({ ...cur, password: e.target.value }))} className="form-input mt-1" placeholder="Leave blank to auto-generate" />
            </label>
          )}
          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Status</span>
            <select value={subAdminDraft.status} onChange={(e) => setSubAdminDraft((cur) => ({ ...cur, status: e.target.value as SubAdminDraft['status'] }))} className="form-input mt-1">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>Cancel</button>
            <button onClick={save} disabled={saving || !subAdminDraft.full_name.trim() || !subAdminDraft.email.trim()} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#8b1a1a' }}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const green = lower.includes('active') || lower.includes('verified');
  const bg = green ? '#dcfce7' : '#fee2e2';
  const color = green ? '#166534' : '#7c2d12';
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: bg, color }}>{status}</span>;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(15,27,56,0.45)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <div className="mt-4">{children}</div>
      </motion.div>
    </div>
  );
}
