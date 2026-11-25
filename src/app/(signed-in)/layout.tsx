"use client";

// Every signed-in page: only for signed-in people, inside the top bar. The folder name in brackets is a route group:
// it adds no part to the address. The quick search (Ctrl+K) and the bell come from their features, the profile window
// (the account menu's "My profile" and picture) from the profile feature, and the CEO's site-wide switches (features,
// banner, read-only mode) are loaded by the advanced feature; app/ is the one place that may put features together.
// Pages may read their tab or filter from the address (useQueryParam, useSearchParams), which Next.js wants inside
// <Suspense> for the plain-files build. LiveAlerts rings and shows a system notification when something new arrives;
// LiveCelebrations shows, once, a team celebrated by the monitoring officer and the birthday moments;
// above the page, once, the invitations to turn alerts on and (on a phone) to install the app. LiveSocket keeps the
// server's live updates open when the build has a WebSocket address (docs/backend.md section 25).
// BrowserOnly: nothing here is drawn on the server or with guessed values (the person, the language and the demo data
// are in the browser's storage), so a signed-in person never sees the sign-in page or the wrong language for a moment.
import { Suspense } from "react";
import { SiteRules } from "@/features/advanced";
import { RequireAuth } from "@/features/auth";
import { CelebrationsSwitch, LiveCelebrations } from "@/features/celebrations";
import { AlertsInvite, AlertsSwitch, LiveAlerts, NotificationBell } from "@/features/notifications";
import { ProfileDialog } from "@/features/profile";
import { QuickSearch } from "@/features/search";
import { LiveSocket } from "@/shared/lib/socket";
import { BrowserOnly } from "@/shared/lib/started";
import { InstallHint } from "@/shared/pwa";
import { AppFrame } from "@/shared/shell";

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrowserOnly>
      <RequireAuth>
        <LiveSocket />
        <SiteRules />
        <LiveAlerts />
        <LiveCelebrations />
        <AppFrame
          actions={
            <>
              <QuickSearch />
              <NotificationBell />
            </>
          }
          profile={(o) => <ProfileDialog {...o} />}
          switches={
            <>
              <AlertsSwitch />
              <CelebrationsSwitch />
            </>
          }
        >
          <InstallHint />
          <AlertsInvite />
          <Suspense>{children}</Suspense>
        </AppFrame>
      </RequireAuth>
    </BrowserOnly>
  );
}
