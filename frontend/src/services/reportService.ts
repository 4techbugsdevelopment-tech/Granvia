import { apiClient } from '../lib/apiClient';

export async function getEmployerReportCounts(companyId?: string) {
  const { data } = await apiClient.get('/employer/reports/counts', { params: { company_id: companyId } });
  return data;
}

export type AdminReportCounts = {
  guards: number;
  employers: number;
  jobs: number;
  active_jobs: number;
  pending_jobs: number;
  applications: number;
  attendance_today: number;
  payments: number;
};

export async function getAdminReportCounts(): Promise<AdminReportCounts> {
  const { data } = await apiClient.get('/admin/reports/counts');
  return data;
}

// ── Admin platform-wide views ─────────────────────────────────────────────────

export type AdminAttendanceRecord = {
  id: string;
  guard_profile: { full_name: string | null } | null;
  job: { title: string | null; site: { site_name: string | null } | null; company: { company_name: string | null } | null } | null;
  attendance_date: string;
  in_time: string | null;
  out_time: string | null;
  total_hours: number | null;
  status: string;
};

export type AdminAttendance = {
  stats: { checked_in_today: number; active: number; verified: number; pending: number };
  records: AdminAttendanceRecord[];
};

export async function getAdminAttendance(): Promise<AdminAttendance> {
  const { data } = await apiClient.get('/admin/attendance');
  return data;
}

export type AdminHiring = {
  funnel: { stage: string; count: number; color: string }[];
  recent_hires: { guard: string; employer: string; site: string; date: string; status: string }[];
};

export async function getAdminHiring(): Promise<AdminHiring> {
  const { data } = await apiClient.get('/admin/hiring');
  return data;
}

export type AdminAnalytics = {
  area_availability: { area: string; available: number; deployed: number; total: number; languages: { English: number } }[];
  total_english: number;
  commission_by_month: { month: string; commission: number }[];
  commission_rate: number;
  total_earned: number;
};

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const { data } = await apiClient.get('/admin/reports/analytics');
  return data;
}
