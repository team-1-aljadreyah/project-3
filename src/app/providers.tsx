"use client";

// Around every page: keeps <html lang dir> in step with the chosen language and gives every page the toast messages,
// and the installable app's side of the service worker (shared/pwa).
//
// Two kinds of pages:
// - The sign-in page (and "not found") is drawn into the first HTML, so it shows before any script has loaded. It is
//   drawn in Arabic for someone who is not signed in; when that is wrong for a visit (English, or already signed in),
//   the start-up script holds it back (`data-hold`, shared/lib/boot.ts) and it is shown from here once the app has
//   drawn the right thing.
// - The signed-in pages show only after the browser has started (`BrowserOnly` in their layout): the signed-in person,
//   the language and the demo data live in the browser's storage, which the server can't read.
import { useEffect } from "react";
import { LangSync } from "@/shared/lib/lang-sync";
import { useStarted } from "@/shared/lib/started";
import { PwaSupport } from "@/shared/pwa";
import { ToastProvider } from "@/shared/ui";

export function Providers({ children }: { children: React.ReactNode }) {
  const started = useStarted();
  // The app has started and drawn the page for this visit (the right language, the right person): show it.
  useEffect(() => {
    if (started) document.documentElement.removeAttribute("data-hold");
  }, [started]);

  return (
    <>
      <LangSync />
      <ToastProvider>
        {children}
        <PwaSupport />
      </ToastProvider>
    </>
  );
}
