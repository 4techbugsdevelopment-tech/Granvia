import { apiClient } from '../lib/apiClient';

export async function listMyNotifications() {
  const { data } = await apiClient.get('/me/notifications');
  return data;
}

export async function markNotificationRead(notificationId: string) {
  const { data } = await apiClient.patch(`/me/notifications/${notificationId}/read`);
  return data;
}

export type HiringDocument = 'offer-letter' | 'employment-agreement';

export async function downloadHiringDocument(document: HiringDocument): Promise<void> {
  const { data } = await apiClient.get(`/me/documents/${document}`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = document === 'offer-letter' ? 'Offer letter.pdf' : 'Employment Agreement.docx';
  anchor.click();
  URL.revokeObjectURL(url);
}
