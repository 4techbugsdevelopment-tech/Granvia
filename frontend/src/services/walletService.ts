import { apiClient } from '../lib/apiClient';

export type EmployerWallet = {
  id: string;
  employer_user_id: string;
  balance: number;
  deposit_balance: number;
  credit_balance: number;
  total_recharged: number;
  total_credited: number;
  total_debited: number;
  currency: string;
  status: string;
};

export async function getEmployerWallet() {
  const { data } = await apiClient.get('/employer/wallet');
  return data as EmployerWallet;
}

export async function listWalletTransactions(companyId?: string) {
  const { data } = await apiClient.get('/employer/wallet/transactions', { params: { company_id: companyId } });
  return data;
}

export async function rechargeEmployerWallet(amount: number, remarks?: string) {
  const { data } = await apiClient.post('/employer/wallet/recharge', { amount, remarks });
  return data as { wallet: EmployerWallet; transaction: Record<string, unknown> };
}

export async function listAdminWallets() {
  const { data } = await apiClient.get('/admin/wallets');
  return data as {
    totals: {
      balance: number;
      deposit_balance: number;
      credit_balance: number;
      total_recharged: number;
      total_credited: number;
      total_debited: number;
    };
    wallets: Array<EmployerWallet & { employer?: { id: string; full_name?: string; email?: string; mobile?: string } }>;
    transactions: Array<Record<string, any>>;
  };
}

export async function grantEmployerWalletCredit(employerId: string, amount: number, remarks?: string) {
  const { data } = await apiClient.post(`/admin/employers/${employerId}/wallet-credit`, { amount, remarks });
  return data as { wallet: EmployerWallet; transaction: Record<string, unknown> };
}

export async function getMyGuardWallet() {
  const { data } = await apiClient.get('/guard/wallet');
  return data as { balance_coins: number; balance_inr: number; coin_value_inr: number };
}

export async function listMyGuardTransactions() {
  const { data } = await apiClient.get('/guard/wallet/transactions');
  return data ?? [];
}
