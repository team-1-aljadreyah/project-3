import { useEffect, useSyncExternalStore } from "react";

const noop = () => () => {};

/** false on the server and while React takes over the server's HTML; true from then on. */
export function useStarted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * Shows a page the start-up script held back (`data-hold`, shared/lib/boot.ts) once it is drawn right for this visit:
 * call it in the page that is drawn (the sign-in page, the signed-in frame). It runs after this part has taken over the
 * first HTML and redrawn with the browser's values (the language, the person), never before.
 */
export function useReleaseHold() {
  const started = useStarted();
  useEffect(() => {
    if (started) document.documentElement.removeAttribute("data-hold");
  }, [started]);
}

/**
 * Draws its children only in the browser, once the app has started. For everything that needs the browser's storage to
 * be drawn right (the signed-in person, their language, the demo data): on the server, and for the moment React takes
 * over the first HTML, those are unknown, and drawing with a guess would show the wrong thing for a moment (or send a
 * signed-in person to the sign-in page). Until then there is nothing: the start-up script has already set the colours.
 */
export function BrowserOnly({ children }: { children: React.ReactNode }) {
  useReleaseHold();
  return useStarted() ? children : null;
}
