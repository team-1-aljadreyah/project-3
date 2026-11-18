import { Outlet, ScrollRestoration } from "react-router";
import { LangSync } from "@/shared/lib/lang-sync";
import { ToastProvider } from "@/shared/ui";

/**
 * Around every page: keeps <html lang dir> in step with the chosen language, gives every page the toast messages,
 * and scrolls to the top on a new page (or back to where you were with the back button).
 * <Outlet /> is where the matched page appears.
 */
export function RootLayout() {
  return (
    <>
      <LangSync />
      <ToastProvider>
        <Outlet />
      </ToastProvider>
      <ScrollRestoration />
    </>
  );
}
