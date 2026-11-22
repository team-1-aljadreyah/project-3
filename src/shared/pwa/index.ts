// The installable app (PWA) and system notifications: the service worker's app side, installing on phones and
// tablets, sounds, system notifications and Web Push. public/sw.js is the worker itself; app/manifest.ts the manifest.
export { PwaSupport } from "./service-worker";
export { InstallMenuItem } from "./install-menu-item";
export { InstallHint } from "./install-hint";
export { useInstallWay, installApp, type InstallWay } from "./install";
export { isStandalone } from "./detect";
export { playChime, type ChimeKind } from "./sound";
export { askNotificationPermission, notificationPermission, showSystemNotification, useNotificationPermission, type Permission, type SystemNotice } from "./system-notify";
export { pushAvailable, subscribePush, unsubscribePush, type PushSubscriptionInput } from "./push";
export { claimAlerts } from "./claim";
