import { Outlet } from "react-router";
import { RequireAuth } from "@/features/auth";
import { AppFrame } from "@/shared/shell";

/** Every signed-in page: only for signed-in people, inside the top bar. <Outlet /> is the page itself. */
export function SignedInLayout() {
  return (
    <RequireAuth>
      <AppFrame>
        <Outlet />
      </AppFrame>
    </RequireAuth>
  );
}
