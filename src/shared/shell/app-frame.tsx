import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { TopNav } from "./top-nav";

/** The frame around every signed-in page: a "skip to content" link for keyboards, the top bar, and the page. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const { tr } = useFmt();
  const user = useUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
        {tr("تخطَّ إلى المحتوى", "Skip to content")}
      </a>
      <TopNav user={user} />
      <main id="main" className="flex min-h-0 flex-1 flex-col px-3 pt-5 pb-8 sm:px-7">
        {children}
      </main>
    </div>
  );
}
