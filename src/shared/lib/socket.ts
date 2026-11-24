// Live updates from the server (docs/backend.md section 25): one WebSocket per tab while someone is signed in, when the
// build has NEXT_PUBLIC_WS_URL (the Go service). The server's messages carry no content, only "this changed"; the site
// then loads it with the normal calls, so every "who may see what" rule stays in one place. Without the address (the
// demo, or before the server has it) nothing here runs and the screens ask again on their timers (poll.ts), as before.
//
// - First message after connecting: {"type":"auth","token":"…"} (a token in the address would end up in server logs).
// - Each event refreshes the open screens (live.ts), so the bell, the chats and the open chat show it at once.
// - The connection drops (network, server restart): try again after 1 s, 2 s, 4 s … up to 30 s, and at once when the
//   network or the tab comes back. Once back, the screens load again: what changed meanwhile was not announced.
// - Closed with code 4401 (the token is no good): sign out, like a 401 from the API.
import { useEffect, useSyncExternalStore } from "react";
import { serverChanged } from "./live";
import { clearSession, useSession } from "./session";

/** The socket's address, or "" when it is missing or isn't ws:// or wss://. */
export function cleanSocketUrl(raw: string | undefined) {
  const url = (raw ?? "").trim();
  return /^wss?:\/\/[^/]/i.test(url) ? url : "";
}

export const SOCKET_URL = cleanSocketUrl(process.env.NEXT_PUBLIC_WS_URL);

/** What the server may send (section 25). Ids are for the future; today any event reloads the open screens. */
export type SocketEvent =
  | { type: "notification"; id?: number }
  | { type: "chat_message"; chat: string; id?: number }
  | { type: "chat_read"; chat: string }
  | { type: "chat_changed"; chat: string }
  | { type: "celebration"; id?: number }
  | { type: "site_live" };

export const SOCKET_EVENTS: readonly SocketEvent["type"][] = ["notification", "chat_message", "chat_read", "chat_changed", "celebration", "site_live"];

/** The close code meaning "this token is no good". */
export const SOCKET_UNAUTHORIZED = 4401;
/** A connection open this long counts as working: the next drop starts the waits from 1 s again. */
const STEADY_MS = 10_000;

/** A message from the server, or null for anything else (unknown types are ignored, so the server can add new ones). */
export function parseEvent(raw: unknown): SocketEvent | null {
  if (typeof raw !== "string") return null;
  try {
    const v = JSON.parse(raw) as { type?: unknown } | null;
    return v && typeof v === "object" && SOCKET_EVENTS.includes(v.type as SocketEvent["type"]) ? (v as SocketEvent) : null;
  } catch {
    return null;
  }
}

/** The wait before trying again: 1 s, 2 s, 4 s … at most 30 s, give or take a fifth, so every open tab doesn't come
 * back at the same moment after a server restart. */
export function retryDelay(attempt: number, random = Math.random) {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.8 + random() * 0.4));
}

// Whether a socket is open now (poll.ts asks less often while it is).
let up = false;
const upListeners = new Set<() => void>();
function setUp(next: boolean) {
  if (up === next) return;
  up = next;
  upListeners.forEach((l) => l());
}

/** True while the server's socket is open in this tab. */
export function useSocketUp() {
  return useSyncExternalStore(
    (l) => (upListeners.add(l), () => void upListeners.delete(l)),
    () => up,
    () => false,
  );
}

const eventListeners = new Set<(event: SocketEvent) => void>();

/** Hear each event from the server (for a screen that wants more than the general refresh). Returns "stop". */
export function onSocketEvent(fn: (event: SocketEvent) => void) {
  eventListeners.add(fn);
  return () => void eventListeners.delete(fn);
}

/** Opens the socket for this token and keeps it open. Returns a function that closes it for good (signing out). */
export function connectSocket(url: string, token: string): () => void {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let openedAt = 0;
  let wasOpen = false;
  let stopped = false;

  const retry = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(open, retryDelay(attempt++));
  };

  function open() {
    if (stopped || ws) return;
    clearTimeout(timer);
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      retry();
      return;
    }
    ws = socket;
    socket.onopen = () => {
      openedAt = Date.now();
      socket.send(JSON.stringify({ type: "auth", token }));
      setUp(true);
      // Back after a cut: what changed meanwhile was not announced, so the open screens load again.
      if (wasOpen) serverChanged();
      wasOpen = true;
    };
    socket.onmessage = (m: MessageEvent) => {
      const event = parseEvent(m.data);
      if (!event) return;
      eventListeners.forEach((l) => {
        try {
          l(event);
        } catch {}
      });
      serverChanged();
    };
    socket.onclose = (e: CloseEvent) => {
      if (ws === socket) ws = null;
      setUp(false);
      if (stopped) return;
      if (e.code === SOCKET_UNAUTHORIZED) {
        stopped = true;
        clearSession();
        return;
      }
      if (openedAt && Date.now() - openedAt >= STEADY_MS) attempt = 0;
      openedAt = 0;
      retry();
    };
  }

  // The network or the tab is back: don't wait for the timer.
  const now = () => {
    if (stopped || ws || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
    attempt = 0;
    open();
  };
  window.addEventListener("online", now);
  document.addEventListener("visibilitychange", now);
  open();

  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("online", now);
    document.removeEventListener("visibilitychange", now);
    if (ws) {
      ws.onclose = null;
      ws.close(1000);
      ws = null;
    }
    setUp(false);
  };
}

/** Keeps this tab's socket open while someone is signed in (a new token: a new socket). Draws nothing. */
export function LiveSocket() {
  const token = useSession()?.token;
  useEffect(() => {
    if (!SOCKET_URL || !token) return;
    return connectSocket(SOCKET_URL, token);
  }, [token]);
  return null;
}
