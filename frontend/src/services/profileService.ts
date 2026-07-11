import { apiClient } from '../lib/apiClient';

export async function getMyProfile() {
  const { data } = await apiClient.get('/me/profile');
  return data;
}

export async function getMyEmployerProfile() {
  try {
    const { data } = await apiClient.get('/me/employer-profile');
    return data;
  } catch {
    return null;
  }
}

export async function updateMyProfile(updates: { full_name?: string; mobile?: string }) {
  const { data } = await apiClient.patch('/me/profile', updates);
  return data;
}

export async function getMyGuardProfile() {
  try {
    const { data } = await apiClient.get('/me/guard-profile');
    return data;
  } catch {
    return null;
  }
}

export type GuardProfileUpdate = {
  full_name?: string;
  mobile?: string;
  gender?: string | null;
  dob?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  search_radius_km?: number;
  qualification?: string | null;
  skills?: string[];
  languages?: string[];
  experience?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  account_holder_name?: string | null;
};

export async function updateMyGuardProfile(updates: GuardProfileUpdate) {
  const { data } = await apiClient.patch('/me/guard-profile', updates);
  return data;
}

export async function updateMyEmployerProfile(updates: {
  contact_person_name?: string;
  designation?: string;
  city?: string;
  state?: string;
  pincode?: string;
}) {
  try {
    const { data } = await apiClient.patch('/me/employer-profile', updates);
    return data;
  } catch {
    return null;
  }
}
