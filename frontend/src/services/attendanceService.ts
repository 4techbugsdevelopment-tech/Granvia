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
