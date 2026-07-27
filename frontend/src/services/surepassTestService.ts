import { apiClient } from '../lib/apiClient';

export type SurepassMockResult = {
  provider: 'surepass';
  environment: 'sandbox';
  request: {
    endpoint: string;
    redirect_url: string;
  };
  response: {
    data: {
      client_id: string;
      token: string;
      url: string;
      expiry_seconds: number;
    };
    status_code: number;
    message_code: string;
    message: string;
    success: boolean;
  };
};

export async function createSurepassMockSession(): Promise<SurepassMockResult> {
  const { data } = await apiClient.post('/guard/aadhaar/mock-session');
  return data as SurepassMockResult;
}
