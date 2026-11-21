import { usePathname } from "next/navigation";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { TopNav } from "./top-nav";
import { WelcomeSplash } from "./welcome-splash";

/**
 * The frame around every signed-in page: the welcome splash (once each time the app opens), a "skip to content" link
 * for keyboards, the top bar, and the page.
 * `actions` are extra buttons for the top bar (the notifications bell). `app/` passes them in, so this shared
 * frame never imports a feature.
 */
export function AppFrame({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  const { tr } = useFmt();
  const user = useUser();
  // Each part of the site (projects, chat, bugs…) settles in when you move to it. The key is the first part of the
  // address only, so moving inside a part (one chat to another) keeps what is on screen instead of drawing it again.
  const part = usePathname().split("/")[1] ?? "";

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
        {tr("تخطَّ إلى المحتوى", "Skip to content")}
      </a>
      <WelcomeSplash />
      <TopNav user={user} actions={actions} />
      <main id="main" className="flex min-h-0 flex-1 flex-col px-3 pt-5 pb-8 sm:px-7">
        <div key={part} className="settle flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
