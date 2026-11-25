// The signed-in person, saved in the browser so a refresh keeps you signed in (every tab shares it).
//
// The demo (no server) also keeps a copy per tab, so two tabs can be two people (sign in as Huda in one and as Sara in
// another, and watch a message arrive live in the other tab). A new tab starts as the person who signed in last. With a
// real server every tab is the same person, as before.
import { useSyncExternalStore } from "react";
import type { Session, User } from "../api/types";
import { SESSION_KEY as KEY } from "./boot";
import { USE_MOCK } from "./config";

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;

/** This tab's own copy (the demo only); null when there is none or the browser refuses. */
function tabStore(): Storage | null {
  if (!USE_MOCK) return null;
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function read(): Session | null {
  let raw: string | null = null;
  try {
    const tab = tabStore();
    raw = tab?.getItem(KEY) ?? null;
    if (raw === null) {
      raw = localStorage.getItem(KEY);
      // The demo: this tab keeps the person it opened as, even when another tab signs in as someone else.
      if (raw !== null) tab?.setItem(KEY, raw);
    }
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
  const raw = JSON.stringify(session);
  try {
    tabStore()?.setItem(KEY, raw);
    localStorage.setItem(KEY, raw);
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
    tabStore()?.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {}
  emit();
}

/** What signing out tells the server (the auth feature registers it: POST /auth/logout cancels the token). */
let tellServer: ((token: string) => Promise<unknown>) | null = null;
export function onSignOut(fn: (token: string) => Promise<unknown>) {
  tellServer = fn;
}

/**
 * Sign out: this browser forgets the token at once (nobody waits on the server), and the server is told in the
 * background to cancel that token, so a copied token stops working too. A server that is down changes nothing here.
 */
export function signOut() {
  const token = getToken();
  clearSession();
  if (token && tellServer) tellServer(token).catch(() => {});
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
