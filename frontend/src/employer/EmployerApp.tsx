import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Bell, Briefcase, Building2, CalendarCheck, CheckCircle, ClipboardList,
  CreditCard, FileText, Handshake, LayoutDashboard, LogOut, MapPin, Menu, MessageSquare,
  Plus, Search, Settings, ShieldCheck, UserCheck, Wallet, XCircle,
} from 'lucide-react';
import GranviaLogo from '../components/GranviaLogo';
import LocationPicker from '../components/map/LocationPicker';
import MobileChrome from '../universal-mobile/MobileChrome';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';
import { getMyEmployerProfile, updateMyEmployerProfile, updateMyProfile } from '../services/profileService';
import { listMyCompanies, createCompany, updateCompany } from '../services/companyService';
import { listCompanySites, createCompanySite, updateCompanySite } from '../services/siteService';
import { listEmployerJobs, createJobPost, updateJobPost, deleteJobPost } from '../services/jobService';
import { listEmployerApplications, updateApplicationStatus, declareAssociateAadhaar } from '../services/applicationService';
import { listEmployerAttendance, updateAttendanceStatus } from '../services/attendanceService';
import { listEmployerPayments, listEmployerInvoices, createPaymentRecord, requestCashPaymentOtp, confirmCashPaymentOtp } from '../services/paymentService';
import { getEmployerWallet, listWalletTransactions } from '../services/walletService';
import {
  listInterviewRequests, createInterviewRequest, updateInterviewRequest,
  listJobOffers, createJobOffer, updateJobOffer,
  listAgreements, createAgreement, updateAgreement,
} from '../services/hiringService';
import { listCompanyDocuments, createDocumentRecord } from '../services/documentService';
import { geocodeAddress, buildSiteAddress, reverseGeocode } from '../lib/geoUtils';
import { getAadhaarStatus } from '../services/aadhaarVerificationService';
import FeedbackPage from './FeedbackPage';
import AvailableGuardsPage from './AvailableGuardsPage';
import CashPaymentPage from './CashPaymentPage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployerInfo {
  id: string;
  email: string;
  contactPersonName: string;
  mobile: string;
  city: string;
  state: string;
  pincode: string;
  isAadhaarVerified: boolean;
  aadhaarVerificationStatus: string;
  aadhaarLastFour: string;
}

type EmployerPage =
  | 'dashboard' | 'profile' | 'aadhaar' | 'companies' | 'documents' | 'sites' | 'post-job' | 'jobs' | 'applicants'
  | 'shortlisted' | 'selected' | 'available-guards' | 'interviews' | 'agreements' | 'attendance'
  | 'payments' | 'cash-payments' | 'wallet' | 'invoices' | 'reports' | 'feedback' | 'support' | 'settings';

// ── Nav ───────────────────────────────────────────────────────────────────────

// `master: true` → setup / master-data / secondary entries shown in the top-left
// drawer on mobile. The non-master items (core daily views) form the bottom nav.
const navItems: { id: EmployerPage; label: string; icon: React.ReactNode; master?: boolean }[] = [
  { id: 'dashboard',   label: 'Dashboard',                icon: <LayoutDashboard size={18} /> },
  { id: 'profile',     label: 'Profile',                  icon: <UserCheck size={18} /> },
  { id: 'companies',   label: 'Companies',                icon: <Building2 size={18} />,     master: true },
  { id: 'documents',   label: 'Company Documents',        icon: <FileText size={18} />,      master: true },
  { id: 'sites',       label: 'Sites / Locations',        icon: <MapPin size={18} />,        master: true },
  { id: 'post-job',    label: 'Post New Job',             icon: <Plus size={18} />,          master: true },
  { id: 'jobs',        label: 'Manage Jobs',              icon: <Briefcase size={18} /> },
  { id: 'applicants',  label: 'Applicants',               icon: <ClipboardList size={18} /> },
  { id: 'shortlisted', label: 'Shortlisted Associates',   icon: <ShieldCheck size={18} />,   master: true },
  { id: 'selected',    label: 'Selected / Hired',         icon: <UserCheck size={18} />,     master: true },
  { id: 'available-guards', label: 'Available Associates', icon: <Search size={18} />,        master: true },
  { id: 'interviews',  label: 'Call / Interview Requests',icon: <MessageSquare size={18} />, master: true },
  { id: 'agreements',  label: 'Agreements / Onboarding',  icon: <Handshake size={18} />,     master: true },
  { id: 'attendance',  label: 'Attendance Verification',  icon: <CalendarCheck size={18} />, master: true },
  { id: 'payments',    label: 'Payments',                 icon: <CreditCard size={18} /> },
  { id: 'cash-payments', label: 'Cash Payments (OTP)',    icon: <CreditCard size={18} />,    master: true },
  { id: 'invoices',    label: 'Invoices / Receipts',      icon: <FileText size={18} />,      master: true },
  { id: 'reports',     label: 'Reports',                  icon: <BarChart3 size={18} />,     master: true },
  { id: 'feedback',    label: 'Feedback',                 icon: <MessageSquare size={18} />, master: true },
  { id: 'support',     label: 'Support / Help',           icon: <MessageSquare size={18} />, master: true },
  { id: 'settings',    label: 'Settings',                 icon: <Settings size={18} />,      master: true },
];

const pageTitles: Record<EmployerPage, string> = Object.fromEntries(
  navItems.map(item => [item.id, item.label])
) as Record<EmployerPage, string>;

// ── Root component ────────────────────────────────────────────────────────────

interface EmployerAppProps { onLogout: () => void; layout?: 'desktop' | 'mobile' }

