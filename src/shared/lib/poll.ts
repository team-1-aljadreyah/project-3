// Asking the server again on a timer, for the screens that must show other people's changes while they are open (a
// chat). Only while the tab is shown: a hidden tab asks nothing, and it asks at once when it is shown again or the window
// gets the focus back. The server's live updates (a WebSocket, docs/backend.md section 11) will replace this later; the
// changes saved in this browser already arrive at once through live.ts.
import { useEffect, useRef } from "react";

export function usePoll(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const run = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const timer = setInterval(run, ms);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [ms, enabled]);
}
