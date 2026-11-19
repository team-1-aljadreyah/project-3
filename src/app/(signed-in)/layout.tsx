"use client";

// Every signed-in page: only for signed-in people, inside the top bar. The folder name in brackets is a route group:
// it adds no part to the address. The bell comes from the notifications feature; app/ is the one place that may put
// features together.
import { RequireAuth } from "@/features/auth";
import { NotificationBell } from "@/features/notifications";
import { AppFrame } from "@/shared/shell";

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppFrame actions={<NotificationBell />}>{children}</AppFrame>
    </RequireAuth>
  );
}
