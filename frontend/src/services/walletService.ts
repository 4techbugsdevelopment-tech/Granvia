import { apiClient } from '../lib/apiClient';

export async function getEmployerWallet() {
  const { data } = await apiClient.get('/employer/wallet');
  return data;
}

export async function listWalletTransactions(companyId?: string) {
  const { data } = await apiClient.get('/employer/wallet/transactions', { params: { company_id: companyId } });
  return data;
}
