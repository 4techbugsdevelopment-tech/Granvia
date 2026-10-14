import { apiClient } from '../lib/apiClient';
import type { ReportResponse } from '../lib/reportTypes';
export type AdminReportKind = 'platform-summary' | 'employer-verification' | 'company-verification' | 'company-documents' | 'associate-verification' | 'associate-documents' | 'job-hiring' | 'applications' | 'attendance' | 'attendance-exceptions' | 'attendance-audit';
export type AdminReport = ReportResponse<Record<string, string | number | null>, Record<string, unknown>> & { columns: { key: string; label: string }[] };
export type ReportOption = { id: string; label: string; role?: string; siteId?: string; employerId?: string };
export type AdminReportOptions = Record<'employers' | 'companies' | 'sites' | 'jobs' | 'associates' | 'staff' | 'types', ReportOption[]>;
export async function getAdminReport(kind: AdminReportKind, params: Record<string, string>, signal?: AbortSignal): Promise<AdminReport> {
  const { data } = await apiClient.get(`/admin/reports/${kind}`, { params, signal }); return data;
}
export async function getAdminReportOptions(params: Record<string, string>, signal?: AbortSignal): Promise<AdminReportOptions> {
  const { data } = await apiClient.get('/admin/reports/options', { params, signal }); return data;
}
export async function downloadAdminReport(kind: AdminReportKind, params: Record<string, string>) {
  try {
    const { data } = await apiClient.get(`/admin/reports/${kind}/export`, { params, responseType: 'blob' });
    const url = URL.createObjectURL(data), link = document.createElement('a');
    link.href = url; link.download = `${kind}.csv`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const cause = error as { response?: { data?: Blob } };
    if (cause.response?.data instanceof Blob) {
      const text = await cause.response.data.text(); let message = 'Export failed. Retry or narrow the report filters.';
      try { message = JSON.parse(text).message || message; } catch { /* HTML or non-JSON server error */ }
      throw new Error(message);
    }
    throw error;
  }
}
