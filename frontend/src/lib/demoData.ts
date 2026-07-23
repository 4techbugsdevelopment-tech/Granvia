// Demo data for screens whose backend endpoints are not yet implemented.
// Everything here is clearly fake and self-contained. When a real API lands,
// swap the consuming screen from these helpers to its service — the shapes are
// intentionally close to what the eventual API responses will look like.
//
// NOTE: This file is NOT the legacy `storage.ts` mock. These are read-only
// fixtures for preview/demo purposes only.

// ── Wallet / coins (guard + employer) ─────────────────────────────────────────

export interface DemoWalletTxn {
  id: string;
  date: string;
  type: 'credit' | 'debit';
  purpose: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
}

export const demoGuardWallet = {
  balanceCoins: 1840,
  coinValueInr: 1, // 1 coin = ₹1 (placeholder — confirm with client)
  pendingWithdrawal: 0,
  bankLinked: true,
};

export const demoGuardTransactions: DemoWalletTxn[] = [
  { id: 'TX-9001', date: '2026-07-08', type: 'credit', purpose: 'Shift payout — Reliance Mall', amount: 960, status: 'completed' },
  { id: 'TX-9002', date: '2026-07-06', type: 'credit', purpose: 'Shift payout — Tech Park', amount: 880, status: 'completed' },
  { id: 'TX-9003', date: '2026-07-05', type: 'debit', purpose: 'Withdrawal to bank ••4521', amount: 1500, status: 'completed' },
  { id: 'TX-9004', date: '2026-07-03', type: 'credit', purpose: 'Overtime bonus', amount: 240, status: 'completed' },
  { id: 'TX-9005', date: '2026-07-01', type: 'credit', purpose: 'Shift payout — Airport Gate 3', amount: 1120, status: 'completed' },
];

// ── Availability posting (guard) ──────────────────────────────────────────────

export interface DemoAvailability {
  id: string;
  duration: '4hr' | '6hr' | '8hr' | '12hr';
  frequency: 'Regular' | 'Weekly' | 'Daily';
  days: string[];
  active: boolean;
}

export const demoAvailability: DemoAvailability[] = [
  { id: 'AV-1', duration: '8hr', frequency: 'Regular', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], active: true },
  { id: 'AV-2', duration: '12hr', frequency: 'Weekly', days: ['Sat', 'Sun'], active: true },
];

// ── Notifications (guard/shared) ──────────────────────────────────────────────

export interface DemoNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  kind: 'job' | 'payment' | 'verification' | 'system';
}

export const demoNotifications: DemoNotification[] = [
  { id: 'N-1', title: 'New job near you', body: 'Security associate needed at Phoenix Mall, 3.2 km away.', time: '10 min ago', read: false, kind: 'job' },
  { id: 'N-2', title: 'Payment received', body: '₹960 credited for your shift at Reliance Mall.', time: '2 hr ago', read: false, kind: 'payment' },
  { id: 'N-3', title: 'Document verified', body: 'Your ID proof has been approved by admin.', time: '1 day ago', read: true, kind: 'verification' },
  { id: 'N-4', title: 'Shift reminder', body: 'Your shift at Tech Park starts at 8:00 AM tomorrow.', time: '1 day ago', read: true, kind: 'system' },
];

// ── Support tickets (shared) ──────────────────────────────────────────────────

export interface DemoTicket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved';
  lastMessage: string;
  updated: string;
}

export const demoTickets: DemoTicket[] = [
  { id: 'TKT-201', subject: 'Payment not received for last shift', status: 'in_progress', lastMessage: 'We are checking with the employer, please allow 24 hours.', updated: '3 hr ago' },
  { id: 'TKT-198', subject: 'Unable to upload police verification', status: 'resolved', lastMessage: 'Fixed — please try uploading again.', updated: '2 days ago' },
];

export const demoSupportFaqs = [
  { q: 'How do I withdraw my coins?', a: 'Go to Wallet → Withdraw. Funds reach your linked bank in 1–2 business days.' },
  { q: 'When is attendance verified?', a: 'Employers verify your in/out times at end of day. Verified shifts are paid out to your wallet.' },
  { q: 'How does radius job search work?', a: 'Set your residential location and radius in Profile. Jobs within range appear in Find Jobs.' },
];

// ── Available guards (employer — SRS 3.2.3) ───────────────────────────────────

