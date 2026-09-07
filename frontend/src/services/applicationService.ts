import { apiClient } from '../lib/apiClient';

export async function applyForJob(jobId: string, coverNote?: string) {
  const { data } = await apiClient.post(`/guard/jobs/${jobId}/apply`, { cover_note: coverNote });
  return data;
}

export async function listMyApplications() {
  const { data } = await apiClient.get('/guard/applications');
  return data;
}

export async function listMyJobOffers() {
  const { data } = await apiClient.get('/guard/job-offers');
  return data;
}

export async function updateMyJobOffer(jobOfferId: string, status: 'accepted' | 'declined', remarks?: string) {
  const { data } = await apiClient.patch(`/guard/job-offers/${jobOfferId}`, { status, remarks });
  return data;
}

/** Returns only the job_ids the guard has already applied to — lightweight, no joins */
export async function listMyAppliedJobIds(): Promise<Set<string>> {
  const { data } = await apiClient.get('/guard/applications/job-ids');
  return new Set((data ?? []) as string[]);
}

export async function listEmployerApplications(companyId?: string, jobId?: string) {
  const { data } = await apiClient.get('/employer/applications', {
    params: { company_id: companyId, job_id: jobId },
  });
  return (data ?? []).map((application: any) => {
    const { job, guard_profile, ...rest } = application;
    return { ...rest, job_posts: job ?? null, guard_profiles: guard_profile ?? null };
  });
}

export async function updateApplicationStatus(applicationId: string, status: string, remarks?: string) {
  const { data } = await apiClient.patch(`/employer/applications/${applicationId}/status`, { status, remarks });
  return data;
}

export async function scheduleApplicationInterview(applicationId: string, remarks: string) {
  const { data } = await apiClient.post(`/employer/applications/${applicationId}/schedule-interview`, { remarks });
  return data;
}

export async function listAdminJobApplications(jobId: string) {
  const { data } = await apiClient.get(`/admin/jobs/${jobId}/applications`);
  return (data ?? []).map((application: any) => {
    const { job, guard_profile, ...rest } = application;
    return { ...rest, job_posts: job ?? null, guard_profiles: guard_profile ?? null };
  });
}

export async function updateAdminApplicationStatus(applicationId: string, status: string, remarks?: string) {
  const { data } = await apiClient.patch(`/admin/applications/${applicationId}/status`, { status, remarks });
  return data;
}

export async function scheduleAdminApplicationInterview(applicationId: string, remarks: string) {
  const { data } = await apiClient.post(`/admin/applications/${applicationId}/schedule-interview`, { remarks });
  return data;
}

/** Employer manually declares an associate's Aadhaar (must be in their pipeline). */
export async function declareAssociateAadhaar(guardUserId: string, status: 'verified' | 'rejected' | 'pending', remarks?: string) {
  const { data } = await apiClient.patch(`/employer/associates/${guardUserId}/aadhaar`, { status, remarks });
  return data;
}
