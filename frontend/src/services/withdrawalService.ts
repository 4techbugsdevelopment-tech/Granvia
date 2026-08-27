import { apiClient } from '../lib/apiClient';

export type WithdrawalRow = {
  id: string;
  guard_user_id: string;
  amount: number | string;
  net_amount: number | string;
  status: string;
  rejection_reason?: string | null;
  gateway_reference?: string | null;
  created_at: string;
  associate?: {
    id: string;
    full_name: string;
    email: string;
    mobile?: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_ifsc?: string | null;
  } | null;
};

export async function requestWithdrawal(amount: number) {
  const { data } = await apiClient.post('/guard/withdrawals', { amount });
  return data as WithdrawalRow;
}

export async function listMyWithdrawals() {
  const { data } = await apiClient.get('/guard/withdrawals');
  return (data ?? []) as WithdrawalRow[];
}

export async function listFinanceWithdrawals(status?: string) {
  const { data } = await apiClient.get('/finance/withdrawals', { params: { status } });
  return (data ?? []) as WithdrawalRow[];
}

export async function decideWithdrawal(id: string, decision: 'approve' | 'reject', reasonOrRemarks?: string) {
  const body = decision === 'reject'
    ? { decision, reason: reasonOrRemarks }
    : { decision, remarks: reasonOrRemarks };
  const { data } = await apiClient.patch(`/finance/withdrawals/${id}/decision`, body);
  return data as WithdrawalRow;
}

export async function completeWithdrawal(id: string, gatewayReference: string) {
  const { data } = await apiClient.post(`/finance/withdrawals/${id}/complete`, { gateway_reference: gatewayReference });
  return data as WithdrawalRow;
}
