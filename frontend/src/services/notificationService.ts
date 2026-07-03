import { apiClient } from '../lib/apiClient';

export async function listMyNotifications() {
  const { data } = await apiClient.get('/me/notifications');
  return data;
}

export async function markNotificationRead(notificationId: string) {
  const { data } = await apiClient.patch(`/me/notifications/${notificationId}/read`);
  return data;
}
