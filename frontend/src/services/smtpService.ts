import { apiClient } from '../lib/apiClient';

export type SmtpTestReport = {
  configured: boolean;
  to: string;
  subject: string;
  messageId?: string;
  response?: string;
  accepted?: string[];
  rejected?: string[];
  pending?: string[];
  envelope?: {
    from?: string;
    to?: string[];
  };
  error?: string;
  provider?: {
    host: string;
    port: number;
    secure: boolean;
    fromEmail: string;
    fromName: string;
  };
};

export async function sendSmtpTestEmail(email: string): Promise<{ ok: boolean; message: string; report: SmtpTestReport }> {
  const { data } = await apiClient.post('/auth/test-email', { email: email.trim().toLowerCase() });
  return data as { ok: boolean; message: string; report: SmtpTestReport };
}
