import { apiClient } from '../lib/apiClient';
import type { ReportResponse } from '../lib/reportTypes';

export type EmployerReportKind = 'job-hiring' | 'applications' | 'interviews' | 'offers' | 'agreements' | 'attendance' | 'attendance-exceptions';
export type EmployerReport = ReportResponse<Record<string, string | number | null>, Record<string, unknown>> & {
  columns: { key: string; label: string }[];
};
export async function getEmployerReportOptions(companyId: string, signal?: AbortSignal) {
  const { data } = await apiClient.get('/employer/reports/options', { params: { company_id: companyId }, signal });
  return data as { jobs: { id: string; label: string; siteId?: string }[]; sites: { id: string; label: string }[];
    associates: { id: string; label: string }[]; types: { id: string; label: string }[]; warnings: string[] };
}
export async function getEmployerReport(kind: EmployerReportKind, params: Record<string, string>, signal?: AbortSignal): Promise<EmployerReport> {
  const { data } = await apiClient.get(`/employer/reports/${kind}`, { params, signal });
  return data;
}
export async function downloadEmployerReport(kind: EmployerReportKind, params: Record<string, string>) {
  try {
    const { data } = await apiClient.get(`/employer/reports/${kind}/export`, { params, responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url; link.download = `${kind}-${params.company_id}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const cause = error as { response?: { data?: Blob }; message?: string };
    if (cause.response?.data instanceof Blob) {
      const payload = await cause.response.data.text();
      try { const parsed = JSON.parse(payload); throw new Error(parsed.message || 'Export failed.'); }
      catch (parseError) { if (parseError instanceof SyntaxError) throw new Error('Export failed. Retry or narrow the report filters.'); throw parseError; }
    }
    throw error;
  }
}
