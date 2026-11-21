// The signed-in person, saved in the browser so a refresh keeps you signed in (every tab shares it).
import { useSyncExternalStore } from "react";
import type { Session, User } from "../api/types";

const KEY = "p3.session";
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;

function read(): Session | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  // useSyncExternalStore needs the same object back while nothing changed.
  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;
  try {
    cachedSession = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
}

const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  // Signing in or out in another tab updates this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function getToken(): string | null {
  return read()?.token ?? null;
}

export function setSession(session: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {}
  emit();
}

/**
 * The signed-in person changed (a new picture, or the server's fresher copy from /me): keep the token, swap the person.
 * Every screen that shows them (the top bar) redraws at once. Nothing happens when nothing changed.
 */
export function updateSessionUser(user: User) {
  const session = read();
  if (!session || session.user.id !== user.id) return;
  if (JSON.stringify(session.user) === JSON.stringify(user)) return;
  setSession({ ...session, user });
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  emit();
}

/** The session, or `null` when nobody is signed in. The page redraws when it changes (in this tab or another). */
export function useSession(): Session | null {
  // On the server nobody is signed in yet: the page waits for the browser (see src/app/providers.tsx).
  return useSyncExternalStore(subscribe, read, () => null);
}

/** The signed-in person, inside the signed-in pages (RequireAuth shows them only with a session). */
export function useUser() {
  const session = useSession();
  if (!session) throw new Error("useUser is for signed-in pages only (inside RequireAuth).");
  return session.user;
}
