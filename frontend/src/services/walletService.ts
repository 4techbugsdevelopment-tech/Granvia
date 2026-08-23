import { apiClient } from '../lib/apiClient';

export async function getEmployerWallet() {
  const { data } = await apiClient.get('/employer/wallet');
  return data;
}

export async function listWalletTransactions(companyId?: string) {
  const { data } = await apiClient.get('/employer/wallet/transactions', { params: { company_id: companyId } });
  return data;
}

export async function getMyGuardWallet() {
  const { data } = await apiClient.get('/guard/wallet');
  return data as { balance_coins: number; balance_inr: number; coin_value_inr: number };
}

export async function listMyGuardTransactions() {
  const { data } = await apiClient.get('/guard/wallet/transactions');
  return data ?? [];
}
