export type UserRole = 'super_admin' | 'employer' | 'guard';

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  role: UserRole;
  profile_type: string | null;
  account_status: string;
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
}

export interface EmployerProfileRow {
  id: string;
  user_id: string;
  contact_person_name: string | null;
  designation: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_aadhaar_verified: boolean;
  aadhaar_verification_status: string;
  aadhaar_verified_at: string | null;
  aadhaar_last_four: string | null;
  profile_status: string;
  verification_status: string;
  admin_remarks: string | null;
  rejection_reason: string | null;
  created_from: string | null;
}

export interface GuardProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  mobile: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  skills: string[] | null;
  languages: string[] | null;
  verification_status: string;
}
