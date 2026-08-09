// Sales Executive panel — live data from the API (scoped by sales_executive_id).
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Briefcase, BadgePercent, MapPinned, LogOut, X, Search,
  Building2, CheckCircle, Plus, Trash2, TrendingUp, Activity,
} from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';
import { signOut } from '../services/authService';
import MobileChrome from '../universal-mobile/MobileChrome';
import { NAVY, NAVY_GRADIENT, BURGUNDY, BROWN, PAGE_BG } from '../subadmin/theme';
import { GlassStat, Card, Pill, PageHeader, SlideOver, TapButton, Field, Page, DataTable, AppLayoutProvider, DataColumn } from '../subadmin/ui';
import {
  getSalesCounts, getSalesActivity, getSalesClients, getSalesClientDetail,
  requestJobOtp, postProxyJob, getDiscounts, createDiscount, deleteDiscount, getManpower,
  SalesCounts, SalesActivityItem, SalesClient, SalesClientDetail, Discount, ManpowerResult,
} from '../services/salesService';

type SalesPage = 'dashboard' | 'clients' | 'post-job' | 'discounts' | 'manpower';
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// `master: true` → entry / creation actions shown in the top-left drawer on mobile.
const NAV: { id: SalesPage; label: string; icon: React.ReactNode; master?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'clients', label: 'Clients', icon: <Users size={18} /> },
  { id: 'post-job', label: 'Post Job (on behalf)', icon: <Briefcase size={18} />, master: true },
  { id: 'discounts', label: 'Discounts', icon: <BadgePercent size={18} />, master: true },
  { id: 'manpower', label: 'Manpower Map', icon: <MapPinned size={18} /> },
];

function Loading() {
  return <div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div>;
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

function DashboardPage() {
  const [counts, setCounts] = useState<SalesCounts | null>(null);
  const [activity, setActivity] = useState<SalesActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSalesCounts(), getSalesActivity()])
      .then(([c, a]) => { setCounts(c); setActivity(a); })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !counts) return <Page><PageHeader title="Sales Dashboard" subtitle="Your client portfolio at a glance" /><Loading /></Page>;

  const stats = [
    { label: 'Managed Clients', value: String(counts.managed_clients), icon: <Users size={18} />, accent: NAVY },
    { label: 'Active Site Jobs', value: String(counts.active_jobs), icon: <Briefcase size={18} />, accent: BURGUNDY },
    { label: 'Conversion Rate', value: `${counts.conversion_rate}%`, icon: <TrendingUp size={18} />, accent: BROWN },
    { label: 'Active Discounts', value: String(counts.active_discounts), icon: <BadgePercent size={18} />, accent: NAVY },
  ];

  return (
    <Page>
      <PageHeader title="Sales Dashboard" subtitle="Your client portfolio at a glance" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <GlassStat label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
          </motion.div>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} style={{ color: BURGUNDY }} />
          <h2 className="font-bold" style={{ color: NAVY }}>Recent Activity</h2>
        </div>
        {activity.length === 0 && <p className="text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No recent activity for your clients yet.</p>}
        <div className="space-y-2">
          {activity.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: '#faf8f6' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: a.type === 'job' ? 'rgba(26,43,86,0.1)' : 'rgba(122,38,33,0.1)', color: a.type === 'job' ? NAVY : BURGUNDY }}>
                {a.type === 'job' ? <Briefcase size={15} /> : <Users size={15} />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: BROWN }}>{a.title}</div>
                {a.subtitle && <div className="text-xs opacity-60" style={{ color: BROWN }}>{a.subtitle}</div>}
              </div>
              <span className="text-xs opacity-50" style={{ color: BROWN }}>{new Date(a.at).toLocaleDateString('en-IN')}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </Page>
  );
}

// ── Clients ────────────────────────────────────────────────────────────────────

