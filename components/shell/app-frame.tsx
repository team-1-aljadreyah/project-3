"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { clearSession, useSession } from "@/lib/auth";
import { useFmt } from "@/lib/i18n";
import { TopNav } from "./top-nav";

/**
 * The frame around every signed-in page. No session → the login page (it comes back here after signing in).
 * A saved session is checked once with the server: a stopped account or an expired token signs out.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const { tr } = useFmt();
  const router = useRouter();
  const path = usePathname();
  const signedIn = !!session;

  useEffect(() => {
    if (session === null) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [session, path, router]);

  useEffect(() => {
    if (!signedIn) return;
    api.me().catch((e) => {
      if (e instanceof ApiError && e.status === 401) clearSession();
    });
  }, [signedIn]);

  // Still reading the browser (undefined), or on the way to the login page (null): nothing to show yet.
  if (!session) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
        {tr("تخطَّ إلى المحتوى", "Skip to content")}
      </a>
      <TopNav user={session.user} />
      <main id="main" className="flex min-h-0 flex-1 flex-col px-3 pt-5 pb-8 sm:px-7">
        {children}
      </main>
    </div>
  );
}
