import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/shared/api";
import { clearSession, onSignOut, updateSessionUser, useSession } from "@/shared/lib/session";
import { authApi } from "../api";

/**
 * Lets only signed-in people through. No session → the login page (it comes back here after signing in).
 * A saved session is checked once with the server: a stopped account or an expired token signs out.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  const signedIn = !!session;

  // Signing out (the account menu) first tells the server to cancel the token.
  useEffect(() => onSignOut(() => authApi.logout()), []);

  useEffect(() => {
    if (!signedIn) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [signedIn, path, router]);

  useEffect(() => {
    if (!signedIn) return;
    // The server's copy is the fresh one (a new name, or a picture the admin removed): the top bar shows it.
    authApi.me().then(updateSessionUser, (e) => {
      if (e instanceof ApiError && e.status === 401) clearSession();
    });
  }, [signedIn]);

  // On the way to the login page: nothing to show.
  if (!signedIn) return null;
  return children;
}
