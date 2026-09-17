import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  CityMaster,
  StateMaster,
  createCityMaster,
  createStateMaster,
  deleteCityMaster,
  deleteStateMaster,
  listAdminCities,
  listAdminStates,
  updateCityMaster,
  updateStateMaster,
} from '../../services/locationMasterService';
import { Card, PageHeader, Pill, Table } from './_adminUi';

type StateDraft = { code: string; name: string; type: StateMaster['type']; status: StateMaster['status'] };
type CityDraft = { state_id: string; name: string; status: CityMaster['status'] };

const EMPTY_STATE: StateDraft = { code: '', name: '', type: 'state', status: 'active' };
const EMPTY_CITY: CityDraft = { state_id: '', name: '', status: 'active' };

export default function LocationMaster() {
  const [states, setStates] = useState<StateMaster[]>([]);
  const [cities, setCities] = useState<CityMaster[]>([]);
  const [stateDraft, setStateDraft] = useState<StateDraft>(EMPTY_STATE);
  const [cityDraft, setCityDraft] = useState<CityDraft>(EMPTY_CITY);
  const [editingState, setEditingState] = useState<StateMaster | null>(null);
  const [editingCity, setEditingCity] = useState<CityMaster | null>(null);
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [stateFilter, setStateFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [stateRows, cityRows] = await Promise.all([listAdminStates(), listAdminCities()]);
      setStates(stateRows);
      setCities(cityRows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filteredCities = useMemo(
    () => stateFilter ? cities.filter(city => city.state_id === stateFilter) : cities,
    [cities, stateFilter],
  );

  const apiMessage = (cause: any, fallback: string) => cause?.response?.data?.message || cause.message || fallback;

  const openStateAdd = () => {
    setEditingState(null);
    setStateDraft(EMPTY_STATE);
    setError('');
    setStateOpen(true);
  };

  const openStateEdit = (row: StateMaster) => {
    setEditingState(row);
    setStateDraft({ code: row.code, name: row.name, type: row.type, status: row.status });
    setError('');
    setStateOpen(true);
  };

  const openCityAdd = () => {
    setEditingCity(null);
    setCityDraft({ ...EMPTY_CITY, state_id: stateFilter || states[0]?.id || '' });
    setError('');
    setCityOpen(true);
  };

  const openCityEdit = (row: CityMaster) => {
    setEditingCity(row);
    setCityDraft({ state_id: row.state_id, name: row.name, status: row.status });
    setError('');
    setCityOpen(true);
  };

  const saveState = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...stateDraft, code: stateDraft.code.trim(), name: stateDraft.name.trim() };
      if (editingState) await updateStateMaster(editingState.id, payload);
      else await createStateMaster(payload);
      setStateOpen(false);
      await load();
      setNotice(editingState ? 'State updated.' : 'State created.');
    } catch (cause: any) {
      setError(apiMessage(cause, 'Unable to save state.'));
    } finally {
      setSaving(false);
    }
  };

  const saveCity = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...cityDraft, name: cityDraft.name.trim() };
      if (editingCity) await updateCityMaster(editingCity.id, payload);
      else await createCityMaster(payload);
      setCityOpen(false);
      await load();
      setNotice(editingCity ? 'City updated.' : 'City created.');
    } catch (cause: any) {
      setError(apiMessage(cause, 'Unable to save city.'));
    } finally {
      setSaving(false);
    }
  };

  const removeState = async (row: StateMaster) => {
    if (!window.confirm(`Delete ${row.name}? States with cities should be marked inactive instead.`)) return;
    setError('');
    try {
      await deleteStateMaster(row.id);
      await load();
      setNotice('State deleted.');
    } catch (cause: any) {
      setError(apiMessage(cause, 'Unable to delete state.'));
    }
  };

  const removeCity = async (row: CityMaster) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    setError('');
    try {
      await deleteCityMaster(row.id);
      await load();
      setNotice('City deleted.');
    } catch (cause: any) {
      setError(apiMessage(cause, 'Unable to delete city.'));
    }
  };

  return (
    <motion.div className="p-6 space-y-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="City & State Master"
        subtitle="Manage active Indian states, union territories, and cities used by registration, profiles, companies and sites."
        action={<button onClick={openStateAdd} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2" style={{ background: '#0f1e3c' }}><Plus size={16} /> Add State</button>}
      />

      {notice && <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-bold text-gray-900">States & UTs</h2>
            <button onClick={openStateAdd} className="text-xs font-bold text-blue-700">Add</button>
          </div>
          {loading ? <div className="px-6 py-12 text-center text-sm text-gray-500">Loading...</div> : (
            <Table headers={['Name', 'Code', 'Type', 'Status', 'Actions']}>
              {states.map(row => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{row.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.type === 'union_territory' ? 'Union Territory' : 'State'}</td>
                  <td className="px-4 py-3"><Pill label={row.status} tone={row.status === 'active' ? 'green' : 'gray'} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openStateEdit(row)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
                      <button onClick={() => removeState(row)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Cities</h2>
              <p className="text-xs text-gray-400">{filteredCities.length} entries</p>
            </div>
            <div className="flex gap-2">
              <select value={stateFilter} onChange={event => setStateFilter(event.target.value)} className="form-input min-w-48">
                <option value="">All states</option>
                {states.map(state => <option key={state.id} value={state.id}>{state.name}</option>)}
              </select>
              <button onClick={openCityAdd} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2" style={{ background: '#0f1e3c' }}><Plus size={16} /> Add City</button>
            </div>
          </div>
          {loading ? <div className="px-6 py-12 text-center text-sm text-gray-500">Loading...</div> : (
            <Table headers={['City', 'State', 'Status', 'Actions']}>
              {filteredCities.map(row => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-semibold text-gray-900"><span className="inline-flex items-center gap-2"><MapPin size={15} className="text-slate-400" />{row.name}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.state?.name ?? '--'}</td>
                  <td className="px-4 py-3"><Pill label={row.status} tone={row.status === 'active' ? 'green' : 'gray'} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openCityEdit(row)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
                      <button onClick={() => removeCity(row)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {stateOpen && (
        <Modal title={editingState ? 'Edit State' : 'Add State'} onClose={() => setStateOpen(false)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Code" value={stateDraft.code} onChange={value => setStateDraft(cur => ({ ...cur, code: value.toUpperCase() }))} />
            <Field label="Name" value={stateDraft.name} onChange={value => setStateDraft(cur => ({ ...cur, name: value }))} />
            <Select label="Type" value={stateDraft.type} onChange={value => setStateDraft(cur => ({ ...cur, type: value as StateDraft['type'] }))} options={[['state', 'State'], ['union_territory', 'Union Territory']]} />
            <Select label="Status" value={stateDraft.status} onChange={value => setStateDraft(cur => ({ ...cur, status: value as StateDraft['status'] }))} options={[['active', 'Active'], ['inactive', 'Inactive']]} />
          </div>
          <Actions saving={saving} disabled={!stateDraft.code.trim() || !stateDraft.name.trim()} onCancel={() => setStateOpen(false)} onSave={saveState} />
        </Modal>
      )}

      {cityOpen && (
        <Modal title={editingCity ? 'Edit City' : 'Add City'} onClose={() => setCityOpen(false)}>
          <div className="space-y-4">
            <Select label="State" value={cityDraft.state_id} onChange={value => setCityDraft(cur => ({ ...cur, state_id: value }))} options={states.map(state => [state.id, state.name])} />
            <Field label="City Name" value={cityDraft.name} onChange={value => setCityDraft(cur => ({ ...cur, name: value }))} />
            <Select label="Status" value={cityDraft.status} onChange={value => setCityDraft(cur => ({ ...cur, status: value as CityDraft['status'] }))} options={[['active', 'Active'], ['inactive', 'Inactive']]} />
          </div>
          <Actions saving={saving} disabled={!cityDraft.state_id || !cityDraft.name.trim()} onCancel={() => setCityOpen(false)} onSave={saveCity} />
        </Modal>
      )}
    </motion.div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-2xl rounded-2xl bg-white p-6" onClick={event => event.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <div className="mt-4">{children}</div>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="form-label">{label}</span><input value={value} onChange={event => onChange(event.target.value)} className="form-input mt-1" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="block"><span className="form-label">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="form-input mt-1">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}

function Actions({ saving, disabled, onCancel, onSave }: { saving: boolean; disabled: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="mt-6 flex gap-2">
      <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>Cancel</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#0f1e3c' }}>{saving ? 'Saving...' : 'Save'}</button>
    </div>
  );
}