function ClientsPage() {
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<SalesClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { getSalesClients().then(setClients).finally(() => setLoading(false)); }, []);

  const open = async (id: string) => {
    setDetailLoading(true);
    try { setDetail(await getSalesClientDetail(id)); } finally { setDetailLoading(false); }
  };

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.city ?? '').toLowerCase().includes(search.toLowerCase()));

  const columns: DataColumn<SalesClient>[] = [
    { header: 'Company', primary: true, cell: c => c.name },
    { header: 'Contact', cell: c => c.email },
    { header: 'City', cell: c => c.city ?? '—' },
    { header: 'Sites', cell: c => c.sites },
    { header: 'Jobs', cell: c => c.jobs },
    { header: 'Billing', cell: c => <Pill label={c.billing_status} /> },
    { header: '', actions: true, cell: c => <TapButton variant="navy" onClick={() => open(c.id)} className="!px-3 !py-2 text-xs">View</TapButton> },
  ];

  return (
    <Page>
      <PageHeader title="Clients" subtitle="Employers assigned to you — click to view sites, jobs and billing" />
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(75,46,42,0.4)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'white', border: '1.5px solid #e6ddd8', color: BROWN }} />
      </div>

      {loading ? <Loading /> : (
        <DataTable columns={columns} rows={filtered} rowKey={c => c.id} empty="No clients assigned yet." />
      )}

      <SlideOver open={!!detail || detailLoading} onClose={() => setDetail(null)} title={detail?.client.name ?? 'Loading…'} subtitle={detail ? detail.client.email : ''} width={520}>
        {detailLoading || !detail ? <Loading /> : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[['Mobile', detail.client.mobile ?? '—'], ['Billing', detail.client.billing_status], ['Base Rate', detail.client.base_hourly_rate ? `₹${detail.client.base_hourly_rate}/hr` : '—'], ['Sites', String(detail.sites.length)]].map(([l, v]) => (
                <div key={l} className="rounded-xl p-3" style={{ background: '#faf8f6', border: '1px solid #f1ece8' }}>
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: 'rgba(75,46,42,0.55)' }}>{l}</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: NAVY }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(75,46,42,0.55)' }}>Registered Sites</div>
            <div className="space-y-2 mb-5">
              {detail.sites.length === 0 && <p className="text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No sites registered.</p>}
              {detail.sites.map(s => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: '#faf8f6' }}>
                  <Building2 size={15} style={{ color: NAVY }} />
                  <span className="text-sm font-medium" style={{ color: BROWN }}>{s.site_name ?? 'Unnamed site'}</span>
                  {s.city && <span className="text-xs opacity-60 ml-auto" style={{ color: BROWN }}>{s.city}</span>}
                </div>
              ))}
            </div>

            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(75,46,42,0.55)' }}>Job History</div>
            <div className="space-y-2">
              {detail.jobs.length === 0 && <p className="text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No jobs posted yet.</p>}
              {detail.jobs.map(j => (
                <div key={j.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: '#faf8f6' }}>
                  <Briefcase size={15} style={{ color: BURGUNDY }} />
                  <span className="text-sm font-medium" style={{ color: BROWN }}>{j.title}</span>
                  <span className="ml-auto"><Pill label={j.status} /></span>
                </div>
              ))}
            </div>
          </>
        )}
      </SlideOver>
    </Page>
  );
}

// ── Proxy job posting with client OTP ───────────────────────────────────────────

const JOB_CATEGORIES = [
  { label: '4-hour (Half Day)', value: '4-hour' },
  { label: '8-hour (Full Day)', value: '8-hour' },
  { label: '12-hour (Overtime)', value: '12-hour' },
];

