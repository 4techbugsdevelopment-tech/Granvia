import { apiClient } from '../lib/apiClient';
import type { ReportResponse } from '../lib/reportTypes';
export type FinancialRole = 'employer' | 'super_admin';
export type FinancialKind = 'payments' | 'wallet-statement' | 'wallets' | 'wallet-movements' | 'settlements';
export type FinancialReport = ReportResponse<Record<string, string | number | null>, Record<string, unknown>> & { columns: { key: string; label: string }[] };
export type FinancialOption = { id: string; label: string; siteId?: string };
export type FinancialOptions = Record<'employers' | 'companies' | 'jobs' | 'sites' | 'associates', FinancialOption[]>;
const prefix = (role: FinancialRole) => role === 'employer' ? '/employer/reports' : '/admin/reports';
export async function getFinancialReport(role: FinancialRole, kind: FinancialKind, params: Record<string, string>, signal?: AbortSignal): Promise<FinancialReport> {
  const { data } = await apiClient.get(`${prefix(role)}/${kind}`, { params, signal }); return data;
}
export async function getFinancialOptions(role: FinancialRole, params: Record<string, string>, signal?: AbortSignal): Promise<FinancialOptions> {
  const { data } = await apiClient.get(`${prefix(role)}/financial-options`, { params, signal }); return data;
}
export async function downloadFinancialReport(role: FinancialRole, kind: FinancialKind, params: Record<string, string>) {
  try {
    const { data } = await apiClient.get(`${prefix(role)}/${kind}/export`, { params, responseType: 'blob' });
    const url = URL.createObjectURL(data), link = document.createElement('a'); link.href = url; link.download = `${kind}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const cause = error as { response?: { data?: Blob } };
    if (cause.response?.data instanceof Blob) {
      const text = await cause.response.data.text(); let message = 'Export failed. Retry or narrow the report filters.';
      try { message = JSON.parse(text).message || message; } catch { /* Non-JSON server error */ }
      throw new Error(message);
    }
    throw error;
  }
}
