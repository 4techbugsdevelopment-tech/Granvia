// Company Management — live branch profile + sites.
import { useEffect, useState } from 'react';
import { Building2, MapPin, Pencil, Users } from 'lucide-react';
import { getSubAdminCompany, updateSubAdminCompany, SubAdminProfile, BranchSite } from '../../services/subadminService';
import { PageHeader, Card, TapButton, SlideOver, Field } from '../ui';
import { NAVY, BROWN, BURGUNDY } from '../theme';

export default function CompanyPage() {
  const [profile, setProfile] = useState<SubAdminProfile | null>(null);
  const [sites, setSites] = useState<BranchSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<SubAdminProfile>>({});
  const [saving, setSaving] = useState(false);

  const load = () => getSubAdminCompany().then(({ profile, sites }) => { setProfile(profile); setSites(sites); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const startEdit = () => { if (profile) setDraft(profile); setOpen(true); };
  const save = async () => {
    setSaving(true);
    try { const updated = await updateSubAdminCompany(draft); setProfile(updated); setOpen(false); }
    finally { setSaving(false); }
  };

  if (loading || !profile) return <div className="p-6"><PageHeader title="Company Details" subtitle="Manage your branch business information" /><div className="py-20 text-center text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>Loading…</div></div>;

  const info: [string, string][] = [
    ['Branch Name', profile.branch_name],
    ['Registration No.', profile.registration_no ?? '—'],
    ['GST Number', profile.gst_number ?? '—'],
    ['Contact Email', profile.contact_email ?? '—'],
    ['Phone', profile.phone ?? '—'],
    ['Address', profile.address ?? '—'],
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Company Details"
        subtitle="Manage your branch business information, sites and contact points"
        action={<TapButton variant="navy" onClick={startEdit}><Pencil size={15} /> Edit Details</TapButton>}
      />

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(26,43,86,0.08)', color: NAVY }}>
            <Building2 size={22} />
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: NAVY }}>{profile.branch_name}</div>
            <div className="text-sm" style={{ color: BROWN }}>{profile.address ?? ''}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {info.map(([l, v]) => (
            <div key={l} className="flex flex-col border-b pb-2" style={{ borderColor: '#f1ece8' }}>
              <span className="text-xs uppercase tracking-wide" style={{ color: 'rgba(75,46,42,0.5)' }}>{l}</span>
              <span className="text-sm font-semibold mt-0.5" style={{ color: BROWN }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-2 mb-3">
        <MapPin size={16} style={{ color: BURGUNDY }} />
        <h2 className="font-bold" style={{ color: NAVY }}>Client Site Addresses</h2>
      </div>
      {sites.length === 0 ? (
        <Card><p className="text-sm" style={{ color: 'rgba(75,46,42,0.5)' }}>No client sites in your branch yet.</p></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map(s => (
            <Card key={s.id}>
              <div className="font-semibold" style={{ color: NAVY }}>{s.site_name ?? 'Unnamed site'}</div>
              <div className="flex items-center gap-1.5 text-xs mt-3" style={{ color: 'rgba(75,46,42,0.6)' }}>
                <Users size={13} /> {[s.city, s.state].filter(Boolean).join(', ') || '—'}
              </div>
            </Card>
          ))}
        </div>
      )}

      <SlideOver open={open} onClose={() => setOpen(false)} title="Edit Company Details" subtitle={profile.branch_name}>
        <Field label="Branch Name" value={draft.branch_name ?? ''} onChange={v => setDraft(d => ({ ...d, branch_name: v }))} />
        <Field label="Registration No." value={draft.registration_no ?? ''} onChange={v => setDraft(d => ({ ...d, registration_no: v }))} />
        <Field label="GST Number" value={draft.gst_number ?? ''} onChange={v => setDraft(d => ({ ...d, gst_number: v }))} />
        <Field label="Address" value={draft.address ?? ''} onChange={v => setDraft(d => ({ ...d, address: v }))} />
        <Field label="Contact Email" value={draft.contact_email ?? ''} onChange={v => setDraft(d => ({ ...d, contact_email: v }))} />
        <Field label="Phone" value={draft.phone ?? ''} onChange={v => setDraft(d => ({ ...d, phone: v }))} />
        <div className="flex gap-2 mt-2">
          <TapButton variant="ghost" onClick={() => setOpen(false)} className="flex-1">Cancel</TapButton>
          <TapButton onClick={save} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Save Changes'}</TapButton>
        </div>
      </SlideOver>
    </div>
  );
}