function PostJobPage() {
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [detail, setDetail] = useState<SalesClientDetail | null>(null);
  const [form, setForm] = useState({ employer: '', company: '', site: '', title: '', dutyHours: '8-hour', english: true, experience: '', education: '', guards: '2' });
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [otp, setOtp] = useState('');
  const [otpMeta, setOtpMeta] = useState<{ otp_id: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getSalesClients().then(setClients); }, []);

  const selectClient = async (id: string) => {
    setForm(f => ({ ...f, employer: id, company: '', site: '' }));
    if (id) setDetail(await getSalesClientDetail(id));
    else setDetail(null);
  };

  const sendOtp = async () => {
    setError(''); setBusy(true);
    try {
      const meta = await requestJobOtp(form.employer);
      setOtpMeta({ otp_id: meta.otp_id });
      setStep('otp');
    } catch { setError('Could not send OTP.'); } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!otpMeta) return;
    setError(''); setBusy(true);
    try {
      await postProxyJob({
        otp_id: otpMeta.otp_id, otp, employer_user_id: form.employer, company_id: form.company,
        site_id: form.site || null, title: form.title, duty_hours: form.dutyHours,
        guards_required: Number(form.guards) || 1, experience_required: form.experience || undefined,
        qualification_required: form.education || undefined,
        language_requirements: form.english ? ['English'] : undefined,
      });
      setStep('done');
    } catch (e: any) { setError(e?.response?.data?.message || 'Invalid OTP or posting failed.'); } finally { setBusy(false); }
  };

  const reset = () => { setStep('form'); setOtp(''); setOtpMeta(null); setForm(f => ({ ...f, title: '', experience: '', education: '' })); };

  return (
    <Page className="max-w-2xl">
      <PageHeader title="Post Job on Behalf of Client" subtitle="Requires OTP confirmation from the client" />
      <Card>
        {step === 'form' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Client</label>
                <select value={form.employer} onChange={e => selectClient(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #e6ddd8', background: '#faf8f6', color: BROWN }}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Company</label>
                <select value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value, site: '' }))} disabled={!detail} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: '1.5px solid #e6ddd8', background: '#faf8f6', color: BROWN }}>
                  <option value="">Select company…</option>
                  {detail?.companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Site (optional)</label>
                <select value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} disabled={!form.company} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: '1.5px solid #e6ddd8', background: '#faf8f6', color: BROWN }}>
                  <option value="">Any site</option>
                  {detail?.companies.find(c => c.id === form.company)?.sites.map(s => <option key={s.id} value={s.id}>{s.site_name ?? 'Unnamed'}</option>)}
                </select>
              </div>
              <Field label="Job Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. Night CCTV Operator" />
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Job Category</label>
                <select value={form.dutyHours} onChange={e => setForm(f => ({ ...f, dutyHours: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #e6ddd8', background: '#faf8f6', color: BROWN }}>
                  {JOB_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <Field label="Associates Required" value={form.guards} onChange={v => setForm(f => ({ ...f, guards: v }))} />
              <Field label="Experience" value={form.experience} onChange={v => setForm(f => ({ ...f, experience: v }))} placeholder="e.g. 2 years" />
              <Field label="Education" value={form.education} onChange={v => setForm(f => ({ ...f, education: v }))} placeholder="e.g. 12th Pass" />
            </div>
            <label className="flex items-center gap-2 mt-2 mb-4 text-sm" style={{ color: BROWN }}>
              <input type="checkbox" checked={form.english} onChange={e => setForm(f => ({ ...f, english: e.target.checked }))} />
              Requires English proficiency
            </label>
            {error && <p className="text-xs mb-3" style={{ color: BURGUNDY }}>{error}</p>}
            <TapButton onClick={sendOtp} disabled={!form.employer || !form.company || !form.title || busy} className="w-full">
              {busy ? 'Sending…' : 'Send OTP to Client'}
            </TapButton>
          </>
        )}

        {step === 'otp' && (
          <div className="text-center py-4">
            <p className="text-sm mb-1" style={{ color: BROWN }}>Client confirmation OTP sent.</p>
            <p className="text-xs mb-4" style={{ color: 'rgba(75,46,42,0.55)' }}>
              Enter the code the client shares to confirm.
            </p>
            <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4-digit OTP"
              className="w-48 px-3.5 py-2.5 rounded-xl text-sm outline-none text-center mx-auto block mb-4" style={{ border: '1.5px solid #e6ddd8', background: '#faf8f6', color: BROWN }} />
            {error && <p className="text-xs mb-3" style={{ color: BURGUNDY }}>{error}</p>}
            <div className="flex gap-2 justify-center">
              <TapButton variant="ghost" onClick={() => setStep('form')}>Back</TapButton>
              <TapButton onClick={confirm} disabled={otp.length < 4 || busy}>{busy ? 'Posting…' : 'Confirm & Post Job'}</TapButton>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <CheckCircle size={44} className="mx-auto mb-3" style={{ color: NAVY }} />
            <p className="font-bold" style={{ color: NAVY }}>Job posted & sent for approval</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(75,46,42,0.55)' }}>Confirmed via client OTP.</p>
            <button onClick={reset} className="mt-4 text-sm font-semibold" style={{ color: BURGUNDY }}>Post another</button>
          </div>
        )}
      </Card>
    </Page>
  );
}

// ── Discounts ───────────────────────────────────────────────────────────────────

function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employer: '', type: 'percentage' as 'percentage' | 'flat', value: 10, appliesTo: '', label: 'Festival Offer' });
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([getDiscounts(), getSalesClients()]).then(([d, c]) => { setDiscounts(d); setClients(c); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const baseRate = useMemo(() => {
    const c = clients.find(x => x.id === form.employer);
    return c?.base_hourly_rate ? Number(c.base_hourly_rate) : 120;
  }, [clients, form.employer]);

  const newRate = form.type === 'percentage'
    ? Math.max(0, baseRate * (1 - form.value / 100))
    : Math.max(0, baseRate - form.value);

  const save = async () => {
    setSaving(true);
    try {
      await createDiscount({ employer_user_id: form.employer || undefined, label: form.label, discount_type: form.type, value: form.value, applies_to: form.appliesTo || undefined });
      setOpen(false); setForm(f => ({ ...f, value: 10, appliesTo: '' }));
      await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => { await deleteDiscount(id); setDiscounts(d => d.filter(x => x.id !== id)); };

  const columns: DataColumn<Discount>[] = [
    { header: 'Client', primary: true, cell: d => d.employer?.full_name ?? 'All clients' },
    { header: 'Label', cell: d => d.label },
    { header: 'Type', cell: d => <span className="capitalize">{d.discount_type}</span> },
    { header: 'Value', cell: d => <span className="font-semibold" style={{ color: BURGUNDY }}>{d.discount_type === 'percentage' ? `${Number(d.value)}%` : inr(Number(d.value))}</span> },
    { header: 'Applies To', cell: d => d.applies_to ?? '—' },
    { header: 'Status', cell: d => <Pill label={d.status} /> },
    { header: '', actions: true, cell: d => <motion.button whileTap={{ scale: 0.9 }} onClick={() => remove(d.id)} className="p-1.5 rounded-lg inline-flex items-center gap-1.5 text-sm" style={{ color: BURGUNDY }}><Trash2 size={15} /> Remove</motion.button> },
  ];

  return (
    <Page>
      <PageHeader title="Discounts & Billing" subtitle="Apply festival or volume discounts to client billing"
        action={<TapButton onClick={() => setOpen(true)}><Plus size={16} /> New Discount</TapButton>} />

      {loading ? <Loading /> : (
        <DataTable columns={columns} rows={discounts} rowKey={d => d.id} empty="No discounts yet." />
      )}

      <SlideOver open={open} onClose={() => setOpen(false)} title="New Discount" subtitle="Real-time billing preview">
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Client</label>
          <select value={form.employer} onChange={e => setForm(f => ({ ...f, employer: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #e6ddd8', background: '#faf8f6', color: BROWN }}>
            <option value="">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Field label="Label" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="e.g. Festival Offer" />
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>Type</label>
          <div className="flex gap-2">
            {(['percentage', 'flat'] as const).map(t => (
              <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => setForm(f => ({ ...f, type: t }))}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize"
                style={form.type === t ? { background: NAVY, color: 'white' } : { background: '#faf8f6', color: BROWN, border: '1.5px solid #e6ddd8' }}>{t}</motion.button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: BROWN }}>
            Discount {form.type === 'percentage' ? `— ${form.value}%` : `— ₹${form.value}`}
          </label>
          <input type="range" min={0} max={form.type === 'percentage' ? 100 : baseRate} value={form.value}
            onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} className="w-full" style={{ accentColor: BURGUNDY }} />
        </div>

        {/* Real-time billing preview */}
        <div className="rounded-xl p-4 mb-4" style={{ background: '#faf8f6', border: '1px solid #f1ece8' }}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span style={{ color: BROWN }}>Base hourly rate</span>
            <span className="font-semibold" style={{ color: BROWN }}>{inr(baseRate)}/hr</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: BROWN }}>New hourly rate</span>
            <motion.span key={newRate} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-bold text-lg" style={{ color: BURGUNDY }}>{inr(Math.round(newRate))}/hr</motion.span>
          </div>
        </div>

        <Field label="Applies To" value={form.appliesTo} onChange={v => setForm(f => ({ ...f, appliesTo: v }))} placeholder="e.g. Monthly billing" />
        <div className="flex gap-2">
          <TapButton variant="ghost" onClick={() => setOpen(false)} className="flex-1">Cancel</TapButton>
          <TapButton onClick={save} disabled={saving || !form.label} className="flex-1">{saving ? 'Saving…' : 'Apply Discount'}</TapButton>
        </div>
      </SlideOver>
    </Page>
  );
}

// ── Manpower availability heatmap ───────────────────────────────────────────────

function ManpowerPage() {
  // Mumbai-ish default center (matches seeded partner region).
  const CENTER = { lat: 19.076, lng: 72.8777 };
  const [radius, setRadius] = useState(10);
  const [result, setResult] = useState<ManpowerResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { getManpower({ lat: CENTER.lat, lng: CENTER.lng, radius }).then(setResult); }, 150);
    return () => clearTimeout(t);
  }, [radius]);

  return (
    <Page>
      <PageHeader title="Manpower Availability" subtitle="Live associate coverage around your search area" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 !p-0 overflow-hidden">
          {/* Mock map skin */}
          <div className="relative h-[420px]" style={{ background: 'linear-gradient(135deg, #e8eef6 0%, #dfe7f0 100%)' }}>
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#c9d6e8 1px, transparent 1px), linear-gradient(90deg, #c9d6e8 1px, transparent 1px)', backgroundSize: '48px 48px', opacity: 0.5 }} />
            {/* radius circle */}
            <motion.div className="absolute rounded-full" style={{ left: '50%', top: '50%', translateX: '-50%', translateY: '-50%', border: `2px solid ${BURGUNDY}`, background: 'rgba(122,38,33,0.08)' }}
              animate={{ width: 40 + radius * 22, height: 40 + radius * 22 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
            {/* center pin */}
            <div className="absolute" style={{ left: '50%', top: '50%', translate: '-50% -100%' }}>
              <MapPinned size={26} style={{ color: NAVY }} />
            </div>
            {/* partner pins spread around center */}
            {(result?.partners ?? []).slice(0, 12).map((p, i) => {
              const angle = (i / Math.max(1, Math.min(12, result?.partners.length ?? 1))) * Math.PI * 2;
              const dist = Math.min(38, (p.distance_km ?? 1) * 3 + 8);
              return (
                <motion.div key={p.id} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.05 }}
                  className="absolute" style={{ left: `calc(50% + ${Math.cos(angle) * dist}%)`, top: `calc(50% + ${Math.sin(angle) * dist}%)`, translate: '-50% -100%' }} title={p.name}>
                  <div className="w-3 h-3 rounded-full ring-2 ring-white" style={{ background: BURGUNDY }} />
                </motion.div>
              );
            })}
            <div className="absolute bottom-3 left-3 text-[11px] px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.8)', color: BROWN }}>Map preview (demo skin)</div>
          </div>
        </Card>

        <div className="space-y-4">
          <GlassStat label="Available in Radius" value={String(result?.available_count ?? '…')} icon={<Users size={18} />} accent={BURGUNDY} sub={`of ${result?.total_count ?? 0} total associates`} />
          <Card>
            <label className="block text-sm font-semibold mb-2" style={{ color: NAVY }}>Search Radius — {radius} km</label>
            <input type="range" min={1} max={15} value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full" style={{ accentColor: BURGUNDY }} />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'rgba(75,46,42,0.5)' }}><span>1 km</span><span>15 km</span></div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(75,46,42,0.55)' }}>Associates in range</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(result?.partners ?? []).map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: BROWN }}>{p.name}</span>
                  <span className="text-xs opacity-60" style={{ color: BROWN }}>{p.distance_km ?? '—'} km</span>
                </div>
              ))}
              {result && result.partners.length === 0 && <p className="text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No associates in this radius.</p>}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

export default function SalesApp({ onLogout, layout = 'desktop' }: { onLogout: () => void; layout?: 'desktop' | 'mobile' }) {
  const [page, setPage] = useState<SalesPage>('dashboard');
  const handleLogout = () => { signOut().finally(onLogout); };

  const render = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'clients': return <ClientsPage />;
      case 'post-job': return <PostJobPage />;
      case 'discounts': return <DiscountsPage />;
      case 'manpower': return <ManpowerPage />;
    }
  };

  if (layout === 'mobile') {
    return (
      <MobileChrome
        brandLabel="Sales Executive"
        title={NAV.find(n => n.id === page)?.label ?? 'Sales'}
        navItems={NAV}
        activeId={page}
        onNavigate={id => setPage(id as SalesPage)}
        onLogout={handleLogout}
        accent={BURGUNDY}
      >
        <AppLayoutProvider value="mobile">{render()}</AppLayoutProvider>
      </MobileChrome>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: PAGE_BG }}>
      <aside className="w-64 fixed top-0 left-0 h-screen flex flex-col z-50" style={{ background: NAVY_GRADIENT }}>
        <div className="px-4 py-5 border-b border-white/10">
          <GranviaLogo size={30} textColor="white" accentColor="#7A2621" />
          <p className="text-[11px] text-white/50 mt-2 pl-0.5">Sales Executive</p>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV.map(item => {
            const active = page === item.id;
            return (
              <motion.button key={item.id} onClick={() => setPage(item.id)} whileTap={{ scale: 0.97 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ color: active ? 'white' : 'rgba(255,255,255,0.6)', background: active ? 'linear-gradient(135deg, rgba(122,38,33,0.9), rgba(122,38,33,0.55))' : 'transparent' }}>
                {item.icon}{item.label}
              </motion.button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <LogOut size={18} /> Logout
          </motion.button>
        </div>
      </aside>
      <main className="flex-1 ml-64 overflow-y-auto min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {render()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

