"use client";

// Around every page, in the browser: keeps <html lang dir> in step with the chosen language and gives every page the
// toast messages.
//
// The pages show only after the browser has started. The signed-in person, the language and the demo data live in the
// browser's storage, which the server can't read: drawing on the server would show the wrong language or the login
// page for a moment. Until then the screen stays empty (the start-up script has already set the right colours).
import { useSyncExternalStore } from "react";
import { LangSync } from "@/shared/lib/lang-sync";
import { ToastProvider } from "@/shared/ui";

const noop = () => () => {};

/** false on the server and while React takes over the server's HTML; true from then on. */
function useStarted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  if (!useStarted()) return null;
  return (
    <>
      <LangSync />
      <ToastProvider>{children}</ToastProvider>
    </>
  );
}
