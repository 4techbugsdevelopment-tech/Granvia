import { apiClient } from '../lib/apiClient';

export async function listPayrollPeriods() { const { data } = await apiClient.get('/employer/payroll-periods'); return data as any[]; }
export async function createPayrollPeriod(input: { label: string; period_start: string; period_end: string }) { const { data } = await apiClient.post('/employer/payroll-periods', input); return data; }
export async function listPayrollRuns(periodId?: string) { const { data } = await apiClient.get('/employer/payroll-runs', { params: periodId ? { period_id: periodId } : undefined }); return data as any[]; }
export async function previewPayroll(input: { period_id: string; idempotency_key: string; full_period_confirmed: true; application_ids?: string[] }) { const { data } = await apiClient.post('/employer/payroll-runs/preview', input); return data; }
export async function approvePayroll(runId: string) { const { data } = await apiClient.post(`/employer/payroll-runs/${runId}/approve`); return data; }
export async function finalizePayroll(runId: string) { const { data } = await apiClient.post(`/employer/payroll-runs/${runId}/finalize`); return data; }
export async function reversePayroll(runId: string, input: { idempotency_key: string; reason: string }) { const { data } = await apiClient.post(`/employer/payroll-runs/${runId}/reversal`, input); return data; }
export async function listEmployerPayslips() { const { data } = await apiClient.get('/employer/payslips'); return data as any[]; }
export async function listGuardPayslips() { const { data } = await apiClient.get('/guard/payslips'); return data as any[]; }
export async function createPayrollPayment(resultId: string, input: { idempotency_key: string; payment_method?: string | null }) { const { data } = await apiClient.post(`/employer/payroll-results/${resultId}/payment`, input); return data; }
export async function updatePayrollPayment(paymentId: string, input: Record<string, unknown>) { const { data } = await apiClient.patch(`/employer/payroll-payments/${paymentId}`, input); return data; }
export async function listLwfLiabilities(params?: { state_id?: string; status?: string }) { const { data } = await apiClient.get('/employer/lwf-liabilities', { params }); return data as { liabilities: any[]; totals: Record<string, string> }; }
export async function listLwfRemittances(stateId?: string) { const { data } = await apiClient.get('/employer/lwf-remittances', { params: stateId ? { state_id: stateId } : undefined }); return data as any[]; }
export async function createLwfRemittance(input: { state_id: string; amount: string; payment_reference: string; challan_number?: string | null; remitted_at: string; notes?: string | null; allocations: Array<{ liability_id: string; amount: string }> }) { const { data } = await apiClient.post('/employer/lwf-remittances', input); return data; }
export async function voidLwfRemittance(id: string, reason: string) { const { data } = await apiClient.post(`/employer/lwf-remittances/${id}/void`, { reason }); return data; }
export async function uploadLwfReceipt(id: string, file: File) { const body = new FormData(); body.append('file', file); const { data } = await apiClient.post(`/employer/lwf-remittances/${id}/attachments`, body, { headers: { 'Content-Type': 'multipart/form-data' } }); return data; }