export interface DemoAvailableGuard {
  id: string;
  name: string;
  city: string;
  distanceKm: number;
  experience: string;
  skills: string[];
  languages: string[];
  rating: number;
  verified: boolean;
  availability: string;
}

export const demoAvailableGuards: DemoAvailableGuard[] = [
  { id: 'AG-1', name: 'Rajesh Kumar', city: 'Mumbai', distanceKm: 2.4, experience: '5 years', skills: ['CCTV Monitoring', 'Patrolling'], languages: ['Hindi', 'English', 'Marathi'], rating: 4.8, verified: true, availability: '8hr · Regular' },
  { id: 'AG-2', name: 'Suresh Patil', city: 'Mumbai', distanceKm: 4.1, experience: '3 years', skills: ['Access Control', 'Fire Safety'], languages: ['Hindi', 'Marathi'], rating: 4.5, verified: true, availability: '12hr · Weekly' },
  { id: 'AG-3', name: 'Vikram Rao', city: 'Pune', distanceKm: 6.8, experience: '7 years', skills: ['VIP Security', 'Crowd Management'], languages: ['Hindi', 'English'], rating: 4.9, verified: true, availability: '8hr · Daily' },
  { id: 'AG-4', name: 'Amit Sharma', city: 'Mumbai', distanceKm: 9.2, experience: '2 years', skills: ['Patrolling', 'First Aid'], languages: ['Hindi'], rating: 4.1, verified: false, availability: '6hr · Regular' },
];

// ── Cash payments with OTP (employer — SRS 3.2.5) ─────────────────────────────

export interface DemoCashPayment {
  id: string;
  guard: string;
  site: string;
  amount: number;
  date: string;
  status: 'confirmed' | 'awaiting_otp';
}

export const demoCashPayments: DemoCashPayment[] = [
  { id: 'CP-1', guard: 'Rajesh Kumar', site: 'Reliance Mall', amount: 960, date: '2026-07-08', status: 'confirmed' },
  { id: 'CP-2', guard: 'Suresh Patil', site: 'Tech Park', amount: 880, date: '2026-07-07', status: 'confirmed' },
];

// ── Feedback (employer) ───────────────────────────────────────────────────────

export interface DemoFeedback {
  id: string;
  target: string;
  rating: number;
  comment: string;
  date: string;
}

export const demoFeedback: DemoFeedback[] = [
  { id: 'FB-1', target: 'Rajesh Kumar (Associate)', rating: 5, comment: 'Punctual and professional throughout the assignment.', date: '2026-07-07' },
  { id: 'FB-2', target: 'Platform / Service', rating: 4, comment: 'Hiring flow is smooth, would like faster payouts.', date: '2026-07-04' },
];

// ── Admin: hiring workflow overview ───────────────────────────────────────────

export const demoHiringPipeline = [
  { stage: 'Applied', count: 128, color: '#854d0e' },
  { stage: 'Shortlisted', count: 54, color: '#1d4ed8' },
  { stage: 'Interview', count: 31, color: '#5b21b6' },
  { stage: 'Selected', count: 22, color: '#166534' },
  { stage: 'Joined', count: 18, color: '#0f766e' },
];

export const demoRecentHires = [
  { guard: 'Suresh Patil', employer: 'Demo Security Services', site: 'Reliance Mall', date: '2026-07-08', status: 'Joined' },
  { guard: 'Amit Sharma', employer: 'Metro Facilities', site: 'Tech Park', date: '2026-07-07', status: 'Agreement Sent' },
  { guard: 'Vikram Rao', employer: 'Demo Security Services', site: 'Airport Gate 3', date: '2026-07-06', status: 'Selected' },
];

// ── Admin: wallet & payments overview ─────────────────────────────────────────

export const demoPlatformPayments = {
  totalCollectedInr: 428500,
  paidToGuardsInr: 361200,
  commissionInr: 67300,
  pendingSettlementInr: 24800,
};

export const demoPlatformTransactions: DemoWalletTxn[] = [
  { id: 'PT-5501', date: '2026-07-08', type: 'credit', purpose: 'Wallet top-up — Demo Security Services', amount: 50000, status: 'completed' },
  { id: 'PT-5502', date: '2026-07-08', type: 'debit', purpose: 'Associate payout batch #418', amount: 38400, status: 'completed' },
  { id: 'PT-5503', date: '2026-07-07', type: 'debit', purpose: 'Associate payout batch #417', amount: 29600, status: 'completed' },
  { id: 'PT-5504', date: '2026-07-07', type: 'credit', purpose: 'Wallet top-up — Metro Facilities', amount: 75000, status: 'pending' },
];

