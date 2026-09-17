import { apiClient } from '../lib/apiClient';

function remap(record: any) {
  const { guard_profile, job, ...rest } = record;
  return { ...rest, guard_profiles: guard_profile ?? null, job_posts: job ?? null };
}

export async function listEmployerAttendance(companyId?: string) {
  const { data } = await apiClient.get('/employer/attendance', { params: { company_id: companyId } });
  return (data ?? []).map(remap);
}

export async function updateAttendanceStatus(recordId: string, status: 'approved' | 'rejected', employerRemarks?: string) {
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

export async function getAttendanceConfiguration(): Promise<{ attendanceLocationEnabled: boolean; attendanceGeofenceRadiusMeters: number }> {
  const { data } = await apiClient.get('/config/public');
  return {
    attendanceLocationEnabled: data?.location_capture_enabled !== false,
    attendanceGeofenceRadiusMeters: Number(data?.attendance_geofence_radius_meters ?? 250),
  };
}

export async function checkInAttendance(input: {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  jobId?: string;
  guardRemarks?: string;
}) {
  const { data } = await apiClient.post('/guard/attendance/check-in', {
    job_id: input.jobId,
    guard_remarks: input.guardRemarks,
    latitude: input.latitude,
    longitude: input.longitude,
    location_name: input.locationName,
  });
  return remap(data);
}

export async function checkOutAttendance(recordId: string, input: {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  guardRemarks?: string;
}) {
  const { data } = await apiClient.patch(`/guard/attendance/${recordId}/check-out`, {
    guard_remarks: input.guardRemarks,
    latitude: input.latitude,
    longitude: input.longitude,
    location_name: input.locationName,
  });
  return remap(data);
}

export async function saveHistoricalAttendance(input: {
  attendanceDate: string;
  inTime: string;
  outTime: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInLocationName?: string;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutLocationName?: string;
  jobId?: string;
  guardRemarks?: string;
}) {
  const { data } = await apiClient.post('/guard/attendance/history', {
    attendance_date: input.attendanceDate,
    in_time: input.inTime,
    out_time: input.outTime,
    check_in_latitude: input.checkInLatitude,
    check_in_longitude: input.checkInLongitude,
    check_in_location_name: input.checkInLocationName,
    check_out_latitude: input.checkOutLatitude,
    check_out_longitude: input.checkOutLongitude,
    check_out_location_name: input.checkOutLocationName,
    job_id: input.jobId,
    guard_remarks: input.guardRemarks,
  });
  return remap(data);
}

export async function updateMyAttendance(recordId: string, input: {
  inTime: string;
  outTime: string;
  guardRemarks?: string;
}) {
  const { data } = await apiClient.patch(`/guard/attendance/${recordId}`, {
    in_time: input.inTime,
    out_time: input.outTime,
    guard_remarks: input.guardRemarks,
  });
  return remap(data);
}
