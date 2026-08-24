import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, User, Phone, MapPin, FileText, CreditCard, Loader2 } from 'lucide-react';
import { createGuard } from '../../services/adminGuardService';
import { geocodeAddress, buildSiteAddress } from '../../lib/geoUtils';
import { usePincodeAutofill } from '../../hooks/usePincodeAutofill';

interface AddGuardProps {
  onSuccess: () => void;
}

const SKILLS = ['CCTV Monitoring', 'Access Control', 'Fire Safety', 'Patrolling', 'Emergency Response', 'First Aid', 'VIP Security', 'Crowd Management', 'Communication', 'Investigation'];
const LANGUAGES = ['Hindi', 'English', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati', 'Kannada', 'Punjabi', 'Urdu'];
const STATES = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Punjab'];

function FloatingInput({
  label, value, onChange, type = 'text', required = false,
  placeholder = '', error = '', readOnly = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; error?: string; readOnly?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <label
        className="block text-xs font-semibold mb-1.5 tracking-wide"
        style={{ color: focused ? '#0f1e3c' : '#64748b' }}
      >
        {label}{required && <span style={{ color: '#8b1a1a' }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (!readOnly) setFocused(true); }}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{
          border: `1.5px solid ${error ? '#ef4444' : focused ? '#0f1e3c' : '#e2e8f0'}`,
          background: readOnly ? '#f1f5f9' : focused ? 'white' : '#f8fafc',
          color: readOnly ? '#94a3b8' : '#0f1e3c',
          cursor: readOnly ? 'not-allowed' : 'text',
        }}
      />
      <AnimatePresence>
        {error && (
          <motion.p
            className="text-xs text-red-500 mt-1"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function SelectInput({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 tracking-wide text-gray-500">
        {label}{required && <span style={{ color: '#8b1a1a' }}> *</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{ border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#0f1e3c' }}
      >
        <option value="">Select {label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function MultiSelect({ label, selected, options, onChange }: {
  label: string; selected: string[]; options: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter(s => s !== item) : [...selected, item]);
  };
  return (
    <div>
      <label className="block text-xs font-semibold mb-2 tracking-wide text-gray-500">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <motion.button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
            style={{
              borderColor: selected.includes(opt) ? '#0f1e3c' : '#e2e8f0',
              background: selected.includes(opt) ? '#0f1e3c' : 'white',
              color: selected.includes(opt) ? 'white' : '#64748b',
            }}
            whileTap={{ scale: 0.95 }}
          >
            {opt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default function AddGuard({ onSuccess }: AddGuardProps) {
  const [form, setForm] = useState({
    fullName: '', mobile: '', email: '', password: '',
    gender: '', dob: '', address: '', city: '', state: '', pincode: '',
    latitude: '', longitude: '', experience: '',
    skills: [] as string[], languages: [] as string[], status: 'Active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  // Geocoding status for the address → lat/lng auto-fill
  const [geo, setGeo] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoReqId = useRef(0);

  const set = (key: string) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  usePincodeAutofill(form.pincode, result => {
    setForm(current => ({ ...current, city: result.city, state: result.state }));
  });

  // Auto-fill lat/lng from address + city + state + pincode using the free
  // Nominatim (OpenStreetMap) geocoder — the same one the employer site form uses.
  // Debounced to respect Nominatim's rate limit; stale responses are ignored.
  useEffect(() => {
    const address = form.address.trim();
    const city = form.city.trim();
    const state = form.state.trim();
    const pincode = form.pincode.trim();

    // Need at least city + state before a lookup makes sense
    if (!city || !state) {
      setGeo({ status: 'idle', message: '' });
      setForm(f => (f.latitude || f.longitude ? { ...f, latitude: '', longitude: '' } : f));
      return;
    }

    setGeo({ status: 'loading', message: 'Locating from address…' });
    const reqId = ++geoReqId.current;
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(async () => {
      const query = buildSiteAddress({ address, city, state, pincode });
      const result = await geocodeAddress(query);
      if (reqId !== geoReqId.current) return; // a newer edit superseded this lookup
      if (result) {
        setForm(f => ({ ...f, latitude: result.lat.toFixed(6), longitude: result.lng.toFixed(6) }));
        setGeo({ status: 'ok', message: 'Location found from the address, city, state and pincode.' });
      } else {
        setForm(f => ({ ...f, latitude: '', longitude: '' }));
        setGeo({
          status: 'error',
          message: 'We could not locate this address. Please check the address, city, state and pincode.',
        });
      }
    }, 900);

    return () => { if (geoTimer.current) clearTimeout(geoTimer.current); };
  }, [form.address, form.city, form.state, form.pincode]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.mobile.match(/^[6-9]\d{9}$/)) e.mobile = 'Enter valid 10-digit mobile number';
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Enter valid email';
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!form.gender) e.gender = 'Please select gender';
    if (!form.dob) e.dob = 'Date of birth is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state) e.state = 'State is required';
    // Location must be verified — lat/lng are derived, not typed
    if (geo.status !== 'ok' || !form.latitude || !form.longitude) {
      e.location = geo.status === 'error'
        ? geo.message
        : geo.status === 'loading'
          ? 'Please wait for the location to finish loading.'
          : 'Enter a valid address, city, state and pincode so the location can be found.';
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setApiError(null);
    setSubmitting(true);

    try {
      await createGuard({
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state || undefined,
        pincode: form.pincode.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        skills: form.skills,
        languages: form.languages,
        experience: form.experience.trim() || undefined,
        account_status: form.status === 'Blocked' ? 'blocked' : 'active',
      });
      setSuccess(true);
      setTimeout(onSuccess, 1500);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.errors) {
        const fieldMap: Record<string, string> = { full_name: 'fullName' };
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(data.errors)) {
          mapped[fieldMap[field] ?? field] = (messages as string[])[0];
        }
        setErrors(mapped);
      }
      setApiError(data?.message || 'Could not create associate.');
    } finally {
      setSubmitting(false);
    }
  };

  const sections = [
    {
      title: 'Personal Information',
      icon: <User size={16} />,
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FloatingInput label="Full Name" value={form.fullName} onChange={set('fullName')} required error={errors.fullName} placeholder="Enter full name" />
          <SelectInput label="Gender" value={form.gender} onChange={set('gender')} options={['Male', 'Female', 'Other']} required />
          <FloatingInput label="Date of Birth" value={form.dob} onChange={set('dob')} type="date" required error={errors.dob} />
          <FloatingInput label="Experience" value={form.experience} onChange={set('experience')} placeholder="e.g. 3 years" />
        </div>
      ),
    },
    {
      title: 'Contact Details',
      icon: <Phone size={16} />,
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FloatingInput label="Mobile Number" value={form.mobile} onChange={set('mobile')} required error={errors.mobile} placeholder="10-digit mobile" />
          <FloatingInput label="Email Address" value={form.email} onChange={set('email')} type="email" required error={errors.email} placeholder="email@example.com" />
          <FloatingInput label="Login Password" value={form.password} onChange={set('password')} type="password" required error={errors.password} placeholder="Min 6 characters" />
        </div>
      ),
    },
    {
      title: 'Location Information',
      icon: <MapPin size={16} />,
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FloatingInput label="Address" value={form.address} onChange={set('address')} placeholder="Full address" />
          </div>
          <FloatingInput label="City" value={form.city} onChange={set('city')} required error={errors.city} placeholder="City" />
          <SelectInput label="State" value={form.state} onChange={set('state')} options={form.state && !STATES.includes(form.state) ? [form.state, ...STATES] : STATES} required />
          <div className="sm:col-span-2">
            <FloatingInput
              label="Pincode"
              value={form.pincode}
              onChange={v => set('pincode')(v.replace(/\D/g, '').slice(0, 6))}
              error={errors.pincode}
              placeholder="6-digit pincode (improves location accuracy)"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <FloatingInput label="Latitude" value={form.latitude} onChange={set('latitude')} placeholder="Auto-filled" readOnly />
            <FloatingInput label="Longitude" value={form.longitude} onChange={set('longitude')} placeholder="Auto-filled" readOnly />
          </div>
          <div className="sm:col-span-2">
            {geo.status === 'loading' && (
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#64748b' }}>
                <Loader2 size={14} className="animate-spin" />
                {geo.message}
              </div>
            )}
            {geo.status === 'ok' && (
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#166534' }}>
                <CheckCircle size={14} />
                {geo.message}
              </div>
            )}
            {(geo.status === 'error' || (errors.location && geo.status === 'idle')) && (
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#ef4444' }}>
                <AlertCircle size={14} />
                {geo.status === 'error' ? geo.message : errors.location}
              </div>
            )}
            {geo.status === 'idle' && !errors.location && (
              <p className="text-xs text-gray-400">
                Latitude and longitude are filled automatically from the address, city, state and pincode.
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Skills & Languages',
      icon: <FileText size={16} />,
      content: (
        <div className="space-y-4">
          <MultiSelect label="Skills" selected={form.skills} options={SKILLS} onChange={v => setForm(f => ({ ...f, skills: v }))} />
          <MultiSelect label="Languages Known" selected={form.languages} options={LANGUAGES} onChange={v => setForm(f => ({ ...f, languages: v }))} />
        </div>
      ),
    },
    {
      title: 'Verification & Status',
      icon: <CreditCard size={16} />,
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SelectInput label="Account Status" value={form.status} onChange={set('status')} options={['Active', 'Blocked']} />
          <div className="sm:col-span-3">
            <div className="rounded-xl p-4 text-sm text-gray-500 flex items-start gap-2" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-blue-500" />
              Aadhaar and police verification are completed by the associate in the mobile app. Bank details and document uploads are available in the profile after creation.
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 w-full max-w-7xl"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>Add New Associate</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create associate account – credentials will be usable in the mobile app</p>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            className="mb-6 rounded-2xl p-6 flex flex-col items-center gap-3"
            style={{ background: '#dcfce7', border: '2px solid #86efac' }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <CheckCircle size={40} style={{ color: '#166534' }} />
            <p className="font-bold text-green-800">Associate created successfully!</p>
            <p className="text-sm text-green-600">Redirecting to associate list...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {apiError && !success && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />{apiError}
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {sections.map((section, i) => (
            <motion.div
              key={section.title}
              className={`rounded-2xl overflow-hidden h-full ${section.title === 'Verification & Status' ? 'xl:col-span-2' : ''}`}
              style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <div
                className="flex items-center gap-2 px-6 py-4 border-b border-gray-100"
                style={{ color: '#0f1e3c' }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(15,30,60,0.08)' }}>
                  {section.icon}
                </div>
                <span className="font-bold text-sm">{section.title}</span>
              </div>
              <div className="p-6">
                {section.content}
              </div>
            </motion.div>
          ))}

          <div className="xl:col-span-2 flex justify-start gap-3 pt-2">
            <motion.button
              type="submit"
              disabled={submitting || geo.status !== 'ok'}
              className="min-w-56 px-6 py-3.5 rounded-2xl font-bold text-white text-sm tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
              whileHover={geo.status === 'ok' ? { scale: 1.02, boxShadow: '0 8px 24px rgba(15,30,60,0.3)' } : {}}
              whileTap={geo.status === 'ok' ? { scale: 0.98 } : {}}
            >
              {submitting ? (
                <motion.div
                  className="w-5 h-5 rounded-full border-2 border-white border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                'Create Associate Account'
              )}
            </motion.button>
            <motion.button
              type="button"
              onClick={onSuccess}
              className="px-6 py-3.5 rounded-2xl font-bold text-sm"
              style={{ background: '#f1f5f9', color: '#64748b' }}
              whileHover={{ background: '#e2e8f0' }}
              whileTap={{ scale: 0.98 }}
            >
              Cancel
            </motion.button>
          </div>
        </form>
      )}
    </motion.div>
  );
}
