import { apiClient } from '../lib/apiClient';
import { Employer, EmployerCompany, EmployerDocument, CompanySite } from '../lib/storage';

export type EmployerCreationInput = {
  companyName?: string;
  contactPersonName: string;
  mobile: string;
  email: string;
  password?: string;
  companyAddress?: string;
  city: string;
  state: string;
  pincode: string;
  businessType?: string;
  gstNumber?: string;
  panNumber?: string;
  website?: string;
  accountStatus?: Employer['accountStatus'];
  remarks?: string;
};

export type EmployerManagementJobSummary = {
  id: string;
  employerId: string;
  companyId: string;
};

export type EmployerManagementData = {
  employers: Employer[];
  companies: EmployerCompany[];
  documents: EmployerDocument[];
  sites: CompanySite[];
  jobs: EmployerManagementJobSummary[];
  walletBalances: Record<string, number>;
};

export type EmployerCreationResult = {
  employer: Employer;
  temporaryPassword: string | null;
};

type Row = Record<string, any>;

function toTitleStatus<T extends string>(value: unknown, fallback: T): T {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'active') return 'Active' as T;
  if (normalized === 'inactive') return 'Inactive' as T;
  if (normalized === 'blocked') return 'Blocked' as T;
  if (normalized === 'verified') return 'Verified' as T;
  if (normalized === 'rejected') return 'Rejected' as T;
  if (normalized === 'complete') return 'Complete' as T;
  if (normalized === 'incomplete') return 'Incomplete' as T;
  if (normalized === 'pending') return 'Pending' as T;
  return fallback;
}

function mapCompany(row: Row): EmployerCompany {
  return {
    id: row.id,
    employerId: row.employer_user_id,
    companyName: row.company_name || '',
    businessType: row.business_type || '',
    registrationType: row.registration_type || '',
    gstNumber: row.gst_number || '',
    panNumber: row.pan_number || '',
    companyEmail: row.company_email || '',
    companyPhone: row.company_phone || '',
    website: row.website || '',
    logo: row.logo_url || null,
    description: row.description || '',
    registeredAddress: row.registered_address || '',
    billingAddress: row.billing_address || '',
    city: row.city || '',
    state: row.state || '',
    pincode: row.pincode || '',
    verificationStatus: toTitleStatus(row.verification_status, 'Pending'),
    accountStatus: toTitleStatus(row.account_status, 'Pending'),
    adminRemarks: row.admin_remarks || '',
    rejectionReason: row.rejection_reason || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  } as EmployerCompany;
}

function mapEmployer(user: Row, firstCompany?: EmployerCompany): Employer {
  const employerProfile = user.employer_profile || {};
  const fullName = user.full_name || employerProfile.contact_person_name || '';
  const city = employerProfile.city || firstCompany?.city || '';
  const state = employerProfile.state || firstCompany?.state || '';
  const pincode = employerProfile.pincode || firstCompany?.pincode || '';
  const hasProfile = Boolean(fullName && city && state && pincode);
  return {
    id: user.id,
    companyName: firstCompany?.companyName || '',
    contactPersonName: employerProfile.contact_person_name || fullName,
    designation: employerProfile.designation || 'Authorized Representative',
    mobile: user.mobile || firstCompany?.companyPhone || '',
    email: user.email || firstCompany?.companyEmail || '',
    password: '',
    companyAddress: firstCompany?.registeredAddress || '',
    billingAddress: firstCompany?.billingAddress || '',
    city,
    state,
    pincode,
    businessType: firstCompany?.businessType || '',
    gstNumber: firstCompany?.gstNumber || '',
    panNumber: firstCompany?.panNumber || '',
    website: firstCompany?.website || '',
    logo: firstCompany?.logo || null,
    description: firstCompany?.description || '',
    verificationStatus: toTitleStatus(employerProfile.verification_status, 'Pending'),
    accountStatus: toTitleStatus(user.account_status, 'Pending'),
    role: 'employer',
    createdFrom: employerProfile.created_from === 'super_admin' ? 'super_admin' : 'app',
    createdBy: employerProfile.created_by || null,
    profileStatus: toTitleStatus(employerProfile.profile_status, hasProfile ? 'Complete' : 'Incomplete'),
    isAadhaarVerified: Boolean(employerProfile.is_aadhaar_verified),
    aadhaarVerificationStatus: (employerProfile.aadhaar_verification_status || 'pending') as Employer['aadhaarVerificationStatus'],
    aadhaarVerifiedAt: employerProfile.aadhaar_verified_at || null,
    aadhaarLastFour: employerProfile.aadhaar_last_four || '',
    adminRemarks: employerProfile.admin_remarks || '',
    rejectionReason: employerProfile.rejection_reason || '',
    createdAt: employerProfile.created_at || user.created_at || '',
  } as unknown as Employer;
}

function mapDocument(row: Row): EmployerDocument {
  const filePath = String(row.file_path || row.file_url || '');
  return {
    id: row.id,
    employerId: row.employer_user_id,
    companyId: row.company_id,
    type: row.document_type || 'Document',
    fileName: filePath.split('/').filter(Boolean).pop() || filePath || 'Uploaded document',
    fileSize: Number(row.file_size || 0),
    fileType: row.file_type || '',
    uploadedAt: row.created_at || '',
    downloadUrl: row.download_url || '',
    status: toTitleStatus(row.verification_status, 'Pending'),
    adminRemarks: row.admin_remarks || '',
    rejectionReason: row.rejection_reason || '',
  } as unknown as EmployerDocument;
}

