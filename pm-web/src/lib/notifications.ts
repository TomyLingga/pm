import type { ApiEnvelope, Paginated } from "@/types/api";
import type { NotificationPreferences } from "@/types/dashboard";
import type { AppNotification } from "@/types/notification";
import { api, unwrap } from "./api";

export function getNotifications(
  params: { page?: number; unread?: boolean } = {},
  signal?: AbortSignal,
): Promise<Paginated<AppNotification>> {
  return api.get<Paginated<AppNotification>>(
    "/notifications",
    { page: params.page ?? 1, unread: params.unread ? 1 : undefined },
    { signal },
  );
}

export async function getUnreadCount(signal?: AbortSignal): Promise<number> {
  const res = await api.get<ApiEnvelope<{ count: number }>>("/notifications/unread-count", undefined, { signal });
  return res?.data?.count ?? 0;
}

export function markNotificationRead(id: AppNotification["id"]): Promise<void> {
  return api.post<void>(`/notifications/${id}/read`);
}

export function markAllNotificationsRead(): Promise<void> {
  return api.post<void>("/notifications/read-all");
}

/* ---------- Preferences ---------- */

export function getNotificationPreferences(signal?: AbortSignal): Promise<NotificationPreferences> {
  return unwrap(api.get<ApiEnvelope<NotificationPreferences>>("/notifications/preferences", undefined, { signal }));
}

export function updateNotificationPreferences(email: boolean): Promise<NotificationPreferences> {
  return unwrap(api.put<ApiEnvelope<NotificationPreferences>>("/notifications/preferences", { email }));
}
