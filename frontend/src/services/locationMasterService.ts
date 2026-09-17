import { apiClient } from '../lib/apiClient';

export type LocationStatus = 'active' | 'inactive';

export interface StateMaster {
  id: string;
  code: string;
  name: string;
  type: 'state' | 'union_territory';
  status: LocationStatus;
}

export interface CityMaster {
  id: string;
  state_id: string;
  name: string;
  status: LocationStatus;
  state?: StateMaster;
}

export async function listActiveStates(): Promise<StateMaster[]> {
  const { data } = await apiClient.get('/location-master/states');
  return data;
}

export async function listActiveCities(params?: { state_id?: string; q?: string }): Promise<CityMaster[]> {
  const { data } = await apiClient.get('/location-master/cities', { params });
  return data;
}

export async function listAdminStates(): Promise<StateMaster[]> {
  const { data } = await apiClient.get('/admin/location/states');
  return data;
}

export async function createStateMaster(input: { code: string; name: string; type: StateMaster['type']; status: LocationStatus }) {
  const { data } = await apiClient.post('/admin/location/states', input);
  return data as StateMaster;
}

export async function updateStateMaster(id: string, input: Partial<{ code: string; name: string; type: StateMaster['type']; status: LocationStatus }>) {
  const { data } = await apiClient.patch(`/admin/location/states/${id}`, input);
  return data as StateMaster;
}

export async function deleteStateMaster(id: string) {
  const { data } = await apiClient.delete(`/admin/location/states/${id}`);
  return data as { message: string };
}

export async function listAdminCities(stateId?: string): Promise<CityMaster[]> {
  const { data } = await apiClient.get('/admin/location/cities', { params: stateId ? { state_id: stateId } : undefined });
  return data;
}

export async function createCityMaster(input: { state_id: string; name: string; status: LocationStatus }) {
  const { data } = await apiClient.post('/admin/location/cities', input);
  return data as CityMaster;
}

export async function updateCityMaster(id: string, input: Partial<{ state_id: string; name: string; status: LocationStatus }>) {
  const { data } = await apiClient.patch(`/admin/location/cities/${id}`, input);
  return data as CityMaster;
}

export async function deleteCityMaster(id: string) {
  const { data } = await apiClient.delete(`/admin/location/cities/${id}`);
  return data as { message: string };
}