// ── Admin: reports ────────────────────────────────────────────────────────────

export const demoAreaAvailability = [
  { area: 'Mumbai', available: 42, deployed: 88, languages: { English: 31, Hindi: 74, Marathi: 55 } },
  { area: 'Pune', available: 28, deployed: 51, languages: { English: 19, Hindi: 44, Marathi: 40 } },
  { area: 'Delhi', available: 35, deployed: 62, languages: { English: 27, Hindi: 61 } },
  { area: 'Bangalore', available: 21, deployed: 39, languages: { English: 24, Hindi: 30, Kannada: 33 } },
  { area: 'Hyderabad', available: 18, deployed: 33, languages: { English: 15, Hindi: 28, Telugu: 30 } },
];

export const demoCommissionByMonth = [
  { month: 'Feb', commission: 41200 },
  { month: 'Mar', commission: 48800 },
  { month: 'Apr', commission: 52100 },
  { month: 'May', commission: 59400 },
  { month: 'Jun', commission: 63900 },
  { month: 'Jul', commission: 67300 },
];

// ── Sales Executive panel ─────────────────────────────────────────────────────

export interface DemoClient {
  id: string;
  company: string;
  contact: string;
  email: string;
  mobile: string;
  city: string;
  activeJobs: number;
  billingInr: number;
  status: 'Active' | 'Prospect' | 'On Hold';
}

export const demoSalesClients: DemoClient[] = [
  { id: 'CL-1', company: 'Demo Security Services', contact: 'Rohit Mehta', email: 'rohit@demosec.com', mobile: '9812345670', city: 'Mumbai', activeJobs: 6, billingInr: 184000, status: 'Active' },
  { id: 'CL-2', company: 'Metro Facilities', contact: 'Anita Desai', email: 'anita@metrofac.com', mobile: '9812345671', city: 'Pune', activeJobs: 3, billingInr: 96000, status: 'Active' },
  { id: 'CL-3', company: 'Skyline Estates', contact: 'Karan Singh', email: 'karan@skyline.com', mobile: '9812345672', city: 'Delhi', activeJobs: 0, billingInr: 0, status: 'Prospect' },
  { id: 'CL-4', company: 'Harbor Logistics', contact: 'Priya Nair', email: 'priya@harbor.com', mobile: '9812345673', city: 'Mumbai', activeJobs: 2, billingInr: 58000, status: 'On Hold' },
];

export interface DemoDiscount {
  id: string;
  client: string;
  type: 'Percentage' | 'Flat';
  value: number;
  appliesTo: string;
  status: 'Active' | 'Expired';
}

export const demoDiscounts: DemoDiscount[] = [
  { id: 'DSC-1', client: 'Demo Security Services', type: 'Percentage', value: 10, appliesTo: 'Monthly billing', status: 'Active' },
  { id: 'DSC-2', client: 'Metro Facilities', type: 'Flat', value: 5000, appliesTo: 'Onboarding fee', status: 'Active' },
  { id: 'DSC-3', client: 'Harbor Logistics', type: 'Percentage', value: 5, appliesTo: 'Q2 contract', status: 'Expired' },
];

// ── Sub Admin panel ───────────────────────────────────────────────────────────
// Everything here is scoped to a single branch (branchId) so the Sub Admin only
// ever sees "their own" entities. When a real API lands, filter by branch_id.

export const SUB_ADMIN_BRANCH_ID = 'BR-WEST-01';

