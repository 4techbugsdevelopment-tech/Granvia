import { apiClient } from '../lib/apiClient';

export async function listEmployerPayments(companyId?: string) {
  const { data } = await apiClient.get('/employer/payments', { params: { company_id: companyId } });
  return (data ?? []).map((payment: any) => {
    const { job, guard_profile, ...rest } = payment;
    return { ...rest, job_posts: job ?? null, guard_profiles: guard_profile ?? null };
  });
}

export async function createPaymentRecord(input: Record<string, unknown>) {
  const { data } = await apiClient.post('/employer/payments', input);
  return data;
}

export async function listEmployerInvoices(companyId?: string) {
  const { data } = await apiClient.get('/employer/invoices', { params: { company_id: companyId } });
  return data;
}

// ── Cash payment OTP confirmation ─────────────────────────────────────────────

/** Emails a confirmation code to the guard for a cash payment. dev_otp in dev. */
export async function requestCashPaymentOtp(paymentId: string) {
  const { data } = await apiClient.post(`/employer/payments/${paymentId}/request-otp`, {});
  return data as { sent_to: string; payment_id: string; dev_otp?: string };
}

/** Verifies the guard's code and marks the cash payment completed. */
export async function confirmCashPaymentOtp(paymentId: string, otp: string) {
  const { data } = await apiClient.post(`/employer/payments/${paymentId}/confirm-otp`, { otp: otp.trim() });
  return data;
}
