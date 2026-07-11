import { apiClient } from '../lib/apiClient';
import { Guard } from '../lib/storage';

function title(value: string | null | undefined): string {
  if (!value) return 'Pending';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Maps an API user (with guard_profile) into the Guard view-model the admin screens render. */
export function toGuardView(user: any): Guard {
  const p = user.guard_profile ?? {};
  return {
    id: user.id,
    fullName: user.full_name ?? p.full_name ?? '',
    mobile: user.mobile ?? p.mobile ?? '',
    email: user.email ?? '',
    password: '',
    gender: p.gender ?? '',
    dob: p.dob ? String(p.dob).slice(0, 10) : '',
    address: p.address ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    currentLocation: p.city ?? '',
    latitude: p.latitude != null ? String(p.latitude) : '',
    longitude: p.longitude != null ? String(p.longitude) : '',
    skills: Array.isArray(p.skills) ? p.skills : [],
    languages: Array.isArray(p.languages) ? p.languages : [],
    experience: p.experience ?? '',
    aadhaarStatus: title(p.aadhaar_status) as Guard['aadhaarStatus'],
    policeVerification: title(p.police_verification_status) as Guard['policeVerification'],
    bankDetails: p.bank_account_number ? { accountNumber: p.bank_account_number } : null,
    status: user.account_status === 'active' ? 'Active' : 'Blocked',
    avatar: user.avatar_url ?? null,
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

export async function listGuards(search?: string): Promise<Guard[]> {
  const { data } = await apiClient.get('/admin/guards', { params: { search } });
  return (data ?? []).map(toGuardView);
}

export type CreateGuardInput = {
  full_name: string;
  email: string;
  mobile: string;
  password?: string;
  gender?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  skills?: string[];
  languages?: string[];
  experience?: string;
  account_status?: 'active' | 'blocked';
};

export async function createGuard(input: CreateGuardInput) {
  const { data } = await apiClient.post('/admin/guards', input);
  return data;
}

export async function setGuardAccountStatus(userId: string, accountStatus: 'active' | 'blocked') {
  const { data } = await apiClient.patch(`/admin/guards/${userId}`, { account_status: accountStatus });
  return toGuardView(data);
}
