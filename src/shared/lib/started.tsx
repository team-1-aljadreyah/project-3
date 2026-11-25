import { useSyncExternalStore } from "react";

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
 * Draws its children only in the browser, once the app has started. For everything that needs the browser's storage to
 * be drawn right (the signed-in person, their language, the demo data): on the server, and for the moment React takes
 * over the first HTML, those are unknown, and drawing with a guess would show the wrong thing for a moment (or send a
 * signed-in person to the sign-in page). Until then there is nothing: the start-up script has already set the colours.
 */
export function BrowserOnly({ children }: { children: React.ReactNode }) {
  return useStarted() ? children : null;
}
