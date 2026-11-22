// This device's alert settings for the signed-in person (sound, system notifications, chat alerts), kept in this
// browser: a phone and a computer may want different ones. The invitation card's "Later" is kept here too.
import { useSyncExternalStore } from "react";
import { DEFAULT_DEVICE_PREFS, parseDevicePrefs, type DevicePrefs } from "./alerts";

const key = (userId: number) => `p3.alerts.${userId}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; prefs: DevicePrefs }>();

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("p3.alerts")) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function readDevicePrefs(userId: number): DevicePrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(userId));
  } catch {}
  // The same object while nothing changed (useSyncExternalStore needs it).
  const hit = cache.get(key(userId));
  if (hit && hit.raw === raw) return hit.prefs;
  const prefs = parseDevicePrefs(raw);
  cache.set(key(userId), { raw, prefs });
  return prefs;
}

export function saveDevicePrefs(userId: number, change: Partial<DevicePrefs>) {
  try {
    localStorage.setItem(key(userId), JSON.stringify({ ...readDevicePrefs(userId), ...change }));
  } catch {}
  listeners.forEach((l) => l());
}

export function useDevicePrefs(userId: number): DevicePrefs {
  return useSyncExternalStore(
    subscribe,
    () => readDevicePrefs(userId),
    () => DEFAULT_DEVICE_PREFS,
  );
}

// "Later" on the invitation card: it comes back after a few days.
const laterKey = (userId: number) => `p3.alerts-later.${userId}`;
const LATER_MS = 5 * 24 * 60 * 60 * 1000;

export function invitedRecently(userId: number) {
  try {
    return Date.now() - Number(localStorage.getItem(laterKey(userId)) ?? 0) < LATER_MS;
  } catch {
    return true;
  }
}

export function inviteLater(userId: number) {
  try {
    localStorage.setItem(laterKey(userId), String(Date.now()));
  } catch {}
  listeners.forEach((l) => l());
}

export function useInvitedRecently(userId: number) {
  return useSyncExternalStore(
    subscribe,
    () => invitedRecently(userId),
    () => true,
  );
}
