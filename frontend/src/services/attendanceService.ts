import { apiClient } from '../lib/apiClient';

function remap(record: any) {
  const { guard_profile, job, ...rest } = record;
  return { ...rest, guard_profiles: guard_profile ?? null, job_posts: job ?? null };
}

export async function listEmployerAttendance(companyId?: string) {
  const { data } = await apiClient.get('/employer/attendance', { params: { company_id: companyId } });
  return (data ?? []).map(remap);
}

export async function updateAttendanceStatus(recordId: string, status: string, employerRemarks?: string) {
  const { data } = await apiClient.patch(`/employer/attendance/${recordId}/status`, {
    status,
    employer_remarks: employerRemarks,
  });
  return data;
}

// ── Guard-side attendance ─────────────────────────────────────────────────────

export async function listMyAttendance() {
  const { data } = await apiClient.get('/guard/attendance');
  return (data ?? []).map(remap);
}

export async function checkInAttendance(jobId?: string, guardRemarks?: string) {
  const { data } = await apiClient.post('/guard/attendance/check-in', {
    job_id: jobId,
    guard_remarks: guardRemarks,
  });
  return remap(data);
}

export async function checkOutAttendance(recordId: string, guardRemarks?: string) {
  const { data } = await apiClient.patch(`/guard/attendance/${recordId}/check-out`, {
    guard_remarks: guardRemarks,
  });
  return remap(data);
}
