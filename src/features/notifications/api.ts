// Notifications: the signed-in person's list, marking them read, and their preferences. Pages call
// `notificationsApi`; the .env switch decides if it is the real server or the demo backend (./mock.ts).
import { http, lazyApi } from "@/shared/api";
import type { PushSubscriptionInput } from "@/shared/pwa";
import type { Notification, NotificationPrefs } from "./types";

export interface NotificationsApi {
  /** The signed-in person's notifications, newest first (the latest 100). */
  notifications(): Promise<Notification[]>;
  markRead(id: number): Promise<void>;
  markAllRead(): Promise<void>;
  prefs(): Promise<NotificationPrefs>;
  savePrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>;
  /** This device may get push notifications while the app is closed (docs/backend.md, "Push notifications"). */
  addPushSubscription(sub: PushSubscriptionInput): Promise<void>;
  /** This device stops getting them (its push address). */
  removePushSubscription(endpoint: string): Promise<void>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const notificationsHttp: NotificationsApi = {
  notifications: () => data(http.get<Notification[]>("/notifications")),
  markRead: (id) => data(http.post<void>(`/notifications/${id}/read`)),
  markAllRead: () => data(http.post<void>("/notifications/read-all")),
  prefs: () => data(http.get<NotificationPrefs>("/notifications/preferences")),
  savePrefs: (prefs) => data(http.put<NotificationPrefs>("/notifications/preferences", prefs)),
  addPushSubscription: (sub) => data(http.post<void>("/me/push-subscriptions", sub)),
  removePushSubscription: (endpoint) => data(http.delete<void>("/me/push-subscriptions", { data: { endpoint } })),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const notificationsApi: NotificationsApi =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.notificationsMock)) : notificationsHttp;
