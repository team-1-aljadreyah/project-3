// Web Push: notifications that reach the phone while the app is closed. The browser makes a "subscription" (an address
// at Google's, Apple's or Mozilla's push service, and two keys); the backend keeps it and sends to it with its VAPID
// keys (docs/backend.md, "Push notifications"). Ready on the front end, switched on by NEXT_PUBLIC_PUSH_PUBLIC_KEY once
// the backend sends push; without it nothing here runs. The calls to the backend belong to the notifications feature.

export const PUSH_PUBLIC_KEY = process.env.NEXT_PUBLIC_PUSH_PUBLIC_KEY ?? "";

/** Push is set up (the key) and this browser can do it (iPhone: only the app added to the home screen, iOS 16.4+). */
export function pushAvailable() {
  return !!PUSH_PUBLIC_KEY && typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** The key as bytes ("base64url" text → Uint8Array), as PushManager wants it. */
export function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** What the backend keeps for this device. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** A short name of the device, so the person could tell them apart later ("Android · Chrome"). */
  device: string;
}

function deviceName() {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : "Linux";
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : "Safari";
  return `${os} · ${browser}`;
}

/** This device's subscription (made now if there is none). Null when push isn't possible or allowed. */
export async function subscribePush(): Promise<PushSubscriptionInput | null> {
  if (!pushAvailable() || Notification.permission !== "granted") return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    const sub =
      (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_PUBLIC_KEY) }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
    return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, device: deviceName() };
  } catch {
    return null;
  }
}

/** Stops push on this device. The address that was cancelled (to tell the backend), or null when there was none. */
export async function unsubscribePush(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (!sub) return null;
    await sub.unsubscribe();
    return sub.endpoint;
  } catch {
    return null;
  }
}
