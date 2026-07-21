import { apiClient, setStoredToken } from '../lib/apiClient';
import { notifyAuthChange } from '../lib/authBus';
import { EmployerProfileRow, GuardProfileRow, ProfileRow, UserRole } from '../lib/apiTypes';

export type AppSession = {
  profile: ProfileRow;
  employerProfile: EmployerProfileRow | null;
  guardProfile: GuardProfileRow | null;
};

export type EmployerRegistrationInput = {
  contactPersonName: string;
  mobile: string;
  email: string;
  password: string;
  city: string;
  state: string;
  pincode: string;
  companyName?: string;
  businessType?: string;
  companyAddress?: string;
  gstNumber?: string;
  panNumber?: string;
  website?: string;
};

function toAppSession(data: {
  user: ProfileRow;
  employer_profile: EmployerProfileRow | null;
  guard_profile: GuardProfileRow | null;
}): AppSession {
  return {
    profile: data.user,
    employerProfile: data.employer_profile,
    guardProfile: data.guard_profile,
  };
}

export async function getCurrentAppSession(): Promise<AppSession | null> {
  try {
    const { data } = await apiClient.get('/auth/me');
    return toAppSession(data);
  } catch {
    return null;
  }
}

export async function signInWithRole(email: string, password: string, role: UserRole): Promise<AppSession> {
  const { data } = await apiClient.post('/auth/login', {
    email: email.trim().toLowerCase(),
    password,
    role,
  });

  setStoredToken(data.token);
  notifyAuthChange();

  return toAppSession(data);
}

/**
 * Role-agnostic sign-in used by the universal mobile app. The backend returns
 * the account's own role, which the caller uses to pick the right shell.
 */
export async function signIn(email: string, password: string): Promise<AppSession> {
  const { data } = await apiClient.post('/auth/login', {
    email: email.trim().toLowerCase(),
    password,
  });

  setStoredToken(data.token);
  notifyAuthChange();

  return toAppSession(data);
}

export async function registerEmployer(input: EmployerRegistrationInput) {
  const { data } = await apiClient.post('/auth/register/employer', {
    contact_person_name: input.contactPersonName.trim(),
    mobile: input.mobile.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    city: input.city.trim(),
    state: input.state.trim(),
    pincode: input.pincode.trim(),
    company_name: input.companyName?.trim() || undefined,
    business_type: input.businessType?.trim() || undefined,
    company_address: input.companyAddress?.trim() || undefined,
    gst_number: input.gstNumber?.trim().toUpperCase() || undefined,
    pan_number: input.panNumber?.trim().toUpperCase() || undefined,
    website: input.website?.trim() || undefined,
  });

  return data;
}

export async function resendEmailVerification(email: string) {
  await apiClient.post('/auth/email/verification-notification', { email: email.trim().toLowerCase() });
}

export async function signOut() {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Token may already be invalid/expired — clearing it locally is enough.
  }
  setStoredToken(null);
  notifyAuthChange();
}