function mapSite(row: Row): CompanySite {
  return {
    id: row.id,
    employerId: row.employer_user_id,
    companyId: row.company_id,
    siteName: row.site_name || '',
    siteType: row.site_type || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    pincode: row.pincode || '',
    contactPerson: row.contact_person || '',
    contactMobile: row.contact_mobile || '',
    mapsLocation: '',
    latitude: row.latitude == null ? '' : String(row.latitude),
    longitude: row.longitude == null ? '' : String(row.longitude),
    shiftDetails: row.shift_details || '',
    notes: row.notes || '',
    status: toTitleStatus(row.status, 'Active'),
    createdAt: row.created_at || '',
  } as unknown as CompanySite;
}

export async function listEmployerManagementData(): Promise<EmployerManagementData> {
  const { data } = await apiClient.get('/admin/employers');

  const companies = (data.companies as Row[]).map(mapCompany);
  const companiesByEmployerId = new Map<string, EmployerCompany[]>();
  companies.forEach((company) => {
    const list = companiesByEmployerId.get(company.employerId) || [];
    list.push(company);
    companiesByEmployerId.set(company.employerId, list);
  });

  const employers = (data.employers as Row[]).map((user) =>
    mapEmployer(user, companiesByEmployerId.get(user.id)?.[0])
  );

  const walletBalances: Record<string, number> = {};
  (data.employers as Row[]).forEach((user) => {
    if (user.employer_wallet) {
      walletBalances[user.id] = Number(user.employer_wallet.balance || 0);
    }
  });

  return {
    employers,
    companies,
    documents: (data.documents as Row[]).map(mapDocument),
    sites: (data.sites as Row[]).map(mapSite),
    jobs: (data.jobs as Row[]).map((row) => ({
      id: row.id,
      employerId: row.employer_user_id,
      companyId: row.company_id,
    })),
    walletBalances,
  };
}

function toApiPayload(input: EmployerCreationInput) {
  return {
    contact_person_name: input.contactPersonName.trim(),
    mobile: input.mobile.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password?.trim() || undefined,
    city: input.city.trim(),
    state: input.state.trim(),
    pincode: input.pincode.trim(),
    company_name: input.companyName?.trim() || undefined,
    company_address: input.companyAddress?.trim() || undefined,
    business_type: input.businessType?.trim() || undefined,
    gst_number: input.gstNumber?.trim().toUpperCase() || undefined,
    pan_number: input.panNumber?.trim().toUpperCase() || undefined,
    website: input.website?.trim() || undefined,
    account_status: input.accountStatus ? input.accountStatus.toLowerCase() : undefined,
  };
}

export async function createEmployerFromAdmin(input: EmployerCreationInput): Promise<EmployerCreationResult> {
  const { data } = await apiClient.post('/admin/employers', toApiPayload(input));

  const managementData = await listEmployerManagementData();
  const employer = managementData.employers.find((item) => item.id === data.employer.id);
  if (!employer) throw new Error('Employer was created but could not be loaded.');

  return { employer, temporaryPassword: data.temporary_password ?? null };
}

export async function updateEmployerFromAdmin(id: string, updates: Partial<Employer>) {
  const payload: Record<string, unknown> = {};

  if (updates.contactPersonName !== undefined) payload.contact_person_name = updates.contactPersonName;
  if (updates.mobile !== undefined) payload.mobile = updates.mobile;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.accountStatus !== undefined) payload.account_status = String(updates.accountStatus).toLowerCase();
  if (updates.city !== undefined) payload.city = updates.city;
  if (updates.state !== undefined) payload.state = updates.state;
  if (updates.pincode !== undefined) payload.pincode = updates.pincode;
  if (updates.designation !== undefined) payload.designation = updates.designation;
  if ((updates as any).companyName !== undefined) payload.company_name = (updates as any).companyName;
  if ((updates as any).businessType !== undefined) payload.business_type = (updates as any).businessType;
  if ((updates as any).gstNumber !== undefined) payload.gst_number = (updates as any).gstNumber;
  if ((updates as any).panNumber !== undefined) payload.pan_number = (updates as any).panNumber;
  if ((updates as any).website !== undefined) payload.website = (updates as any).website;
  if ((updates as any).companyAddress !== undefined) payload.company_address = (updates as any).companyAddress;

  await apiClient.patch(`/admin/employers/${id}`, payload);
}

export async function assertUniqueEmployerForEdit(_id: string, _email: string, _mobile: string) {
  // Uniqueness is enforced server-side on update; nothing to pre-check client-side.
}

export async function deleteEmployerFromAdmin(id: string) {
  await apiClient.delete(`/admin/employers/${id}`);
}

/** Admin manually declares an employer's Aadhaar verification (API disabled). */
export async function declareEmployerAadhaar(id: string, status: 'verified' | 'rejected' | 'pending', remarks?: string) {
  const { data } = await apiClient.patch(`/admin/employers/${id}/aadhaar`, { status, remarks });
  return data;
}
