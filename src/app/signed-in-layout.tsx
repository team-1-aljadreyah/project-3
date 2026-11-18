import { Outlet } from "react-router";
import { RequireAuth } from "@/features/auth";
import { NotificationBell } from "@/features/notifications";
import { AppFrame } from "@/shared/shell";

/**
 * Every signed-in page: only for signed-in people, inside the top bar. <Outlet /> is the page itself.
 * The bell comes from the notifications feature; app/ is the one place that may put features together.
 */
export function SignedInLayout() {
  return (
    <RequireAuth>
      <AppFrame actions={<NotificationBell />}>
        <Outlet />
      </AppFrame>
    </RequireAuth>
  );
}
