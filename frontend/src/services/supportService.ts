import { apiClient } from '../lib/apiClient';

export async function listMySupportTickets() {
  const { data } = await apiClient.get('/me/support-tickets');
  return (data ?? []).map((ticket: any) => {
    const { messages, ...rest } = ticket;
    return { ...rest, support_ticket_messages: messages ?? [] };
  });
}

export async function createSupportTicket(input: {
  company_id?: string;
  subject: string;
  category?: string;
  priority?: string;
  message: string;
}) {
  const { data } = await apiClient.post('/me/support-tickets', input);
  return data;
}
