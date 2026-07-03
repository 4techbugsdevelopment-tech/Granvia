import { apiClient } from '../lib/apiClient';

function remap(record: any) {
  const { job, guard_profile, ...rest } = record;
  return { ...rest, job_posts: job ?? null, guard_profiles: guard_profile ?? null };
}

// ── Interview requests ────────────────────────────────────────────────────────

export async function listInterviewRequests(companyId?: string) {
  const { data } = await apiClient.get('/employer/interview-requests', { params: { company_id: companyId } });
  return (data ?? []).map(remap);
}

export async function createInterviewRequest(input: Record<string, unknown>) {
  const { data } = await apiClient.post('/employer/interview-requests', input);
  return data;
}

export async function updateInterviewRequest(id: string, updates: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/employer/interview-requests/${id}`, updates);
  return data;
}

// ── Job offers ────────────────────────────────────────────────────────────────

export async function listJobOffers(companyId?: string) {
  const { data } = await apiClient.get('/employer/job-offers', { params: { company_id: companyId } });
  return (data ?? []).map(remap);
}

export async function createJobOffer(input: Record<string, unknown>) {
  const { data } = await apiClient.post('/employer/job-offers', input);
  return data;
}

export async function updateJobOffer(id: string, updates: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/employer/job-offers/${id}`, updates);
  return data;
}

// ── Agreements ────────────────────────────────────────────────────────────────

export async function listAgreements(companyId?: string) {
  const { data } = await apiClient.get('/employer/agreements', { params: { company_id: companyId } });
  return (data ?? []).map(remap);
}

export async function createAgreement(input: Record<string, unknown>) {
  const { data } = await apiClient.post('/employer/agreements', input);
  return data;
}

export async function updateAgreement(id: string, updates: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/employer/agreements/${id}`, updates);
  return data;
}
