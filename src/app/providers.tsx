"use client";

// Around every page: keeps <html lang dir> in step with the chosen language and gives every page the toast messages,
// and the installable app's side of the service worker (shared/pwa).
//
// Two kinds of pages:
// - The sign-in page (and "not found") is drawn into the first HTML, so it shows before any script has loaded. It is
//   drawn in Arabic for someone who is not signed in; when that is wrong for a visit (English, or already signed in),
//   the start-up script holds it back (`data-hold`, shared/lib/boot.ts) until the page has drawn the right thing.
// - The signed-in pages show only after the browser has started (`BrowserOnly` in their layout): the signed-in person,
//   the language and the demo data live in the browser's storage, which the server can't read.
import { useEffect } from "react";
import { LangSync } from "@/shared/lib/lang-sync";
import { PwaSupport } from "@/shared/pwa";
import { ToastProvider } from "@/shared/ui";

export function Providers({ children }: { children: React.ReactNode }) {
  // The page that is drawn shows itself (useReleaseHold in shared/lib/started.tsx). Should it never get there (an error
  // page, say), nothing stays hidden for long.
  useEffect(() => {
    const late = setTimeout(() => document.documentElement.removeAttribute("data-hold"), 4000);
    return () => clearTimeout(late);
  }, []);

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
