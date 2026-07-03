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
