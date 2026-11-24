// Asking the server again on a timer, for the screens that must show other people's changes while they are open (a
// chat). Only while the tab is shown: a hidden tab asks nothing, and it asks at once when it is shown again or the window
// gets the focus back. While the server's socket is open (socket.ts, docs/backend.md section 25) the server says when
// something changed, so the timer only runs once a minute, as a safety net; it goes back to `ms` when the socket drops.
// The changes saved in this browser arrive at once through live.ts either way.
import { useEffect, useRef } from "react";
import { useSocketUp } from "./socket";

/** How often a timer runs while the socket is open. */
export const SOCKET_POLL_MS = 60_000;

export function usePoll(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  const every = useSocketUp() ? Math.max(ms, SOCKET_POLL_MS) : ms;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const run = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const timer = setInterval(run, every);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [every, enabled]);
}
