import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { ApiError } from "@/shared/api";
import { clearSession, useSession } from "@/shared/lib/session";
import { authApi } from "../api";

/**
 * Lets only signed-in people through. No session → the login page (it comes back here after signing in).
 * A saved session is checked once with the server: a stopped account or an expired token signs out.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const signedIn = !!session;

  useEffect(() => {
    if (!signedIn) navigate(`/login?next=${encodeURIComponent(path)}`, { replace: true });
  }, [signedIn, path, navigate]);

  useEffect(() => {
    if (!signedIn) return;
    authApi.me().catch((e) => {
      if (e instanceof ApiError && e.status === 401) clearSession();
    });
  }, [signedIn]);

  // On the way to the login page: nothing to show.
  if (!signedIn) return null;
  return children;
}
