// System notifications (the phone's or computer's own, like WhatsApp's): the browser's permission, asking for it only
// when the person presses a button, and showing one. Through the service worker when it runs (the only way on Android,
// and a click there reaches the app even from the background), else with `new Notification`.
import { useSyncExternalStore } from "react";

export type Permission = NotificationPermission | "unsupported";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let watching = false;

function subscribe(l: () => void) {
  listeners.add(l);
  // The person may allow or block it in the browser's settings while the page is open.
  if (!watching && typeof navigator !== "undefined" && navigator.permissions?.query) {
    watching = true;
    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((status) => status.addEventListener("change", emit))
      .catch(() => {});
  }
  return () => {
    listeners.delete(l);
  };
}

export function notificationPermission(): Permission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

/** The browser's answer: "default" (not asked yet), "granted", "denied", or "unsupported". */
export function useNotificationPermission(): Permission {
  return useSyncExternalStore(subscribe, notificationPermission, () => "unsupported");
}

/** Asks the browser (call it from a button press only: browsers refuse a question that comes by itself). */
export async function askNotificationPermission(): Promise<Permission> {
  if (notificationPermission() === "unsupported") return "unsupported";
  try {
    await Notification.requestPermission();
  } catch {}
  emit();
  return notificationPermission();
}

/** Where a click on a notification goes: the app sets it to its router (src/shared/pwa/service-worker.tsx). */
let openPage = (url: string) => window.location.assign(url);
export function setNotificationOpener(fn: (url: string) => void) {
  openPage = fn;
}
export const openFromNotification = (url: string) => openPage(url);

export interface SystemNotice {
  title: string;
  body: string;
  /** The sender's picture, else the app's icon. */
  icon?: string;
  /** One per subject: a new one with the same tag replaces the old (a busy chat shows one, not twenty). */
  tag: string;
  /** The page a click opens. */
  url: string;
  /** No sound from the system (the app played its own chime, or the person turned sound off). */
  silent: boolean;
  lang: "ar" | "en";
}

/** Shows a system notification. False when it isn't allowed or the browser can't. */
export async function showSystemNotification(n: SystemNotice): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const options: NotificationOptions & { renotify?: boolean } = {
    body: n.body,
    icon: n.icon ?? "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: n.tag,
    renotify: true,
    silent: n.silent,
    lang: n.lang,
    dir: n.lang === "ar" ? "rtl" : "ltr",
    data: { url: n.url },
  };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg?.active) {
      await reg.showNotification(n.title, options);
      return true;
    }
  } catch {}
  try {
    const shown = new Notification(n.title, options);
    shown.onclick = () => {
      window.focus();
      openFromNotification(n.url);
      shown.close();
    };
    return true;
  } catch {
    return false;
  }
}
