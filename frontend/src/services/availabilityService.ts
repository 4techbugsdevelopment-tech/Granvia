import { apiClient } from '../lib/apiClient';

export type AvailabilitySlot = {
  id: string;
  duration_hours: 4 | 6 | 8 | 12;
  frequency: 'Regular' | 'Weekly' | 'Daily';
  days: string[];
  start_time: string;
  active: boolean;
};

export async function listMyAvailability(): Promise<AvailabilitySlot[]> {
  const { data } = await apiClient.get('/guard/availability');
  return data ?? [];
}

export async function createAvailability(input: Omit<AvailabilitySlot, 'id'>): Promise<AvailabilitySlot> {
  const { data } = await apiClient.post('/guard/availability', input);
  return data;
}

export async function updateAvailability(id: string, input: Partial<Omit<AvailabilitySlot, 'id'>>): Promise<AvailabilitySlot> {
  const { data } = await apiClient.patch(`/guard/availability/${id}`, input);
  return data;
}

export async function deleteAvailability(id: string): Promise<void> {
  await apiClient.delete(`/guard/availability/${id}`);
}
