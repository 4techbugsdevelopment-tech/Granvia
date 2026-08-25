import { apiClient } from '../lib/apiClient';

function remapJob(job: any) {
  if (!job) return job;
  const { company, site, ...rest } = job;
  return {
    ...rest,
    employer_companies: company ?? null,
    company_sites: site ?? null,
  };
}

function remapJobs(jobs: any[]) {
  return (jobs ?? []).map(remapJob);
}

export async function listActiveJobs() {
  const { data } = await apiClient.get('/jobs');
  return remapJobs(data);
}

export async function listEmployerJobs(companyId?: string) {
  const { data } = await apiClient.get('/employer/jobs', { params: { company_id: companyId } });
  return remapJobs(data);
}

export async function createJobPost(input: Record<string, unknown> & { company_id: string; site_id: string; title: string }) {
  const { data } = await apiClient.post('/employer/jobs', input);
  return remapJob(data);
}

/** Admin: jobs awaiting approval */
export async function listPendingJobs() {
  const { data } = await apiClient.get('/admin/jobs/pending');
  return remapJobs(data);
}

export async function approveJob(jobId: string) {
  const { data } = await apiClient.patch(`/admin/jobs/${jobId}/approve`);
  return data;
}

export async function rejectJob(jobId: string, reason?: string) {
  const { data } = await apiClient.patch(`/admin/jobs/${jobId}/reject`, { reason });
  return data;
}

export async function updateAdminJobStatus(jobId: string, status: 'pending_approval' | 'closed') {
  const { data } = await apiClient.patch(`/admin/jobs/${jobId}/status`, { status });
  return data;
}

/** Admin: all jobs regardless of status, newest first */
export async function listAllJobsForAdmin() {
  const { data } = await apiClient.get('/admin/jobs');
  return remapJobs(data);
}

export async function createAdminJob(input: Record<string, unknown> & { company_id: string; title: string }) {
  const { data } = await apiClient.post('/admin/jobs', input);
  return remapJob(data);
}

export async function updateAdminJob(jobId: string, updates: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/admin/jobs/${jobId}`, updates);
  return remapJob(data);
}

export async function deleteAdminJob(jobId: string) {
  await apiClient.delete(`/admin/jobs/${jobId}`);
}

export async function deleteJobPost(jobId: string) {
  await apiClient.delete(`/employer/jobs/${jobId}`);
}

export async function updateJobPost(jobId: string, updates: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/employer/jobs/${jobId}`, updates);
  return remapJob(data);
}