/** Access permissions a Sub Admin can grant to internal staff. */
export const STAFF_PERMISSIONS = [
  'Manage Staff',
  'Verify Documents',
  'Manage Clients',
  'Manage Associates',
  'View Reports',
  'Post Jobs',
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export interface DemoStaff {
  id: string;
  branchId: string;
  name: string;
  role: string;
  email: string;
  mobile: string;
  status: 'Active' | 'Inactive';
  permissions: StaffPermission[];
}

export const demoStaff: DemoStaff[] = [
  { id: 'ST-1', branchId: SUB_ADMIN_BRANCH_ID, name: 'Neha Kulkarni', role: 'Operations Manager', email: 'neha@region.com', mobile: '9801234500', status: 'Active', permissions: ['Manage Staff', 'Manage Clients', 'View Reports', 'Post Jobs'] },
  { id: 'ST-2', branchId: SUB_ADMIN_BRANCH_ID, name: 'Arjun Reddy', role: 'Field Supervisor', email: 'arjun@region.com', mobile: '9801234501', status: 'Active', permissions: ['Manage Associates', 'Verify Documents'] },
  { id: 'ST-3', branchId: SUB_ADMIN_BRANCH_ID, name: 'Sana Sheikh', role: 'HR Coordinator', email: 'sana@region.com', mobile: '9801234502', status: 'Inactive', permissions: ['Verify Documents'] },
];

export const demoSubAdminCompany = {
  branchId: SUB_ADMIN_BRANCH_ID,
  name: 'Granvia Regional Office — West',
  registration: 'U74999MH2019PTC000000',
  gstNumber: '27AABCG1234K1Z5',
  address: '4th Floor, Nariman Point, Mumbai 400021',
  contact: 'west@granvia.com',
  phone: '+91 22 4000 1200',
  manager: 'Neha Kulkarni',
  guards: 46,
  clients: 12,
  sites: [
    { id: 'SITE-1', name: 'Nariman Point HQ', address: 'Nariman Point, Mumbai', partners: 18 },
    { id: 'SITE-2', name: 'Andheri Ops Hub', address: 'Andheri East, Mumbai', partners: 16 },
    { id: 'SITE-3', name: 'Pune Satellite', address: 'Koregaon Park, Pune', partners: 12 },
  ],
};

export const demoSubAdminGuards = [
  { id: 'G-1', name: 'Rajesh Kumar', city: 'Mumbai', status: 'Active', deployed: 'Reliance Mall' },
  { id: 'G-2', name: 'Suresh Patil', city: 'Mumbai', status: 'Active', deployed: 'Tech Park' },
  { id: 'G-3', name: 'Vikram Rao', city: 'Pune', status: 'On Leave', deployed: '—' },
];

export const demoSubAdminClients = [
  { id: 'C-1', company: 'Demo Security Services', sites: 4, guards: 22, status: 'Active', contact: 'ops@demosecurity.com' },
  { id: 'C-2', company: 'Metro Facilities', sites: 2, guards: 11, status: 'Active', contact: 'admin@metrofac.in' },
  { id: 'C-3', company: 'Harbor Logistics', sites: 3, guards: 13, status: 'Onboarding', contact: 'hr@harborlog.com' },
];

// ── Manual Verification Desk (Sub Admin approves/rejects partner documents) ─────

export type DocStatus = 'pending' | 'approved' | 'rejected';
export type DocType = 'Aadhaar' | 'Police Verification' | 'Bank Details';

export interface DemoVerificationDoc {
  type: DocType;
  fileName: string;
  uploadedAt: string;
  status: DocStatus;
  rejectionReason?: string;
}

export interface DemoVerificationCandidate {
  id: string;
  branchId: string;
  name: string;
  mobile: string;
  city: string;
  appliedFor: string;
  englishProficiency: 'Basic' | 'Intermediate' | 'Fluent';
  qualification: string;
  experience: string;
  documents: DemoVerificationDoc[];
}

export const demoVerificationQueue: DemoVerificationCandidate[] = [
  {
    id: 'VP-1', branchId: SUB_ADMIN_BRANCH_ID, name: 'Rajesh Kumar', mobile: '9876543210', city: 'Mumbai',
    appliedFor: 'CCTV Operator — Reliance Mall', englishProficiency: 'Fluent', qualification: 'Graduate', experience: '5 years',
    documents: [
      { type: 'Aadhaar', fileName: 'aadhaar_rajesh.pdf', uploadedAt: '2026-07-08', status: 'pending' },
      { type: 'Police Verification', fileName: 'police_rajesh.pdf', uploadedAt: '2026-07-08', status: 'pending' },
      { type: 'Bank Details', fileName: 'bank_rajesh.pdf', uploadedAt: '2026-07-08', status: 'pending' },
    ],
  },
  {
    id: 'VP-2', branchId: SUB_ADMIN_BRANCH_ID, name: 'Suresh Patil', mobile: '9765432109', city: 'Mumbai',
    appliedFor: 'Access Control — Tech Park', englishProficiency: 'Intermediate', qualification: '12th Pass', experience: '3 years',
    documents: [
      { type: 'Aadhaar', fileName: 'aadhaar_suresh.pdf', uploadedAt: '2026-07-07', status: 'approved' },
      { type: 'Police Verification', fileName: 'police_suresh.pdf', uploadedAt: '2026-07-07', status: 'pending' },
      { type: 'Bank Details', fileName: 'bank_suresh.pdf', uploadedAt: '2026-07-07', status: 'pending' },
    ],
  },
  {
    id: 'VP-3', branchId: SUB_ADMIN_BRANCH_ID, name: 'Amit Sharma', mobile: '9654321098', city: 'Pune',
    appliedFor: 'Patrolling — Phoenix Mall', englishProficiency: 'Basic', qualification: '10th Pass', experience: '2 years',
    documents: [
      { type: 'Aadhaar', fileName: 'aadhaar_amit.pdf', uploadedAt: '2026-07-09', status: 'pending' },
      { type: 'Police Verification', fileName: 'police_amit.pdf', uploadedAt: '2026-07-09', status: 'rejected', rejectionReason: 'Document expired — please re-upload a current certificate.' },
      { type: 'Bank Details', fileName: 'bank_amit.pdf', uploadedAt: '2026-07-09', status: 'pending' },
    ],
  },
  {
    id: 'VP-4', branchId: SUB_ADMIN_BRANCH_ID, name: 'Neha Singh', mobile: '9543210987', city: 'Mumbai',
    appliedFor: 'Front Desk — Metro Depot', englishProficiency: 'Fluent', qualification: 'Graduate', experience: '4 years',
    documents: [
      { type: 'Aadhaar', fileName: 'aadhaar_neha.pdf', uploadedAt: '2026-07-10', status: 'approved' },
      { type: 'Police Verification', fileName: 'police_neha.pdf', uploadedAt: '2026-07-10', status: 'approved' },
      { type: 'Bank Details', fileName: 'bank_neha.pdf', uploadedAt: '2026-07-10', status: 'approved' },
    ],
  },
];

// ── Branch-level reports (skills + commission) ─────────────────────────────────

/** Area-wise manpower availability for this branch (Recharts feed). */
export const demoBranchAvailability = [
  { area: 'Nariman Point', available: 14, deployed: 22 },
  { area: 'Andheri', available: 9, deployed: 18 },
  { area: 'Koregaon Park', available: 6, deployed: 12 },
  { area: 'Bandra', available: 8, deployed: 10 },
  { area: 'Thane', available: 5, deployed: 9 },
];

export interface DemoManpowerSkill {
  id: string;
  name: string;
  english: 'Basic' | 'Intermediate' | 'Fluent';
  qualification: string;
  specialization: string;
  experience: string;
}

export const demoManpowerSkills: DemoManpowerSkill[] = [
  { id: 'MP-1', name: 'Rajesh Kumar', english: 'Fluent', qualification: 'Graduate', specialization: 'CCTV Monitoring', experience: '5 years' },
  { id: 'MP-2', name: 'Suresh Patil', english: 'Intermediate', qualification: '12th Pass', specialization: 'Access Control', experience: '3 years' },
  { id: 'MP-3', name: 'Vikram Rao', english: 'Fluent', qualification: 'Graduate', specialization: 'VIP Security', experience: '7 years' },
  { id: 'MP-4', name: 'Amit Sharma', english: 'Basic', qualification: '10th Pass', specialization: 'Patrolling', experience: '2 years' },
  { id: 'MP-5', name: 'Neha Singh', english: 'Fluent', qualification: 'Graduate', specialization: 'Front Desk', experience: '4 years' },
  { id: 'MP-6', name: 'Iqbal Khan', english: 'Intermediate', qualification: '12th Pass', specialization: 'Fire Safety', experience: '6 years' },
];

/** Branch-specific commission earned from job settlements (Recharts feed). */
export const demoBranchCommissionByMonth = [
  { month: 'Feb', settlements: 18, commission: 21200 },
  { month: 'Mar', settlements: 22, commission: 24800 },
  { month: 'Apr', settlements: 25, commission: 27100 },
  { month: 'May', settlements: 29, commission: 30400 },
  { month: 'Jun', settlements: 31, commission: 32900 },
  { month: 'Jul', settlements: 34, commission: 35300 },
];

export const demoBranchCommissionSummary = {
  totalEarnedInr: 171700,
  thisMonthInr: 35300,
  pendingSettlementInr: 12400,
  settlementsCount: 34,
};