export default function EmployerApp({ onLogout, layout = 'desktop' }: EmployerAppProps) {
  const { profile } = useAuth();
  const [page, setPage] = useState<EmployerPage>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [employerProfile, setEmployerProfile] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  const reload = () => setRefresh(v => v + 1);

  useEffect(() => {
    getMyEmployerProfile().then(setEmployerProfile).catch(() => setEmployerProfile(null));
    listMyCompanies()
      .then(data => {
        setCompanies(data ?? []);
        setActiveCompanyId(prev => {
          if (prev && data?.some((c: any) => c.id === prev)) return prev;
          return data?.[0]?.id ?? null;
        });
      })
      .catch(console.error);
  }, [refresh]);

  if (!profile) {
    return <div className="min-h-screen grid place-items-center text-sm text-gray-500">Loading employer workspace...</div>;
  }

  const employer: EmployerInfo = {
    id: profile.id,
    email: profile.email || '',
    contactPersonName: employerProfile?.contact_person_name || profile.full_name || profile.email || '',
    mobile: profile.mobile || '',
    city: employerProfile?.city || '',
    state: employerProfile?.state || '',
    pincode: employerProfile?.pincode || '',
    isAadhaarVerified: Boolean(employerProfile?.is_aadhaar_verified),
    aadhaarVerificationStatus: employerProfile?.aadhaar_verification_status || 'pending',
    aadhaarLastFour: employerProfile?.aadhaar_last_four || '',
  };

  const activeCompany = companies.find(c => c.id === activeCompanyId) ?? companies[0] ?? null;
  const aadhaarVerified = employer.isAadhaarVerified && employer.aadhaarVerificationStatus === 'verified';

  const visibleNavItems = aadhaarVerified
    ? (companies.length === 0
        ? navItems.filter(item => ['dashboard', 'companies', 'profile'].includes(item.id))
        : navItems)
    : navItems.filter(item => item.id === 'profile' || item.id === 'aadhaar');

  const currentPage = page === 'dashboard' || aadhaarVerified || page === 'profile' || page === 'aadhaar'
    ? page
    : 'aadhaar';

  const switchCompany = (companyId: string) => {
    setActiveCompanyId(companyId);
    reload();
  };

  const handleLogout = () => signOut().finally(onLogout);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':   return <EmployerDashboard employer={employer} company={activeCompany} companies={companies} key={refresh} onNavigate={setPage} />;
      case 'profile':     return <EmployerProfile employer={employer} activeCompany={activeCompany} key={refresh} onChanged={reload} />;
      case 'aadhaar':     return <AadhaarVerificationPage key={refresh} onChanged={reload} onVerified={() => { reload(); setPage('dashboard'); }} />;
      case 'companies':   return <CompaniesPage employer={employer} activeCompanyId={activeCompany?.id ?? null} onSwitch={switchCompany} key={refresh} onChanged={reload} />;
      case 'documents':   return aadhaarVerified && activeCompany ? <CompanyDocumentsPage employer={employer} company={activeCompany} key={refresh} onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'sites':       return aadhaarVerified && activeCompany ? <SitesPage employer={employer} company={activeCompany} key={refresh} onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'post-job':    return activeCompany ? <JobFormPage employer={employer} company={activeCompany} key={refresh} onSaved={() => { reload(); setPage('jobs'); }} /> : <CompanyRequired onNavigate={setPage} />;
      case 'jobs':        return activeCompany ? <JobsPage employer={employer} company={activeCompany} key={refresh} onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'applicants':  return activeCompany ? <ApplicantsPage employer={employer} company={activeCompany} key={refresh} filter="all" onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'shortlisted': return activeCompany ? <ApplicantsPage employer={employer} company={activeCompany} key={refresh} filter="shortlisted" onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'selected':    return activeCompany ? <ApplicantsPage employer={employer} company={activeCompany} key={refresh} filter="selected" onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'interviews':  return activeCompany ? <InterviewsPage employer={employer} company={activeCompany} key={refresh} onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'agreements':  return activeCompany ? <AgreementsPage employer={employer} company={activeCompany} key={refresh} onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'attendance':  return activeCompany ? <AttendancePage company={activeCompany} key={refresh} onChanged={reload} /> : <CompanyRequired onNavigate={setPage} />;
      case 'payments':    return activeCompany ? <PaymentsPage employer={employer} company={activeCompany} key={refresh} /> : <CompanyRequired onNavigate={setPage} />;
      case 'wallet':      return <WalletPage key={refresh} />;
      case 'invoices':    return activeCompany ? <InvoicesPage company={activeCompany} /> : <CompanyRequired onNavigate={setPage} />;
      case 'reports':     return activeCompany ? <ReportsPage employer={employer} company={activeCompany} companies={companies} /> : <CompanyRequired onNavigate={setPage} />;
      case 'available-guards': return <AvailableGuardsPage />;
      case 'cash-payments':    return <CashPaymentPage />;
      case 'feedback':    return <FeedbackPage />;
      default:            return <StaticInfoPage title={pageTitles[page]} />;
    }
  };

  if (layout === 'mobile') {
    return (
      <MobileChrome
        brandLabel={`${activeCompany?.company_name ?? 'Employer'} · Aadhaar ${employer.aadhaarVerificationStatus}`}
        title={pageTitles[currentPage]}
        subtitle={activeCompany?.company_name ?? 'No company'}
        navItems={visibleNavItems}
        activeId={currentPage}
        onNavigate={id => setPage(id as EmployerPage)}
        onLogout={handleLogout}
        accent="#8b1a1a"
        headerRight={aadhaarVerified && companies.length > 1 ? (
          <select
            value={activeCompany?.id ?? ''}
            onChange={e => switchCompany(e.target.value)}
            className="text-xs rounded-lg px-2 py-1.5 max-w-[7.5rem] outline-none"
            style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f1e3c' }}
          >
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        ) : undefined}
      >
        {renderPage()}
      </MobileChrome>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f1f5f9' }}>
      <motion.aside
        className="fixed left-0 top-0 h-screen z-50 flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0a1628, #0f1e3c 65%, #120a0a)' }}
        animate={{ width: collapsed ? 76 : 280 }}
      >
        <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between">
          {!collapsed ? <GranviaLogo size={32} textColor="white" accentColor="#8b1a1a" /> : <GranviaLogo size={28} showText={false} iconColor="white" accentColor="#8b1a1a" />}
          <button onClick={() => setCollapsed(!collapsed)} className="text-white/60 hover:text-white">
            <Menu size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleNavItems.map(item => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  color: active ? 'white' : 'rgba(255,255,255,0.58)',
                  background: active ? 'linear-gradient(135deg, rgba(139,26,26,0.62), rgba(139,26,26,0.28))' : 'transparent',
                }}
              >
                {item.icon}
                {!collapsed && <span className="truncate text-left">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-red-900/30">
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      <motion.main className="flex-1 min-h-screen flex flex-col" animate={{ marginLeft: collapsed ? 76 : 280 }}>
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-sm text-gray-900">{pageTitles[currentPage]}</h1>
            <p className="text-xs text-gray-400">{activeCompany?.company_name ?? 'No company'} · Aadhaar {employer.aadhaarVerificationStatus}</p>
          </div>
          <div className="flex items-center gap-3">
            {aadhaarVerified && companies.length > 1 && (
              <select value={activeCompany?.id ?? ''} onChange={e => switchCompany(e.target.value)} className="form-input py-2 max-w-64">
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            )}
            <button className="relative p-2 rounded-xl text-gray-400 hover:bg-gray-100">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold text-gray-800">{employer.contactPersonName}</div>
              <div className="text-xs text-gray-400">Employer</div>
            </div>
            <div className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold" style={{ background: 'linear-gradient(135deg, #0f1e3c, #8b1a1a)' }}>
              {(activeCompany?.company_name || employer.contactPersonName).charAt(0)}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{renderPage()}</div>
      </motion.main>
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const s = status?.toLowerCase() ?? '';
  const green = ['active', 'verified', 'selected', 'approved', 'accepted', 'confirmed', 'paid', 'completed', 'joined'];
  const red = ['rejected', 'blocked', 'closed', 'cancelled', 'failed', 'inactive'];
  const isGreen = green.some(v => s.includes(v));
  const isRed = red.some(v => s.includes(v));
  const bg = isGreen ? '#dcfce7' : isRed ? '#fee2e2' : '#fef9c3';
  const color = isGreen ? '#166534' : isRed ? '#7c2d12' : '#854d0e';
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap capitalize" style={{ background: bg, color }}>{status}</span>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white shadow-sm border border-gray-100 ${className}`}>{children}</div>;
}

function MetricCard({ label, value, icon, color }: { label: string; value: React.ReactNode; icon: React.ReactNode; color: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase">{label}</p>
          <div className="text-2xl font-bold mt-2" style={{ color }}>{value}</div>
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}14`, color }}>{icon}</div>
      </div>
    </Card>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {headers.map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-sm text-gray-700 align-top">{children}</td>;
}

function Input({ label, value, onChange, type = 'text', className = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="form-label">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="form-input" />
    </label>
  );
}

function Sel({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="form-label">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="form-input">
        {options.map(o => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-10 text-sm text-gray-400">{text}</div>;
}

function LoadingState() {
  return <div className="p-8 text-center text-sm text-gray-400">Loading...</div>;
}

function SuccessBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
      <span><CheckCircle size={16} className="inline mr-2" />{message}</span>
      <button onClick={onClose} className="text-green-600 hover:text-green-900 font-semibold text-xs">Dismiss</button>
    </div>
  );
}

function Toolbar({ title, count, search, setSearch }: { title: string; count: number; search: string; setSearch: (v: string) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{count} record{count === 1 ? '' : 's'}</p>
      </div>
      <div className="relative min-w-72">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Search..." />
      </div>
    </div>
  );
}

function CompanyRequired({ onNavigate }: { onNavigate: (p: EmployerPage) => void }) {
  return (
    <div className="p-6">
      <Card className="p-8 text-center">
        <Building2 size={42} className="mx-auto mb-3 text-amber-600" />
        <h2 className="text-xl font-bold text-gray-900">Create a company first.</h2>
        <p className="text-sm text-gray-500 mt-2">Companies keep your documents, sites, jobs, applicants, and payments organised under the same account.</p>
        <button onClick={() => onNavigate('companies')} className="mt-5 px-5 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>Go to Companies</button>
      </Card>
    </div>
  );
}

function StaticInfoPage({ title }: { title: string }) {
  return (
    <div className="p-6">
      <Card className="p-8">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-2">This section is ready and will be fully connected in an upcoming update.</p>
      </Card>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function EmployerDashboard({ employer, company, companies, onNavigate }: { employer: EmployerInfo; company: any; companies: any[]; onNavigate: (p: EmployerPage) => void }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cid = company?.id;
    Promise.all([
      listEmployerJobs(cid).catch(() => []),
      listEmployerApplications(cid).catch(() => []),
      getEmployerWallet().catch(() => null),
      listEmployerAttendance(cid).catch(() => []),
      listEmployerPayments(cid).catch(() => []),
      cid ? listCompanySites(cid).catch(() => []) : Promise.resolve([]),
    ]).then(([j, a, w, at, p, s]) => {
      setJobs(j ?? []);
      setApps(a ?? []);
      setWallet(w);
      setAttendance(at ?? []);
      setPayments(p ?? []);
      setSites(s ?? []);
    }).finally(() => setLoading(false));
  }, [company?.id]);

  if (companies.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <Building2 size={42} className="mx-auto mb-3 text-amber-600" />
          <h2 className="text-xl font-bold text-gray-900">Create your first company to start posting jobs.</h2>
          <button onClick={() => onNavigate('companies')} className="mt-5 px-5 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>Add Company</button>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingState />;

  const activeJobs = jobs.filter(j => j.status === 'active');
  const selectedApps = apps.filter(a => ['selected', 'offer_sent', 'accepted', 'joined'].includes(a.status?.toLowerCase()));
  const pendingAttendance = attendance.filter(a => a.status === 'pending_verification');
  const pendingPayments = payments.filter(p => p.payment_status === 'pending');

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#0f1e3c' }}>Employer Dashboard</h2>
          <p className="text-sm text-gray-500">{company?.company_name ?? 'All companies'} overview</p>
        </div>
        <button onClick={() => onNavigate('post-job')} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2" style={{ background: '#0f1e3c' }}>
          <Plus size={16} /> Post Job
        </button>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total Jobs"          value={jobs.length}          icon={<Briefcase size={20} />}      color="#0f1e3c" />
        <MetricCard label="Total Companies"     value={companies.length}     icon={<Building2 size={20} />}      color="#334155" />
        <MetricCard label="Active Companies"    value={companies.filter(c => c.account_status === 'active').length} icon={<CheckCircle size={20} />} color="#166534" />
        <MetricCard label="Total Sites"         value={sites.length}         icon={<MapPin size={20} />}         color="#1d4ed8" />
        <MetricCard label="Active Jobs"         value={activeJobs.length}    icon={<CheckCircle size={20} />}    color="#166534" />
        <MetricCard label="Applicants"          value={apps.length}          icon={<ClipboardList size={20} />}  color="#1d4ed8" />
        <MetricCard label="Selected Associates" value={selectedApps.length}  icon={<UserCheck size={20} />}      color="#0f766e" />
        <MetricCard label="Pending Attendance"  value={pendingAttendance.length} icon={<CalendarCheck size={20} />} color="#854d0e" />
        <MetricCard label="Pending Payments"    value={pendingPayments.length}   icon={<CreditCard size={20} />}    color="#7c2d12" />
        <MetricCard label="Wallet Balance"      value={`Rs ${wallet?.balance ?? 0}`} icon={<Wallet size={20} />} color="#065f46" />
        <MetricCard label="Closed Jobs"         value={jobs.filter(j => j.status === 'closed').length} icon={<XCircle size={20} />} color="#7c2d12" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold text-gray-900 mb-4">Recent Applications</h3>
          {apps.slice(0, 6).map((app: any) => (
            <div key={app.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-800">{app.guard_profiles?.full_name ?? 'Associate'}</p>
                <p className="text-xs text-gray-400">{app.job_posts?.title} · {new Date(app.applied_at).toLocaleDateString('en-IN')}</p>
              </div>
              {statusBadge(app.status)}
            </div>
          ))}
          {apps.length === 0 && <EmptyState text="No applications yet" />}
        </Card>
        <Card className="p-5">
          <h3 className="font-bold text-gray-900 mb-4">Upcoming Active Jobs</h3>
          {activeJobs.slice(0, 5).map((job: any) => (
            <div key={job.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-800">{job.title}</p>
                <p className="text-xs text-gray-400">{job.company_sites?.site_name} · {job.shift_type} · {job.duty_hours}</p>
              </div>
              {statusBadge(job.status)}
            </div>
          ))}
          {activeJobs.length === 0 && <EmptyState text="No active jobs" />}
        </Card>
      </div>
    </div>
  );
}

// ── Aadhaar verification page (manual declaration by admin) ────────────────────

function AadhaarVerificationPage({ onChanged, onVerified: _onVerified }: { onChanged: () => void; onVerified?: () => void }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getAadhaarStatus().then(setStatus).catch(() => setStatus(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const state = status?.aadhaar_verification_status ?? 'pending';
  const isVerified = status?.is_aadhaar_verified && state === 'verified';
  const isRejected = state === 'rejected';

  return (
    <div className="p-6 max-w-3xl">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Aadhaar Verification</h2>
            <p className="text-sm text-gray-500 mt-1">Aadhaar verification is handled manually by the Granvia team.</p>
          </div>
          {status && statusBadge(state)}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading status…</p>
        ) : isVerified ? (
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-4 text-green-700">
            Aadhaar verified.{status.aadhaar_last_four ? <> Last four digits: <b>{status.aadhaar_last_four}</b></> : null}
          </div>
        ) : isRejected ? (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-4 text-red-700">
            Your Aadhaar verification was not approved. Please contact your administrator.
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-4 text-amber-800">
            <p className="font-semibold">Verification pending</p>
            <p className="text-sm mt-1">An administrator will verify your Aadhaar shortly. You'll get full access to employer features once approved. Self-service verification is temporarily unavailable.</p>
          </div>
        )}

        <button onClick={() => { load(); onChanged(); }} className="mt-5 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#eef2f7', color: '#0f1e3c' }}>Refresh status</button>
      </Card>
    </div>
  );
}

// ── Employer profile ──────────────────────────────────────────────────────────

function EmployerProfile({ employer, activeCompany, onChanged }: { employer: EmployerInfo; activeCompany: any; onChanged: () => void }) {
  const [form, setForm] = useState({ contactPersonName: employer.contactPersonName, mobile: employer.mobile, city: employer.city, state: employer.state, pincode: employer.pincode });
  const [docs, setDocs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeCompany?.id) listCompanyDocuments(activeCompany.id).then(setDocs).catch(() => setDocs([]));
  }, [activeCompany?.id]);

  const save = async () => {
    setSaving(true);
    try {
      await updateMyEmployerProfile({ contact_person_name: form.contactPersonName, city: form.city, state: form.state, pincode: form.pincode });
      await updateMyProfile({ mobile: form.mobile });
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally { setSaving(false); }
  };

  const uploadDoc = async (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0];
    if (!file || !activeCompany?.id) return;
    if (file.size > 5 * 1024 * 1024) { alert('File must be under 5 MB.'); return; }
    try {
      await createDocumentRecord(activeCompany.id, type, file);
      listCompanyDocuments(activeCompany.id).then(setDocs).catch(() => null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
          <button disabled={saving} onClick={save} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>{saving ? 'Saving...' : 'Save Profile'}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Contact Person Name" value={form.contactPersonName} onChange={v => setForm({ ...form, contactPersonName: v })} />
          <Input label="Mobile" value={form.mobile} onChange={v => setForm({ ...form, mobile: v })} />
          <Input label="Email" value={employer.email} onChange={() => {}} />
          <Input label="City" value={form.city} onChange={v => setForm({ ...form, city: v })} />
          <Input label="State" value={form.state} onChange={v => setForm({ ...form, state: v })} />
          <Input label="Pincode" value={form.pincode} onChange={v => setForm({ ...form, pincode: v })} />
        </div>
      </Card>

      {activeCompany && (
        <Card className="p-5">
          <h3 className="font-bold text-gray-900 mb-4">Verification Documents — {activeCompany.company_name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
            {['Company Registration', 'GST Certificate', 'PAN Card', 'Authorized Person ID', 'Address Proof'].map(type => (
              <label key={type} className="rounded-xl border border-dashed border-gray-300 p-4 text-center cursor-pointer hover:border-blue-300">
                <span className="text-xs font-semibold text-gray-600">{type}</span>
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e => uploadDoc(e, type)} />
              </label>
            ))}
          </div>
          <DataTable headers={['Type', 'File', 'Size', 'Uploaded', 'Status']}>
            {docs.map((doc: any) => (
              <tr key={doc.id} className="border-b border-gray-50">
                <Td>{doc.document_type}</Td>
                <Td>{doc.file_path?.split('/').pop()}</Td>
                <Td>{doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : '--'}</Td>
                <Td>{new Date(doc.created_at).toLocaleDateString('en-IN')}</Td>
                <Td>{statusBadge(doc.verification_status)}</Td>
              </tr>
            ))}
          </DataTable>
          {docs.length === 0 && <EmptyState text="No documents uploaded yet" />}
        </Card>
      )}
    </div>
  );
}

// ── Companies ─────────────────────────────────────────────────────────────────

function CompaniesPage({ employer, activeCompanyId, onSwitch, onChanged }: { employer: EmployerInfo; activeCompanyId: string | null; onSwitch: (id: string) => void; onChanged: () => void }) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '', business_type: '', registration_type: 'Private Limited', gst_number: '', pan_number: '',
    company_email: employer.email, company_phone: employer.mobile, website: '', registered_address: '', billing_address: '',
    city: employer.city, state: employer.state, pincode: employer.pincode, description: '',
  });

  useEffect(() => {
    listMyCompanies().then(setCompanies).catch(console.error);
  }, []);

  const saveCompany = async () => {
    if (!form.company_name.trim() || !form.business_type.trim() || !form.registered_address.trim()) {
      alert('Company name, business type and registered address are required.');
      return;
    }
    setSaving(true);
    try {
      const company = await createCompany({
        company_name: form.company_name.trim(),
        business_type: form.business_type.trim(),
        registration_type: form.registration_type,
        gst_number: form.gst_number.trim().toUpperCase(),
        pan_number: form.pan_number.trim().toUpperCase(),
        company_email: form.company_email.trim().toLowerCase(),
        company_phone: form.company_phone.trim(),
        website: form.website.trim(),
        registered_address: form.registered_address.trim(),
        billing_address: form.billing_address.trim() || form.registered_address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        description: form.description.trim(),
      });
      onSwitch(company.id);
      setForm({ ...form, company_name: '', business_type: '', gst_number: '', pan_number: '', website: '', registered_address: '', billing_address: '', description: '' });
      listMyCompanies().then(setCompanies).catch(console.error);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create company.');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <Card className="p-5">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add Company</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input label="Company Name" value={form.company_name} onChange={v => setForm({ ...form, company_name: v })} />
          <Input label="Business Type" value={form.business_type} onChange={v => setForm({ ...form, business_type: v })} />
          <Sel label="Registration Type" value={form.registration_type} options={['Private Limited', 'Partnership', 'Proprietorship', 'LLP', 'Trust', 'Other']} onChange={v => setForm({ ...form, registration_type: v })} />
          <Input label="GST Number" value={form.gst_number} onChange={v => setForm({ ...form, gst_number: v })} />
          <Input label="PAN Number" value={form.pan_number} onChange={v => setForm({ ...form, pan_number: v })} />
          <Input label="Company Email" value={form.company_email} onChange={v => setForm({ ...form, company_email: v })} />
          <Input label="Company Phone" value={form.company_phone} onChange={v => setForm({ ...form, company_phone: v })} />
          <Input label="Website" value={form.website} onChange={v => setForm({ ...form, website: v })} />
          <Input label="City" value={form.city} onChange={v => setForm({ ...form, city: v })} />
          <Input label="State" value={form.state} onChange={v => setForm({ ...form, state: v })} />
          <Input label="Pincode" value={form.pincode} onChange={v => setForm({ ...form, pincode: v })} />
        </div>
        <Input className="mt-3" label="Registered Address" value={form.registered_address} onChange={v => setForm({ ...form, registered_address: v })} />
        <Input className="mt-3" label="Billing Address" value={form.billing_address} onChange={v => setForm({ ...form, billing_address: v })} />
        <label className="block mt-3">
          <span className="form-label">Description</span>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="form-input min-h-20" />
        </label>
        <button disabled={saving} onClick={saveCompany} className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>{saving ? 'Saving...' : 'Save Company'}</button>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-gray-900 mb-4">Company List</h3>
        <DataTable headers={['Company', 'Registration', 'Location', 'Verification', 'Account', 'Actions']}>
          {companies.map((company: any) => (
            <tr key={company.id} className="border-b border-gray-50">
              <Td><b>{company.company_name}</b><div className="text-xs text-gray-400">{company.business_type}</div></Td>
              <Td>{company.registration_type}<div className="text-xs text-gray-400">GST {company.gst_number || '--'} / PAN {company.pan_number || '--'}</div></Td>
              <Td>{company.city}, {company.state}</Td>
              <Td>{statusBadge(company.verification_status)}</Td>
              <Td>{statusBadge(company.account_status)}</Td>
              <Td>
                <button onClick={() => onSwitch(company.id)} className="table-action tone-blue">{activeCompanyId === company.id ? 'Active' : 'Switch'}</button>
                <button onClick={async () => { await updateCompany(company.id, { account_status: company.account_status === 'inactive' ? 'active' : 'inactive' }); listMyCompanies().then(setCompanies).catch(console.error); onChanged(); }} className="table-action">
                  {company.account_status === 'inactive' ? 'Reactivate' : 'Deactivate'}
                </button>
              </Td>
            </tr>
          ))}
        </DataTable>
        {companies.length === 0 && <EmptyState text="No companies yet. Add your first company above." />}
      </Card>
    </div>
  );
}

// ── Company documents ─────────────────────────────────────────────────────────

function CompanyDocumentsPage({ employer: _employer, company, onChanged }: { employer: EmployerInfo; company: any; onChanged: () => void }) {
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    listCompanyDocuments(company.id).then(setDocs).catch(console.error);
  }, [company.id]);

  const uploadDoc = async (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File must be under 5 MB.'); return; }
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) { alert('Only PDF, PNG and JPG files are allowed.'); return; }
    try {
      await createDocumentRecord(company.id, type, file);
      listCompanyDocuments(company.id).then(setDocs).catch(console.error);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  return (
    <div className="p-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Company Documents</h2>
            <p className="text-sm text-gray-500">{company.company_name} · {statusBadge(company.verification_status)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-5">
          {['Company Registration', 'GST Certificate', 'PAN Card', 'Address Proof', 'Authorized Person ID', 'Other Supporting Document'].map(type => (
            <label key={type} className="rounded-xl border border-dashed border-gray-300 p-4 text-center cursor-pointer hover:border-blue-300">
              <span className="text-xs font-semibold text-gray-600">{type}</span>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e => uploadDoc(e, type)} />
            </label>
          ))}
        </div>
        <DataTable headers={['Type', 'File', 'Size', 'Uploaded', 'Status', 'Remarks']}>
          {docs.map((doc: any) => (
            <tr key={doc.id} className="border-b border-gray-50">
              <Td>{doc.document_type}</Td>
              <Td>{doc.file_path?.split('/').pop()}</Td>
              <Td>{doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : '--'}</Td>
              <Td>{new Date(doc.created_at).toLocaleDateString('en-IN')}</Td>
              <Td>{statusBadge(doc.verification_status)}</Td>
              <Td>{doc.admin_remarks || doc.rejection_reason || '--'}</Td>
            </tr>
          ))}
        </DataTable>
        {docs.length === 0 && <EmptyState text="No documents uploaded for this company" />}
      </Card>
    </div>
  );
}

// ── Sites ─────────────────────────────────────────────────────────────────────

// ── Shared site location section (add & edit both use this) ──────────────────

type SiteFormState = {
  site_name: string; site_type: string; address: string; city: string; state: string;
  pincode: string; contact_person: string; contact_mobile: string;
  latitude: string; longitude: string; shift_details: string; notes: string; status: string;
};

function SiteLocationSection({
  form,
  setForm,
}: {
  form: SiteFormState;
  setForm: React.Dispatch<React.SetStateAction<SiteFormState>>;
}) {
  const [geocoding, setGeocoding]       = useState(false);
  const [revGeocoding, setRevGeocoding] = useState(false);
  const [locSource, setLocSource]       = useState<'manual' | 'geocoded' | null>(
    form.latitude && form.longitude ? 'manual' : null,
  );
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When true, the next run of the forward-geocode effect is skipped.
  // Set before updating address fields from a reverse geocode result so we
  // don't create an infinite address→pin→address loop.
  const suppressFwdRef = useRef(false);

  // Forward geocode: fires 900 ms after address fields change.
  // Always runs — address entry overrides any previous pin.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Skip if this address update came from reverse geocoding
    if (suppressFwdRef.current) {
      suppressFwdRef.current = false;
      return;
    }

    const addrStr = buildSiteAddress({
      address: form.address, city: form.city, state: form.state, pincode: form.pincode,
    });
    const meaningful = addrStr.replace(/,?\s*India\s*$/i, '').trim();
    if (!meaningful) return;

    timerRef.current = setTimeout(async () => {
      setGeocoding(true);
      const pos = await geocodeAddress(addrStr);
      if (pos) {
        setForm(f => ({ ...f, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
        setLocSource('geocoded');
      }
      setGeocoding(false);
    }, 900);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, form.city, form.state, form.pincode]);

  const mapValue = form.latitude && form.longitude
    ? { lat: Number(form.latitude), lng: Number(form.longitude) }
    : null;

  // Reverse geocode when pin is moved (click or drag) and fill address fields
  const handleMapChange = async ({ lat, lng }: { lat: number; lng: number }) => {
    setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
    setLocSource('manual');
    setRevGeocoding(true);
    const result = await reverseGeocode(lat, lng);
    if (result) {
      // Suppress the forward-geocode effect that would fire when we update
      // these address fields — we don't want to re-geocode what we just reversed.
      suppressFwdRef.current = true;
      setForm(f => ({
        ...f,
        latitude:  lat.toFixed(6),
        longitude: lng.toFixed(6),
        address:   result.address || f.address,
        city:      result.city    || f.city,
        state:     result.state   || f.state,
        pincode:   result.pincode || f.pincode,
      }));
    }
    setRevGeocoding(false);
  };

  const handleLatInput = (v: string) => {
    setForm(f => ({ ...f, latitude: v }));
    if (v && form.longitude) setLocSource('manual');
  };

  const handleLngInput = (v: string) => {
    setForm(f => ({ ...f, longitude: v }));
    if (form.latitude && v) setLocSource('manual');
  };

  const clearPin = () => {
    setForm(f => ({ ...f, latitude: '', longitude: '' }));
    setLocSource(null);
  };

  return (
    <div className="mt-4 space-y-2">
      {/* Section label */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">📍 Site Location</p>
        {mapValue && (
          <button onClick={clearPin} className="text-xs text-red-500 hover:underline">Clear pin</button>
        )}
      </div>

      {/* Lat / Lng inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Latitude</label>
          <input
            type="number"
            step="any"
            placeholder="e.g. 19.0760"
            value={form.latitude}
            onChange={e => handleLatInput(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Longitude</label>
          <input
            type="number"
            step="any"
            placeholder="e.g. 72.8777"
            value={form.longitude}
            onChange={e => handleLngInput(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* Status chip */}
      <div className="flex items-center gap-2 text-xs">
        {(geocoding || revGeocoding) && (
          <span className="flex items-center gap-1 text-blue-500">
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {revGeocoding ? 'Fetching address from pin…' : 'Locating from address…'}
          </span>
        )}
        {!geocoding && !revGeocoding && locSource === 'geocoded' && mapValue && (
          <span className="text-amber-600">📌 Auto-located from address · {mapValue.lat.toFixed(5)}, {mapValue.lng.toFixed(5)}</span>
        )}
        {!geocoding && !revGeocoding && locSource === 'manual' && mapValue && (
          <span className="text-green-700">✅ Manually pinned · {mapValue.lat.toFixed(5)}, {mapValue.lng.toFixed(5)}</span>
        )}
        {!geocoding && !revGeocoding && !locSource && (
          <span className="text-gray-400">Enter lat/lng, type an address, or click the map to place a pin</span>
        )}
      </div>

      {/* Map */}
      <div style={{ height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <LocationPicker
          value={mapValue}
          onChange={handleMapChange}
          zoom={5}
        />
      </div>
      <p className="text-xs text-gray-400">
        Click anywhere on the map to drop a pin · Drag the pin to adjust · Or type coordinates above
      </p>
    </div>
  );
}

// ── SitesPage ─────────────────────────────────────────────────────────────────

function SitesPage({ employer, company, onChanged }: { employer: EmployerInfo; company: any; onChanged: () => void }) {
  const [sites, setSites]           = useState<any[]>([]);
  const [saving, setSaving]         = useState(false);
  const [editingSite, setEditingSite] = useState<any | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const blankForm = (): SiteFormState => ({
    site_name: '', site_type: 'Office', address: '', city: company.city ?? '', state: company.state ?? '',
    pincode: company.pincode ?? '', contact_person: employer.contactPersonName,
    contact_mobile: company.company_phone ?? employer.mobile,
    latitude: '', longitude: '', shift_details: '', notes: '', status: 'active',
  });

  const [form, setForm] = useState<SiteFormState>(blankForm);
  const [editForm, setEditForm] = useState<SiteFormState>(blankForm);

  const reloadSites = () => listCompanySites(company.id).then(setSites).catch(console.error);

  useEffect(() => { reloadSites(); }, [company.id]);

  const saveSite = async () => {
    if (!form.site_name || !form.address || !form.contact_mobile) {
      alert('Site name, address and contact mobile are required.');
      return;
    }
    setSaving(true);
    try {
      await createCompanySite({
        company_id: company.id,
        site_name: form.site_name.trim(),
        site_type: form.site_type,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        contact_person: form.contact_person.trim(),
        contact_mobile: form.contact_mobile.trim(),
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        shift_details: form.shift_details.trim(),
        notes: form.notes.trim(),
        status: 'active',
      });
      setForm(blankForm());
      reloadSites();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save site.');
    } finally { setSaving(false); }
  };

  const openEdit = (site: any) => {
    setEditingSite(site);
    setEditForm({
      site_name:       site.site_name ?? '',
      site_type:       site.site_type ?? 'Office',
      address:         site.address ?? '',
      city:            site.city ?? '',
      state:           site.state ?? '',
      pincode:         site.pincode ?? '',
      contact_person:  site.contact_person ?? '',
      contact_mobile:  site.contact_mobile ?? '',
      latitude:        site.latitude != null ? String(site.latitude) : '',
      longitude:       site.longitude != null ? String(site.longitude) : '',
      shift_details:   site.shift_details ?? '',
      notes:           site.notes ?? '',
      status:          site.status ?? 'active',
    });
  };

  const saveEdit = async () => {
    if (!editingSite) return;
    setEditSaving(true);
    try {
      await updateCompanySite(editingSite.id, {
        site_name:      editForm.site_name.trim(),
        site_type:      editForm.site_type,
        address:        editForm.address.trim(),
        city:           editForm.city.trim(),
        state:          editForm.state.trim(),
        pincode:        editForm.pincode.trim(),
        contact_person: editForm.contact_person.trim(),
        contact_mobile: editForm.contact_mobile.trim(),
        latitude:       editForm.latitude ? Number(editForm.latitude) : null,
        longitude:      editForm.longitude ? Number(editForm.longitude) : null,
        shift_details:  editForm.shift_details.trim(),
        notes:          editForm.notes.trim(),
      });
      setEditingSite(null);
      reloadSites();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update site.');
    } finally { setEditSaving(false); }
  };

  return (
    <div className="p-6 space-y-5">
      {/* ── Add site form ── */}
      <Card className="p-5">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add Site / Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input label="Site Name"      value={form.site_name}       onChange={v => setForm(f => ({ ...f, site_name: v }))} />
          <Sel   label="Site Type"      value={form.site_type}       options={['Office','Mall','Warehouse','Factory','Society','Event','Hospital','School']} onChange={v => setForm(f => ({ ...f, site_type: v }))} />
          <Input label="City"           value={form.city}            onChange={v => setForm(f => ({ ...f, city: v }))} />
          <Input label="State"          value={form.state}           onChange={v => setForm(f => ({ ...f, state: v }))} />
          <Input label="Pincode"        value={form.pincode}         onChange={v => setForm(f => ({ ...f, pincode: v }))} />
          <Input label="Site Contact"   value={form.contact_person}  onChange={v => setForm(f => ({ ...f, contact_person: v }))} />
          <Input label="Contact Mobile" value={form.contact_mobile}  onChange={v => setForm(f => ({ ...f, contact_mobile: v }))} />
        </div>
        <Input className="mt-3" label="Site Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <Input label="Shift Details" value={form.shift_details} onChange={v => setForm(f => ({ ...f, shift_details: v }))} />
          <Input label="Notes"         value={form.notes}         onChange={v => setForm(f => ({ ...f, notes: v }))} />
        </div>

        {/* Location section with map */}
        <SiteLocationSection form={form} setForm={setForm} />

        <button
          disabled={saving}
          onClick={saveSite}
          className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#0f1e3c' }}
        >
          {saving ? 'Saving…' : 'Save Site'}
        </button>
      </Card>

      {/* ── Sites table ── */}
      <Card className="p-5">
        <h3 className="font-bold text-gray-900 mb-4">Sites</h3>
        <DataTable headers={['Site', 'Type', 'Location', 'Contact', 'Status', 'Actions']}>
          {sites.map((site: any) => (
            <tr key={site.id} className="border-b border-gray-50">
              <Td><b>{site.site_name}</b></Td>
              <Td>{site.site_type}</Td>
              <Td>
                {site.city}{site.state ? `, ${site.state}` : ''}
                <div className="text-xs text-gray-400">
                  {site.latitude && site.longitude
                    ? `📍 ${Number(site.latitude).toFixed(4)}, ${Number(site.longitude).toFixed(4)}`
                    : <span className="text-amber-500">No coordinates</span>}
                </div>
              </Td>
              <Td>
                {site.contact_person}
                <div className="text-xs text-gray-400">{site.contact_mobile}</div>
              </Td>
              <Td>{statusBadge(site.status)}</Td>
              <Td>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(site)} className="table-action tone-blue">Edit</button>
                  <button
                    onClick={async () => {
                      await updateCompanySite(site.id, { status: site.status === 'active' ? 'inactive' : 'active' });
                      reloadSites();
                      onChanged();
                    }}
                    className="table-action"
                  >
                    {site.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
        {sites.length === 0 && <EmptyState text="No sites added yet" />}
      </Card>

      {/* ── Edit site drawer ── */}
      {editingSite && (
        <div
          className="fixed inset-0 flex items-end md:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1500 }}
          onClick={() => setEditingSite(null)}
        >
          <div
            className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl shadow-2xl overflow-y-auto"
            style={{ maxHeight: '92vh', zIndex: 1501, isolation: 'isolate' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-6 pt-4 pb-8">
              <h3 className="font-bold text-gray-900 text-lg mb-4">Edit Site</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Site Name"      value={editForm.site_name}       onChange={v => setEditForm(f => ({ ...f, site_name: v }))} />
                <Sel   label="Site Type"      value={editForm.site_type}       options={['Office','Mall','Warehouse','Factory','Society','Event','Hospital','School']} onChange={v => setEditForm(f => ({ ...f, site_type: v }))} />
                <Input label="City"           value={editForm.city}            onChange={v => setEditForm(f => ({ ...f, city: v }))} />
                <Input label="State"          value={editForm.state}           onChange={v => setEditForm(f => ({ ...f, state: v }))} />
                <Input label="Pincode"        value={editForm.pincode}         onChange={v => setEditForm(f => ({ ...f, pincode: v }))} />
                <Input label="Site Contact"   value={editForm.contact_person}  onChange={v => setEditForm(f => ({ ...f, contact_person: v }))} />
                <Input label="Contact Mobile" value={editForm.contact_mobile}  onChange={v => setEditForm(f => ({ ...f, contact_mobile: v }))} />
                <Input label="Shift Details"  value={editForm.shift_details}   onChange={v => setEditForm(f => ({ ...f, shift_details: v }))} />
                <Input label="Notes"          value={editForm.notes}           onChange={v => setEditForm(f => ({ ...f, notes: v }))} />
              </div>
              <Input className="mt-3" label="Site Address" value={editForm.address} onChange={v => setEditForm(f => ({ ...f, address: v }))} />

              {/* Location section with map */}
              <SiteLocationSection form={editForm} setForm={setEditForm} />

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setEditingSite(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: editSaving ? '#94a3b8' : '#0f1e3c' }}
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Post job ──────────────────────────────────────────────────────────────────

function JobFormPage({ employer: _employer, company, onSaved }: { employer: EmployerInfo; company: any; onSaved: () => void }) {
  const [sites, setSites] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState({
    title: '', site_id: '', guards_required: '1', category: 'Associate', guard_type: 'Associate',
    gender_preference: 'Any', experience_required: '0-1 years', qualification_required: '12th Pass', salary_amount: '', payment_type: 'Monthly',
    duty_hours: '8 hours', shift_type: 'Day', start_date: '', end_date: '', duration_type: 'Monthly',
    required_skills: 'Security,Patrolling', language_requirements: 'Hindi,English',
    police_verification_required: true, uniform_required: true, food_facility: false, accommodation_facility: false,
    description: '', special_instructions: '', status: 'pending_approval',
  });

  useEffect(() => {
    listCompanySites(company.id).then(data => {
      const active = (data ?? []).filter((s: any) => s.status === 'active');
      setSites(active);
      if (active.length > 0) setJob(j => ({ ...j, site_id: active[0].id }));
    }).catch(console.error);
  }, [company.id]);

  const saveJob = async () => {
    if (!job.site_id || !job.title || !job.salary_amount || !job.start_date) { alert('Select a site and complete title, salary and start date.'); return; }
    setSaving(true);
    try {
      await createJobPost({
        company_id: company.id,
        site_id: job.site_id,
        title: job.title,
        category: job.category,
        guard_type: job.guard_type,
        guards_required: Number(job.guards_required) || 1,
        gender_preference: job.gender_preference,
        experience_required: job.experience_required,
        qualification_required: job.qualification_required,
        salary_amount: Number(job.salary_amount),
        payment_type: job.payment_type,
        duty_hours: job.duty_hours,
        shift_type: job.shift_type,
        start_date: job.start_date || null,
        end_date: job.end_date || null,
        duration_type: job.duration_type,
        required_skills: job.required_skills.split(',').map(s => s.trim()).filter(Boolean),
        language_requirements: job.language_requirements.split(',').map(s => s.trim()).filter(Boolean),
        police_verification_required: job.police_verification_required,
        uniform_required: job.uniform_required,
        food_facility: job.food_facility,
        accommodation_facility: job.accommodation_facility,
        description: job.description,
        special_instructions: job.special_instructions,
        status: job.status,
      });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create job.');
    } finally { setSaving(false); }
  };

  if (sites.length === 0) return <div className="p-6"><Card className="p-8"><EmptyState text="Add an active site before posting a job." /></Card></div>;

  return (
    <div className="p-6">
      <Card className="p-5">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Post New Job</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input label="Job Title" value={job.title} onChange={v => setJob({ ...job, title: v })} />
          <Sel label="Site / Location" value={job.site_id} options={sites.map(s => s.id)} labels={Object.fromEntries(sites.map(s => [s.id, s.site_name]))} onChange={v => setJob({ ...job, site_id: v })} />
          <Input label="Associates Required" value={job.guards_required} onChange={v => setJob({ ...job, guards_required: v })} />
          <Input label="Category" value={job.category} onChange={v => setJob({ ...job, category: v })} />
          <Input label="Associate Type" value={job.guard_type} onChange={v => setJob({ ...job, guard_type: v })} />
          <Sel label="Gender Preference" value={job.gender_preference} options={['Any', 'Male', 'Female']} onChange={v => setJob({ ...job, gender_preference: v })} />
          <Input label="Experience" value={job.experience_required} onChange={v => setJob({ ...job, experience_required: v })} />
          <Sel label="Qualification" value={job.qualification_required} options={['Any', 'Below 10th', '10th Pass', '12th Pass', 'Graduate', 'Post Graduate']} onChange={v => setJob({ ...job, qualification_required: v })} />
          <Input label="Salary / Payment" value={job.salary_amount} onChange={v => setJob({ ...job, salary_amount: v })} />
          <Sel label="Payment Type" value={job.payment_type} options={['Daily', 'Monthly', 'Contract', 'Shift-based']} onChange={v => setJob({ ...job, payment_type: v })} />
          <Input label="Duty Hours" value={job.duty_hours} onChange={v => setJob({ ...job, duty_hours: v })} />
          <Sel label="Shift Type" value={job.shift_type} options={['Day', 'Night', 'Rotational']} onChange={v => setJob({ ...job, shift_type: v })} />
          <Input label="Start Date" type="date" value={job.start_date} onChange={v => setJob({ ...job, start_date: v })} />
          <Input label="End Date" type="date" value={job.end_date} onChange={v => setJob({ ...job, end_date: v })} />
          <Sel label="Duration" value={job.duration_type} options={['One day', 'Monthly', 'Long-term', 'Contract-based']} onChange={v => setJob({ ...job, duration_type: v })} />
          <Sel label="Status" value={job.status} options={['draft', 'active']} onChange={v => setJob({ ...job, status: v })} />
          <Input label="Required Skills" value={job.required_skills} onChange={v => setJob({ ...job, required_skills: v })} />
          <Input label="Languages" value={job.language_requirements} onChange={v => setJob({ ...job, language_requirements: v })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          {([['Police Verification Required', 'police_verification_required'], ['Uniform Required', 'uniform_required'], ['Food Facility', 'food_facility'], ['Accommodation Facility', 'accommodation_facility']] as const).map(([label, key]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700 rounded-xl bg-gray-50 px-3 py-3">
              <input type="checkbox" checked={Boolean(job[key as keyof typeof job])} onChange={e => setJob({ ...job, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <label className="block mt-4">
          <span className="form-label">Job Description</span>
          <textarea value={job.description} onChange={e => setJob({ ...job, description: e.target.value })} className="form-input min-h-24" />
        </label>
        <label className="block mt-4">
          <span className="form-label">Special Instructions</span>
          <textarea value={job.special_instructions} onChange={e => setJob({ ...job, special_instructions: e.target.value })} className="form-input min-h-20" />
        </label>
        <button disabled={saving} onClick={saveJob} className="mt-5 px-5 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#0f1e3c' }}>{saving ? 'Saving...' : 'Save Job'}</button>
      </Card>
    </div>
  );
}

// ── Manage jobs ───────────────────────────────────────────────────────────────

function JobsPage({ employer: _employer, company, onChanged }: { employer: EmployerInfo; company: any; onChanged: () => void }) {
  const [jobs, setJobs]           = useState<any[]>([]);
  const [sites, setSites]         = useState<any[]>([]);
  const [search, setSearch]       = useState('');
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [editForm, setEditForm]   = useState<Record<string, any>>({});
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = () => listEmployerJobs(company.id).then(setJobs).catch(console.error);

  useEffect(() => {
    reload();
    listCompanySites(company.id).then(data => setSites((data ?? []).filter((s: any) => s.status === 'active'))).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const openEdit = (job: any) => {
    setEditingJob(job);
    setEditForm({
      title:               job.title ?? '',
      site_id:             job.site_id ?? '',
      guards_required:     String(job.guards_required ?? 1),
      salary_amount:       String(job.salary_amount ?? ''),
      payment_type:        job.payment_type ?? 'Monthly',
      shift_type:          job.shift_type ?? 'Day',
      duty_hours:          job.duty_hours ?? '8 hours',
      start_date:          job.start_date ?? '',
      end_date:            job.end_date ?? '',
      duration_type:       job.duration_type ?? 'Monthly',
      experience_required: job.experience_required ?? '',
      guards_type:         job.guard_type ?? '',
      description:         job.description ?? '',
      required_skills:     Array.isArray(job.required_skills) ? job.required_skills.join(', ') : (job.required_skills ?? ''),
    });
  };

  const saveEdit = async () => {
    if (!editingJob) return;
    setSaving(true);
    try {
      await updateJobPost(editingJob.id, {
        title:               editForm.title,
        site_id:             editForm.site_id,
        guards_required:     Number(editForm.guards_required) || 1,
        salary_amount:       Number(editForm.salary_amount),
        payment_type:        editForm.payment_type,
        shift_type:          editForm.shift_type,
        duty_hours:          editForm.duty_hours,
        start_date:          editForm.start_date || null,
        end_date:            editForm.end_date || null,
        duration_type:       editForm.duration_type,
        experience_required: editForm.experience_required,
        description:         editForm.description,
        required_skills:     editForm.required_skills.split(',').map((s: string) => s.trim()).filter(Boolean),
      });
      setEditingJob(null);
      reload();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (jobId: string) => {
    setDeletingId(jobId);
    try {
      await deleteJobPost(jobId);
      setConfirmDeleteId(null);
      reload();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = jobs.filter(j =>
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.company_sites?.site_name?.toLowerCase().includes(search.toLowerCase())
  );

  const ef = editForm;
  const set = (k: string) => (v: string) => setEditForm(p => ({ ...p, [k]: v }));

  return (
    <div className="p-6 space-y-4">
      <Toolbar title="Manage Jobs" count={jobs.length} search={search} setSearch={setSearch} />
      <Card className="p-5">
        <DataTable headers={['Job', 'Site', 'Openings', 'Pay', 'Shift', 'Status', 'Actions']}>
          {filtered.map((job: any) => (
            <tr key={job.id} className="border-b border-gray-50">
              <Td><b>{job.title}</b></Td>
              <Td>
                {job.company_sites?.site_name}
                <div className="text-xs text-gray-400">{job.company_sites?.city}</div>
              </Td>
              <Td>{job.guards_required}</Td>
              <Td>
                ₹{job.salary_amount}
                <div className="text-xs text-gray-400">{job.payment_type}</div>
              </Td>
              <Td>{job.shift_type}</Td>
              <Td>{statusBadge(job.status)}</Td>
              <Td>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEdit(job)}
                    className="table-action tone-blue"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(job.id)}
                    className="table-action"
                    style={{ color: '#7c2d12', borderColor: '#fca5a5' }}
                  >
                    Delete
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
        {filtered.length === 0 && <EmptyState text="No jobs found" />}
      </Card>

      {/* ── Delete confirmation overlay ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Delete this job?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone. All associated applications will also be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#7c2d12' }}
              >
                {deletingId === confirmDeleteId ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit job drawer ── */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setEditingJob(null)}>
          <div
            className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl overflow-y-auto shadow-2xl"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-6 pt-4 pb-6">
              <h3 className="font-bold text-gray-900 text-lg mb-4">Edit Job</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Job Title"       value={ef.title}               onChange={set('title')} />
                <Sel   label="Site"            value={ef.site_id}             options={sites.map(s => s.id)} labels={Object.fromEntries(sites.map(s => [s.id, s.site_name]))} onChange={set('site_id')} />
                <Input label="Associates Required" value={ef.guards_required} onChange={set('guards_required')} />
                <Input label="Salary"          value={ef.salary_amount}       onChange={set('salary_amount')} />
                <Sel   label="Payment Type"    value={ef.payment_type}        options={['Monthly','Daily']} labels={{Monthly:'Monthly',Daily:'Daily'}} onChange={set('payment_type')} />
                <Sel   label="Shift"           value={ef.shift_type}          options={['Day','Night','Rotating']} labels={{Day:'Day',Night:'Night',Rotating:'Rotating'}} onChange={set('shift_type')} />
                <Input label="Duty Hours"      value={ef.duty_hours}          onChange={set('duty_hours')} />
                <Input label="Start Date"      value={ef.start_date}          onChange={set('start_date')} />
                <Input label="End Date"        value={ef.end_date}            onChange={set('end_date')} />
                <Sel   label="Duration"        value={ef.duration_type}       options={['Monthly','Weekly','Daily','Contract']} labels={{Monthly:'Monthly',Weekly:'Weekly',Daily:'Daily',Contract:'Contract'}} onChange={set('duration_type')} />
                <Input label="Experience"      value={ef.experience_required} onChange={set('experience_required')} />
                <Input label="Skills (comma-separated)" value={ef.required_skills} onChange={set('required_skills')} />
              </div>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <textarea
                  value={ef.description}
                  onChange={e => set('description')(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 resize-none"
                />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setEditingJob(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: saving ? '#94a3b8' : '#0f1e3c' }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Applicants ────────────────────────────────────────────────────────────────

function ApplicantsPage({ employer: _employer, company, filter, onChanged }: { employer: EmployerInfo; company: any; filter: 'all' | 'shortlisted' | 'selected'; onChanged: () => void }) {
  const [apps, setApps] = useState<any[]>([]);

  useEffect(() => {
    listEmployerApplications(company.id).then(data => {
      const list = data ?? [];
      if (filter === 'shortlisted') return setApps(list.filter((a: any) => a.status === 'shortlisted'));
      if (filter === 'selected') return setApps(list.filter((a: any) => ['selected', 'offer_sent', 'accepted', 'joined'].includes(a.status)));
      setApps(list);
    }).catch(console.error);
  }, [company.id, filter]);

  const updateStatus = async (appId: string, status: string) => {
    await updateApplicationStatus(appId, status);
    listEmployerApplications(company.id).then(data => {
      const list = data ?? [];
      if (filter === 'shortlisted') return setApps(list.filter((a: any) => a.status === 'shortlisted'));
      if (filter === 'selected') return setApps(list.filter((a: any) => ['selected', 'offer_sent', 'accepted', 'joined'].includes(a.status)));
      setApps(list);
    }).catch(console.error);
    onChanged();
  };

  const refresh = () => {
    listEmployerApplications(company.id).then(data => {
      const list = data ?? [];
      if (filter === 'shortlisted') return setApps(list.filter((a: any) => a.status === 'shortlisted'));
      if (filter === 'selected') return setApps(list.filter((a: any) => ['selected', 'offer_sent', 'accepted', 'joined'].includes(a.status)));
      setApps(list);
    }).catch(console.error);
  };

  const markAadhaar = async (app: any, status: 'verified' | 'rejected') => {
    await declareAssociateAadhaar(app.guard_user_id, status);
    refresh();
    onChanged();
  };

  const sendOffer = async (app: any) => {
    await createJobOffer({
      application_id: app.id,
      job_id: app.job_id,
      guard_user_id: app.guard_user_id,
      company_id: company.id,
      site_id: app.site_id,
      offered_salary: app.job_posts?.salary_amount ?? 0,
      duty_hours: app.job_posts?.duty_hours ?? '8 hours',
      shift_type: app.job_posts?.shift_type ?? 'Day',
      start_date: app.job_posts?.start_date ?? null,
      terms_summary: `Offer for ${app.job_posts?.title} at ${company.company_name}`,
      status: 'sent',
    });
    await updateStatus(app.id, 'offer_sent');
  };

  const sendInterview = async (app: any) => {
    await createInterviewRequest({
      application_id: app.id,
      job_id: app.job_id,
      guard_user_id: app.guard_user_id,
      company_id: company.id,
      request_type: 'Phone Call',
      preferred_date: new Date().toISOString().split('T')[0],
      preferred_time: '11:00:00',
      message: 'Please connect for job discussion.',
      status: 'requested',
    });
    onChanged();
  };

  return (
    <div className="p-6">
      <Card className="p-5">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Applicants</h2>
        <DataTable headers={['Associate', 'Job', 'Experience', 'Verification', 'Status', 'Actions']}>
          {apps.map((app: any) => (
            <tr key={app.id} className="border-b border-gray-50">
              <Td><b>{app.guard_profiles?.full_name ?? 'Associate'}</b><div className="text-xs text-gray-400">{app.guard_profiles?.city} · {app.guard_profiles?.mobile}</div></Td>
              <Td>{app.job_posts?.title}</Td>
              <Td>{app.guard_profiles?.skills?.join(', ') ?? '--'}</Td>
              <Td>
                <div className="text-xs">Profile: {app.guard_profiles?.verification_status ?? '--'}</div>
                <div className="text-xs">Aadhaar: {app.guard_profiles?.aadhaar_status ?? '--'}</div>
              </Td>
              <Td>{statusBadge(app.status)}</Td>
              <Td>
                <button onClick={() => updateStatus(app.id, 'shortlisted')} className="table-action tone-blue">Shortlist</button>
                <button onClick={() => updateStatus(app.id, 'rejected')} className="table-action tone-red">Reject</button>
                <button onClick={() => updateStatus(app.id, 'selected')} className="table-action tone-green">Select</button>
                {app.guard_profiles?.aadhaar_status !== 'verified' && (
                  <button onClick={() => markAadhaar(app, 'verified')} className="table-action tone-green" title="Manually declare Aadhaar verified">Aadhaar ✓</button>
                )}
                <button onClick={() => sendInterview(app)} className="table-action">Call</button>
                <button onClick={() => sendOffer(app)} className="table-action">Offer</button>
              </Td>
            </tr>
          ))}
        </DataTable>
        {apps.length === 0 && <EmptyState text="No applicants in this view" />}
      </Card>
    </div>
  );
}

// ── Interviews ────────────────────────────────────────────────────────────────

function InterviewsPage({ employer: _employer, company, onChanged }: { employer: EmployerInfo; company: any; onChanged: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    listInterviewRequests(company.id).then(setRequests).catch(console.error);
  }, [company.id]);

  const update = async (id: string, status: string) => {
    await updateInterviewRequest(id, { status });
    listInterviewRequests(company.id).then(setRequests).catch(console.error);
    onChanged();
  };

  return (
    <div className="p-6">
      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-4">Call / Interview Requests</h2>
        <DataTable headers={['Associate', 'Job', 'Type', 'Preferred', 'Message', 'Status', 'Actions']}>
          {requests.map((r: any) => (
            <tr key={r.id} className="border-b border-gray-50">
              <Td>{r.guard_profiles?.full_name ?? 'Associate'}<div className="text-xs text-gray-400">{r.guard_profiles?.mobile}</div></Td>
              <Td>{r.job_posts?.title}</Td>
              <Td>{r.request_type}</Td>
              <Td>{r.preferred_date} {r.preferred_time}</Td>
              <Td>{r.message}</Td>
              <Td>{statusBadge(r.status)}</Td>
              <Td>
                {['accepted', 'completed', 'missed', 'cancelled'].map(s => (
                  <button key={s} onClick={() => update(r.id, s)} className="table-action capitalize">{s}</button>
                ))}
              </Td>
            </tr>
          ))}
        </DataTable>
        {requests.length === 0 && <EmptyState text="No interview requests" />}
      </Card>
    </div>
  );
}

// ── Agreements / Onboarding ───────────────────────────────────────────────────

function AgreementsPage({ employer: _employer, company, onChanged }: { employer: EmployerInfo; company: any; onChanged: () => void }) {
  const [offers, setOffers] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([listJobOffers(company.id).catch(() => []), listAgreements(company.id).catch(() => [])]).then(([o, a]) => {
      setOffers(o ?? []);
      setAgreements(a ?? []);
    });
  }, [company.id]);

  const acceptOffer = async (offer: any) => {
    await updateJobOffer(offer.id, { status: 'accepted' });
    await createAgreement({
      offer_id: offer.id,
      job_id: offer.job_id,
      guard_user_id: offer.guard_user_id,
      company_id: company.id,
      site_id: offer.site_id,
      terms: {
        salary: offer.offered_salary,
        duty_hours: offer.duty_hours,
        start_date: offer.start_date,
        summary: offer.terms_summary,
      },
      employer_confirmation_status: 'pending',
      guard_confirmation_status: 'pending',
      platform_confirmation_status: 'pending',
      status: 'pending',
    });
    Promise.all([listJobOffers(company.id).catch(() => []), listAgreements(company.id).catch(() => [])]).then(([o, a]) => {
      setOffers(o ?? []);
      setAgreements(a ?? []);
    });
    onChanged();
  };

  return (
    <div className="p-6 space-y-5">
      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-4">Job Offers</h2>
        <DataTable headers={['Associate', 'Job', 'Salary', 'Shift', 'Status', 'Actions']}>
          {offers.map((offer: any) => (
            <tr key={offer.id} className="border-b border-gray-50">
              <Td>{offer.guard_profiles?.full_name ?? 'Associate'}</Td>
              <Td>{offer.job_posts?.title}</Td>
              <Td>Rs {offer.offered_salary}</Td>
              <Td>{offer.shift_type}</Td>
              <Td>{statusBadge(offer.status)}</Td>
              <Td>
                {offer.status === 'sent' && <button onClick={() => acceptOffer(offer)} className="table-action tone-green">Mark Accepted</button>}
                <button onClick={async () => { await updateJobOffer(offer.id, { status: 'cancelled' }); listJobOffers(company.id).then(setOffers).catch(console.error); onChanged(); }} className="table-action tone-red">Cancel</button>
              </Td>
            </tr>
          ))}
        </DataTable>
        {offers.length === 0 && <EmptyState text="No job offers yet" />}
      </Card>
      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-4">Agreements / Onboarding</h2>
        <DataTable headers={['Associate', 'Job', 'Terms', 'Status', 'Actions']}>
          {agreements.map((ag: any) => (
            <tr key={ag.id} className="border-b border-gray-50">
              <Td>{ag.guard_profiles?.full_name ?? 'Associate'}</Td>
              <Td>{ag.job_posts?.title}</Td>
              <Td>{(ag.terms as any)?.summary ?? '--'}</Td>
              <Td>{statusBadge(ag.status)}</Td>
              <Td>
                <button onClick={async () => { await updateAgreement(ag.id, { employer_confirmation_status: 'confirmed', status: 'confirmed' }); listAgreements(company.id).then(setAgreements).catch(console.error); onChanged(); }} className="table-action tone-green">Confirm</button>
              </Td>
            </tr>
          ))}
        </DataTable>
        {agreements.length === 0 && <EmptyState text="No agreements generated" />}
      </Card>
    </div>
  );
}

// ── Attendance ────────────────────────────────────────────────────────────────

function AttendancePage({ company, onChanged }: { company: any; onChanged: () => void }) {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    listEmployerAttendance(company.id).then(setRecords).catch(console.error);
  }, [company.id]);

  const update = async (id: string, status: string, remarks: string) => {
    await updateAttendanceStatus(id, status, remarks);
    listEmployerAttendance(company.id).then(setRecords).catch(console.error);
    onChanged();
  };

  return (
    <div className="p-6">
      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-4">Attendance Verification</h2>
        <DataTable headers={['Associate', 'Job', 'Date', 'In / Out', 'Hours', 'Status', 'Actions']}>
          {records.map((r: any) => (
            <tr key={r.id} className="border-b border-gray-50">
              <Td>{r.guard_profiles?.full_name ?? 'Associate'}</Td>
              <Td>{r.job_posts?.title}</Td>
              <Td>{r.attendance_date}</Td>
              <Td>{r.in_time ? new Date(r.in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'} / {r.out_time ? new Date(r.out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}</Td>
              <Td>{r.total_hours ?? '--'}</Td>
              <Td>{statusBadge(r.status)}</Td>
              <Td>
                <button onClick={() => update(r.id, 'approved', 'Approved by employer')} className="table-action tone-green">Approve</button>
                <button onClick={() => update(r.id, 'rejected', 'Rejected by employer')} className="table-action tone-red">Reject</button>
              </Td>
            </tr>
          ))}
        </DataTable>
        {records.length === 0 && <EmptyState text="No attendance to verify" />}
      </Card>
    </div>
  );
}

// ── Payments — demo mode ──────────────────────────────────────────────────────

function PaymentsPage({ employer: _employer, company }: { employer: EmployerInfo; company: any }) {
  const [apps, setApps] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paid, setPaid] = useState<Set<string>>(new Set());
  const [successMsg, setSuccessMsg] = useState('');
  const [otpFlow, setOtpFlow] = useState<{ appId: string; paymentId: string; guardName: string; sentTo: string; devOtp?: string } | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpErr, setOtpErr] = useState('');

  const refreshPayments = () => listEmployerPayments(company.id).then(setPayments).catch(console.error);

  useEffect(() => {
    listEmployerApplications(company.id)
      .then(data => setApps((data ?? []).filter((a: any) => ['selected', 'offer_sent', 'accepted', 'joined'].includes(a.status))))
      .catch(console.error);
    refreshPayments();
  }, [company.id]);

  const handlePay = async (app: any, guardName: string) => {
    setOtpErr('');
    try {
      const payment = await createPaymentRecord({
        guard_user_id: app.guard_user_id,
        job_id: app.job_id,
        application_id: app.id,
        amount: app.job_posts?.salary_amount ?? 0,
        payment_method: 'cash',
        payment_status: 'pending',
      });
      const res = await requestCashPaymentOtp(payment.id);
      setOtpInput('');
      setOtpFlow({ appId: app.id, paymentId: payment.id, guardName, sentTo: res.sent_to, devOtp: res.dev_otp });
    } catch (e: any) {
      setSuccessMsg('');
      setOtpErr(e?.response?.data?.message || e.message);
    }
  };

  const confirmOtp = async () => {
    if (!otpFlow || otpInput.length < 4) return;
    setOtpBusy(true); setOtpErr('');
    try {
      await confirmCashPaymentOtp(otpFlow.paymentId, otpInput);
      setPaid(prev => new Set([...prev, otpFlow.appId]));
      setSuccessMsg(`Cash payment confirmed for ${otpFlow.guardName}.`);
      setOtpFlow(null);
      refreshPayments();
    } catch (e: any) {
      setOtpErr(e?.response?.data?.message || e.message);
    } finally {
      setOtpBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {successMsg && <SuccessBanner message={successMsg} onClose={() => setSuccessMsg('')} />}
      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-4">Process Payments</h2>
        <DataTable headers={['Associate', 'Job', 'Amount', 'Action']}>
          {apps.map((app: any) => {
            const alreadyPaid = paid.has(app.id);
            return (
              <tr key={app.id} className="border-b border-gray-50">
                <Td>{app.guard_profiles?.full_name ?? 'Associate'}</Td>
                <Td>{app.job_posts?.title}</Td>
                <Td>Rs {app.job_posts?.salary_amount ?? '--'}</Td>
                <Td>
                  {alreadyPaid
                    ? <span className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">Payment Done</span>
                    : <button onClick={() => handlePay(app, app.guard_profiles?.full_name ?? 'Associate')} className="table-action tone-green">Pay Cash (OTP)</button>}
                </Td>
              </tr>
            );
          })}
        </DataTable>
        {apps.length === 0 && <EmptyState text="No selected associates awaiting payment" />}
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-4">Payment History</h2>
        <DataTable headers={['Associate', 'Job', 'Amount', 'Method', 'Status']}>
          {payments.map((p: any) => (
            <tr key={p.id} className="border-b border-gray-50">
              <Td>{p.guard_profiles?.full_name ?? '--'}</Td>
              <Td>{p.job_posts?.title ?? '--'}</Td>
              <Td>Rs {p.amount}</Td>
              <Td>{p.payment_method ?? '--'}</Td>
              <Td>{statusBadge(p.payment_status)}</Td>
            </tr>
          ))}
        </DataTable>
        {payments.length === 0 && <EmptyState text="No payment history" />}
      </Card>

      {otpErr && !otpFlow && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{otpErr}</div>}

      {otpFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,30,60,0.55)' }} onClick={() => setOtpFlow(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Confirm cash payment</h3>
            <p className="text-xs text-gray-500 mt-1">A confirmation code was emailed to <b>{otpFlow.guardName}</b> ({otpFlow.sentTo}). Enter it to mark the payment received.</p>
            {otpFlow.devOtp && (
              <p className="text-[11px] text-center text-amber-700 bg-amber-50 border border-amber-100 rounded-lg py-2 mt-3">Dev mode — code: <b className="tracking-widest">{otpFlow.devOtp}</b></p>
            )}
            <input autoFocus inputMode="numeric" value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full mt-3 px-3 py-3 rounded-lg text-center text-lg font-bold tracking-[0.4em] outline-none" style={{ background: '#f7f8fa', border: '1.5px solid #e2e8f0', color: '#0f1e3c' }} placeholder="••••••" />
            {otpErr && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 mt-2">{otpErr}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setOtpFlow(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700">Cancel</button>
              <button onClick={confirmOtp} disabled={otpBusy || otpInput.length < 4} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #166534, #15803d)' }}>{otpBusy ? 'Confirming…' : 'Confirm payment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Wallet — demo mode ────────────────────────────────────────────────────────

function WalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [amount, setAmount] = useState('1000');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    getEmployerWallet().then(setWallet).catch(() => setWallet({ balance: 0 }));
    listWalletTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  const addBalance = () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setSuccessMsg(`Rs ${value} balance top-up recorded. Update will reflect after admin confirmation.`);
  };

  return (
    <div className="p-6 space-y-5">
      {successMsg && <SuccessBanner message={successMsg} onClose={() => setSuccessMsg('')} />}
      <Card className="p-6">
        <p className="text-xs text-gray-400 font-semibold uppercase">Wallet Balance</p>
        <div className="text-4xl font-bold mt-2" style={{ color: '#0f1e3c' }}>Rs {wallet?.balance ?? 0}</div>
        <div className="flex gap-3 mt-5 max-w-md">
          <input value={amount} onChange={e => setAmount(e.target.value)} className="form-input" placeholder="Amount" />
          <button onClick={addBalance} className="px-4 rounded-xl text-sm font-semibold text-white whitespace-nowrap" style={{ background: '#0f1e3c' }}>Add Balance</button>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-bold text-gray-900 mb-4">Wallet Transactions</h3>
        <DataTable headers={['Type', 'Amount', 'Purpose', 'Status', 'Date']}>
          {transactions.map((tx: any) => (
            <tr key={tx.id} className="border-b border-gray-50">
              <Td>{tx.transaction_type}</Td>
              <Td>Rs {tx.amount}</Td>
              <Td>{tx.purpose}</Td>
              <Td>{statusBadge(tx.status)}</Td>
              <Td>{new Date(tx.created_at).toLocaleString('en-IN')}</Td>
            </tr>
          ))}
        </DataTable>
        {transactions.length === 0 && <EmptyState text="No wallet transactions" />}
      </Card>
    </div>
  );
}

// ── Invoices ──────────────────────────────────────────────────────────────────

function InvoicesPage({ company }: { company: any }) {
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    listEmployerInvoices(company.id).then(setInvoices).catch(console.error);
  }, [company.id]);

  return (
    <div className="p-6">
      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-4">Invoices / Receipts</h2>
        <DataTable headers={['Invoice No.', 'Amount', 'Tax', 'Total', 'Status', 'Date']}>
          {invoices.map((inv: any) => (
            <tr key={inv.id} className="border-b border-gray-50">
              <Td>{inv.invoice_number ?? inv.id.slice(0, 8)}</Td>
              <Td>Rs {inv.amount}</Td>
              <Td>Rs {inv.tax_amount}</Td>
              <Td>Rs {inv.total_amount}</Td>
              <Td>{statusBadge(inv.payment_status)}</Td>
              <Td>{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</Td>
            </tr>
          ))}
        </DataTable>
        {invoices.length === 0 && <EmptyState text="No invoices yet" />}
      </Card>
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────

function ReportsPage({ employer: _employer, company, companies }: { employer: EmployerInfo; company: any; companies: any[] }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      listEmployerJobs(company.id).catch(() => []),
      listEmployerApplications(company.id).catch(() => []),
      listEmployerPayments(company.id).catch(() => []),
      listCompanySites(company.id).catch(() => []),
    ]).then(([j, a, p, s]) => {
      setJobs(j ?? []);
      setApps(a ?? []);
      setPayments(p ?? []);
      setSites(s ?? []);
    });
  }, [company.id]);

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Total Companies" value={companies.length} icon={<Building2 size={20} />} color="#0f1e3c" />
        <MetricCard label="Site Deployments" value={sites.length} icon={<MapPin size={20} />} color="#0f766e" />
        <MetricCard label="Payment Total" value={`Rs ${payments.reduce((s, p) => s + (p.amount ?? 0), 0)}`} icon={<CreditCard size={20} />} color="#065f46" />
      </div>
      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-4">Hiring Report</h2>
        <DataTable headers={['Job', 'Site', 'Applicants', 'Selected', 'Status']}>
          {jobs.map((job: any) => {
            const jobApps = apps.filter(a => a.job_id === job.id);
            const selected = jobApps.filter(a => ['selected', 'offer_sent', 'accepted', 'joined'].includes(a.status)).length;
            return (
              <tr key={job.id} className="border-b border-gray-50">
                <Td>{job.title}</Td>
                <Td>{job.company_sites?.site_name}</Td>
                <Td>{jobApps.length}</Td>
                <Td>{selected}</Td>
                <Td>{statusBadge(job.status)}</Td>
              </tr>
            );
          })}
        </DataTable>
        {jobs.length === 0 && <EmptyState text="No jobs for report" />}
      </Card>
    </div>
  );
}
