import { apiClient } from '../lib/apiClient';

export interface SubAdminCounts {
  active_jobs: number;
  total_jobs: number;
  service_partners: number;
  clients: number;
  staff: number;
  revenue: number;
  commission: number;
}

export interface SubAdminProfile {
  id: string;
  branch_name: string;
  registration_no: string | null;
  gst_number: string | null;
  address: string | null;
  contact_email: string | null;
  phone: string | null;
}

export interface BranchSite {
  id: string;
  site_name: string | null;
  address: unknown;
  city: string | null;
  state: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
  mobile: string | null;
  status: 'Active' | 'Inactive';
  permissions: string[] | null;
}

export interface VerificationDoc {
  id: string;
  document_type: string;
  file_name: string;
  status: 'pending' | 'verified' | 'rejected';
  admin_remarks: string | null;
  uploaded_at: string;
  download_url: string;
}

export interface VerificationCandidate {
  id: string;
  name: string;
  mobile: string | null;
  city: string | null;
  qualification: string | null;
  experience: string | null;
  languages: string[];
  verification_status: string;
  documents: VerificationDoc[];
}

export interface BranchClient { id: string; company: string; contact: string; sites: number; jobs: number; status: string }
export interface BranchGuard { id: string; name: string; city: string | null; status: string; account_status: string; experience: string | null }
export interface SkillRow { id: string; name: string; languages: string[]; english: string; qualification: string | null; specialization: string | null; experience: string | null }
export interface CommissionReport {
  commission_rate: number;
  total_earned: number;
  settlements_count: number;
  by_month: Array<{ month: string; settlements: number; commission: number }>;
}

export const getSubAdminCounts = async (): Promise<SubAdminCounts> => (await apiClient.get('/subadmin/reports/counts')).data;
export const getSubAdminCompany = async (): Promise<{ profile: SubAdminProfile; sites: BranchSite[] }> => (await apiClient.get('/subadmin/company')).data;
export const updateSubAdminCompany = async (input: Partial<SubAdminProfile>): Promise<SubAdminProfile> => (await apiClient.patch('/subadmin/company', input)).data;

export const getStaff = async (): Promise<StaffMember[]> => (await apiClient.get('/subadmin/staff')).data;
export const createStaff = async (input: Omit<StaffMember, 'id'>): Promise<StaffMember> => (await apiClient.post('/subadmin/staff', input)).data;
export const updateStaff = async (id: string, input: Partial<StaffMember>): Promise<StaffMember> => (await apiClient.patch(`/subadmin/staff/${id}`, input)).data;
export const deleteStaff = async (id: string): Promise<void> => { await apiClient.delete(`/subadmin/staff/${id}`); };

export const getVerificationQueue = async (): Promise<VerificationCandidate[]> => (await apiClient.get('/subadmin/verification')).data;
export const reviewDocument = async (documentId: string, status: 'verified' | 'rejected' | 'pending', admin_remarks?: string): Promise<VerificationDoc> =>
  (await apiClient.patch(`/subadmin/guard-documents/${documentId}`, { status, admin_remarks })).data;

export const getBranchClients = async (): Promise<BranchClient[]> => (await apiClient.get('/subadmin/clients')).data;
export const getBranchGuards = async (): Promise<BranchGuard[]> => (await apiClient.get('/subadmin/guards')).data;
export const getSkillsReport = async (): Promise<SkillRow[]> => (await apiClient.get('/subadmin/reports/skills')).data;
export const getCommissionReport = async (): Promise<CommissionReport> => (await apiClient.get('/subadmin/reports/commission')).data;
