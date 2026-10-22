import { apiClient } from '../lib/apiClient';
import type { ReportResponse } from '../lib/reportTypes';

export type ReportingRole = 'super_admin' | 'employer' | 'guard' | 'sub_admin' | 'sales_executive' | 'operations' | 'finance';
export type ExtendedReportDefinition = { kind: string; label: string; dates: boolean; filters: string[] };
export type ExtendedReportOptions = { options: Record<string, { id: string; label: string }[]>; truncated: string[] };
export type ExtendedReport = ReportResponse<Record<string, string | number | boolean | null>, Record<string, unknown>> & { columns: { key: string; label: string }[] };
const portals: Record<ReportingRole, string> = { super_admin: 'admin', employer: 'employer', guard: 'guard', sub_admin: 'subadmin', sales_executive: 'sales', operations: 'operations', finance: 'finance' };
const base = (role: ReportingRole) => `/${portals[role]}/reports/extended`;

export async function getExtendedReportDefinitions(role: ReportingRole, signal?: AbortSignal): Promise<ExtendedReportDefinition[]> {
  const { data } = await apiClient.get(base(role), { signal }); return data.reports;
}
export async function getExtendedReport(role: ReportingRole, kind: string, params: Record<string, string>, signal?: AbortSignal): Promise<ExtendedReport> {
  const { data } = await apiClient.get(`${base(role)}/${kind}`, { params, signal }); return data;
}
export async function getExtendedReportOptions(role: ReportingRole, kind: string, search: string, signal?: AbortSignal): Promise<ExtendedReportOptions> {
  const { data } = await apiClient.get(`${base(role)}/options`, { params: { kind, ...(search ? { search } : {}) }, signal }); return data;
}
export async function exportExtendedReport(role: ReportingRole, kind: string, params: Record<string, string>) {
  try {
    const { data } = await apiClient.get(`${base(role)}/${kind}/export`, { params, responseType: 'blob' });
    const url = URL.createObjectURL(data), link = document.createElement('a');
    link.href = url; link.download = `${kind}.csv`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const cause = error as { response?: { data?: Blob } };
    if (cause.response?.data instanceof Blob) {
      let message = 'Export failed. Retry or narrow the filters.';
      try { message = JSON.parse(await cause.response.data.text()).message || message; } catch { /* retain readable fallback */ }
      throw new Error(message);
    }
    throw error;
  }
}
