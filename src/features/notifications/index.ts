// The notifications feature's front door: other parts of the app import only from here.
export { notificationsApi, type NotificationsApi } from "./api";
export { NotificationBell } from "./components/notification-bell";
export { NotificationsPage } from "./pages/notifications-page";
export { KIND_WORDS } from "./words";
export type * from "./types";
