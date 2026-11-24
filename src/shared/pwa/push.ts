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

/** Why this device has no push address: the browser can't, the person didn't allow it, the app's worker isn't there
 * yet, or the browser's push service said no (the browser's own words in `detail`). */
export type PushProblem = "unsupported" | "not-allowed" | "no-worker" | "refused";

/** True when both are the same key (an old subscription keeps the key it was made with). */
export function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a || a.byteLength !== b.length) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
}

const wait = (ms: number) => new Promise<undefined>((done) => setTimeout(() => done(undefined), ms));

/** This device's subscription (made now if there is none), or why there is none. A subscription made with another key
 * (the backend made a new key pair) is dropped and made again: the push service refuses pushes signed with the new key. */
export async function subscribePush(): Promise<PushSubscriptionInput | { problem: PushProblem; detail?: string }> {
  if (!pushAvailable()) return { problem: "unsupported" };
  if (Notification.permission !== "granted") return { problem: "not-allowed" };
  const key = keyBytes(PUSH_PUBLIC_KEY);
  try {
    // Just after the first load the worker may still be installing: wait for it a little.
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await Promise.race([navigator.serviceWorker.ready, wait(8000)]));
    if (!reg) return { problem: "no-worker" };
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
      await sub.unsubscribe();
      sub = null;
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return { problem: "refused", detail: "no keys" };
    return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, device: deviceName() };
  } catch (e) {
    return { problem: "refused", detail: e instanceof Error ? e.message : String(e) };
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
