import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  AssociateTypeOption,
  createAssociateType,
  deleteAssociateType,
  listAllAssociateTypes,
  updateAssociateType,
} from '../../services/associateTypeService';
import { Card, PageHeader, Pill, Table } from './_adminUi';

type Draft = {
  name: string;
  description: string;
  status: 'active' | 'inactive';
};

const EMPTY: Draft = { name: '', description: '', status: 'active' };

export default function AssociateTypeMaster() {
  const [rows, setRows] = useState<AssociateTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssociateTypeOption | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listAllAssociateTypes());
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
    setError('');
    setOpen(true);
  };

  const startEdit = (row: AssociateTypeOption) => {
    setEditing(row);
    setDraft({
      name: row.name,
      description: row.description ?? '',
      status: row.status,
    });
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        status: draft.status,
      };
      if (editing) await updateAssociateType(editing.id, payload);
      else await createAssociateType(payload);
      setOpen(false);
      await load();
      setNotice(editing ? 'Associate type updated.' : 'Associate type created.');
    } catch (cause: any) {
      setError(cause?.response?.data?.message || cause.message || 'Unable to save associate type.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: AssociateTypeOption) => {
    if (!window.confirm(`Delete ${row.name}? If it is already used by associates or jobs, mark it inactive instead.`)) return;
    setError('');
    try {
      await deleteAssociateType(row.id);
      await load();
      setNotice('Associate type deleted.');
    } catch (cause: any) {
      setError(cause?.response?.data?.message || cause.message || 'Unable to delete associate type.');
    }
  };

  return (
    <motion.div className="p-6 space-y-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Associate Type Master"
        subtitle="Manage the profiles available to associate partners during registration and admin creation."
        action={<button onClick={startAdd} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2" style={{ background: '#0f1e3c' }}><Plus size={16} /> Add Type</button>}
      />

      {notice && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Loading associate types...</div>
        ) : (
          <Table headers={['Type Name', 'Code', 'Description', 'Status', 'Actions']}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100">
                <td className="px-4 py-3 font-semibold text-gray-900">
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-slate-400" />
                    {row.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{row.code}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{row.description ?? '--'}</td>
                <td className="px-4 py-3"><Pill label={row.status} tone={row.status === 'active' ? 'green' : 'gray'} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
                    <button onClick={() => remove(row)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-[70] overflow-y-auto p-3 sm:p-4" style={{ background: 'rgba(15,27,56,0.45)' }} onClick={() => setOpen(false)}>
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-auto my-3 max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 sm:my-4 sm:max-h-[calc(100vh-2rem)] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Associate Type' : 'Add Associate Type'}</h3>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Type Name</span>
                <input value={draft.name} onChange={(event) => setDraft((cur) => ({ ...cur, name: event.target.value }))} className="form-input mt-1" placeholder="Guard" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Description</span>
                <textarea value={draft.description} onChange={(event) => setDraft((cur) => ({ ...cur, description: event.target.value }))} className="form-input mt-1 min-h-28" placeholder="Optional description" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Status</span>
                <select value={draft.status} onChange={(event) => setDraft((cur) => ({ ...cur, status: event.target.value as Draft['status'] }))} className="form-input mt-1">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
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
