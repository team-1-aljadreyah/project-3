"use client";

// Every signed-in page: only for signed-in people, inside the top bar. The folder name in brackets is a route group:
// it adds no part to the address. The quick search (Ctrl+K) and the bell come from their features, the profile window
// (the account menu's "My profile" and picture) from the profile feature, and the CEO's site-wide switches (features,
// banner, read-only mode) are loaded by the advanced feature; app/ is the one place that may put features together.
// Pages may read their tab or filter from the address (useQueryParam, useSearchParams), which Next.js wants inside
// <Suspense> for the plain-files build. LiveAlerts rings and shows a system notification when something new arrives;
// above the page, once, the invitations to turn alerts on and (on a phone) to install the app.
import { Suspense } from "react";
import { SiteRules } from "@/features/advanced";
import { RequireAuth } from "@/features/auth";
import { AlertsInvite, LiveAlerts, NotificationBell } from "@/features/notifications";
import { ProfileDialog } from "@/features/profile";
import { QuickSearch } from "@/features/search";
import { InstallHint } from "@/shared/pwa";
import { AppFrame } from "@/shared/shell";

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SiteRules />
      <LiveAlerts />
      <AppFrame
        actions={
          <>
            <QuickSearch />
            <NotificationBell />
          </>
        }
        profile={(o) => <ProfileDialog {...o} />}
      >
        <InstallHint />
        <AlertsInvite />
        <Suspense>{children}</Suspense>
      </AppFrame>
    </RequireAuth>
  );
}
