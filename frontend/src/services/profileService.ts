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
