import { apiClient } from '../lib/apiClient';

export interface EmailLogRow {
  id: string;
  kind: string;
  status: 'sent' | 'skipped' | 'error' | string;
  to_email: string;
  subject: string;
  source_url?: string | null;
  request_url?: string | null;
  origin?: string | null;
  referer?: string | null;
  environment?: string | null;
  provider_host?: string | null;
  provider_port?: number | null;
  provider_secure?: boolean | null;
  from_email?: string | null;
  from_name?: string | null;
  message_id?: string | null;
  response?: string | null;
  accepted?: string | null;
  rejected?: string | null;
  pending?: string | null;
  envelope_from?: string | null;
  envelope_to?: string | null;
  error_message?: string | null;
  details?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface EmailLogSummary {
  total: number;
  sent: number;
  skipped: number;
  error: number;
}

export interface EmailLogResponse {
  summary: EmailLogSummary;
  items: EmailLogRow[];
}

export async function getEmailLogs(params?: {
  kind?: string;
  status?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}) {
  const { data } = await apiClient.get('/admin/email-logs', { params });
  return data as EmailLogResponse;
}
