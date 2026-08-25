import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckSquare, Plus, Pencil, Trash2 } from 'lucide-react';
import { createRole, deleteRole, listAllRoles, updateRole, RoleOption, ROLE_MODULES } from '../../services/roleService';
import { PageHeader, Card, Table, Pill } from './_adminUi';

type Draft = {
  name: string;
  description: string;
  status: 'active' | 'inactive';
  permissions: string[];
};

const EMPTY: Draft = { name: '', description: '', status: 'active', permissions: [] };

export default function RoleMaster() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleOption | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setRoles(await listAllRoles());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setEditing(null);
    setDraft(EMPTY);
    setOpen(true);
  };

  const startEdit = (role: RoleOption) => {
    setEditing(role);
    setDraft({
      name: role.name,
      description: role.description ?? '',
      status: role.status,
      permissions: role.permissions ?? [],
    });
    setOpen(true);
  };

  const togglePermission = (permission: string) => {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const selectAll = () => setDraft((current) => ({ ...current, permissions: [...ROLE_MODULES] }));
  const clearAll = () => setDraft((current) => ({ ...current, permissions: [] }));

  const permissionCount = useMemo(() => draft.permissions.length, [draft.permissions]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: draft.name,
        description: draft.description,
        status: draft.status,
        permissions: draft.permissions,
      };
      if (editing) await updateRole(editing.id, payload);
      else await createRole(payload);
      setOpen(false);
      await load();
      setNotice(editing ? 'Role updated.' : 'Role created.');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Unable to save role.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: RoleOption) => {
    if (!window.confirm(`Delete ${role.name}? Staff currently using it will keep their account but will need a new role assignment.`)) return;
    setError('');
    try {
      await deleteRole(role.id);
      await load();
      setNotice('Role deleted.');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Unable to update role.');
    }
  };

  return (
    <motion.div className="p-6 space-y-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Role Master"
        subtitle="Create roles and define exactly which modules or sections each role can access."
        action={<button onClick={startAdd} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2" style={{ background: '#0f1e3c' }}><Plus size={16} /> Add Role</button>}
      />

      {notice && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Loading roles...</div>
        ) : (
          <Table headers={['Role Name', 'Modules', 'Description', 'Status', 'Actions']}>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-gray-100">
                <td className="px-4 py-3 font-semibold text-gray-900">{role.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <div className="flex flex-wrap gap-1.5">
                    {(role.permissions ?? []).length === 0 ? (
                      <span className="text-xs text-gray-400">No modules assigned</span>
                    ) : (
                      <>
                        {(role.permissions ?? []).slice(0, 4).map((permission) => (
                          <span key={permission} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {permission}
                          </span>
                        ))}
                        {(role.permissions?.length ?? 0) > 4 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            +{(role.permissions?.length ?? 0) - 4} more
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{role.description ?? '--'}</td>
                <td className="px-4 py-3"><Pill label={role.status} tone={role.status === 'active' ? 'green' : 'gray'} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(role)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
                    <button onClick={() => remove(role)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {open && (
        <div
          className={editing ? 'fixed inset-0 z-[70] flex items-center justify-center p-4' : 'fixed inset-0 z-[70] overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6 sm:py-8'}
          style={editing ? { background: 'rgba(15,27,56,0.45)' } : undefined}
          onClick={editing ? () => setOpen(false) : undefined}
        >
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={editing ? 'w-full max-w-3xl rounded-2xl bg-white p-6' : 'mx-auto min-h-full w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'} onClick={(e) => e.stopPropagation()}>
            {!editing && (
              <button type="button" onClick={() => setOpen(false)} className="mb-5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <ArrowLeft size={18} /> Back to Roles
              </button>
            )}
            <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Role' : 'Add Role'}</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500">Role Name</span>
                  <input value={draft.name} onChange={(e) => setDraft((cur) => ({ ...cur, name: e.target.value }))} className="form-input mt-1" placeholder="Branch Manager" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500">Description</span>
                  <textarea value={draft.description} onChange={(e) => setDraft((cur) => ({ ...cur, description: e.target.value }))} className="form-input mt-1 min-h-28" placeholder="Optional description" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500">Status</span>
                  <select value={draft.status} onChange={(e) => setDraft((cur) => ({ ...cur, status: e.target.value as Draft['status'] }))} className="form-input mt-1">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">Selected modules</span>
                    <span className="font-semibold text-slate-900">{permissionCount}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">These permissions are inherited by staff created under this role.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Module Access</h4>
                    <p className="text-xs text-slate-500">Check the sections this role can open.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAll} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">Select all</button>
                    <button type="button" onClick={clearAll} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">Clear</button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                  {ROLE_MODULES.map((module) => {
                    const checked = draft.permissions.includes(module);
                    return (
                      <button
                        key={module}
                        type="button"
                        onClick={() => togglePermission(module)}
                        className="flex items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors"
                        style={checked ? { borderColor: '#0f1e3c', background: 'rgba(15,30,60,0.06)' } : { borderColor: '#e2e8f0', background: 'white' }}
                      >
                        <CheckSquare size={16} className="mt-0.5" color={checked ? '#0f1e3c' : '#94a3b8'} />
                        <span className="text-sm text-slate-700">{module}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>Cancel</button>
              <button onClick={save} disabled={saving || !draft.name.trim()} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#0f1e3c' }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
