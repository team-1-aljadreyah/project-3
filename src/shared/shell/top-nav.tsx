import { Link, useLocation } from "react-router";
import { activeNavKey, navFor } from "@/shared/lib/access";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { AccountMenu } from "./account-menu";
import { Logo } from "./logo";

/**
 * The floating top bar from board D: the logo, the pages as pill tabs, and the account.
 * On a phone the tabs move to a second row that scrolls sideways. The nav is `relative` so the hidden
 * "(coming soon)" labels for screen readers stay inside it; without it they stretched the phone page sideways.
 */
export function TopNav({ user }: { user: User }) {
  const { tr } = useFmt();
  const path = useLocation().pathname;
  const active = activeNavKey(path);

  return (
    <header className="sticky top-3 z-30 mx-3 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-line bg-card px-2.5 py-2 shadow-card sm:mx-7">
      <Logo />
      <nav aria-label={tr("القائمة الرئيسية", "Main menu")} className="relative order-last -mx-1 w-full overflow-x-auto [scrollbar-width:none] lg:order-none lg:mx-0 lg:w-auto">
        <ul className="flex items-center gap-0.5 px-1">
          {navFor(user.role).map((item) => {
            const label = tr(item.ar, item.en);
            if (!item.ready) {
              return (
                <li key={item.key}>
                  <span
                    aria-disabled="true"
                    title={tr("قريباً", "Coming soon")}
                    className="flex h-[38px] items-center rounded-full px-3 text-sm whitespace-nowrap text-faint opacity-60"
                  >
                    {label}
                    <span className="sr-only"> ({tr("قريباً", "coming soon")})</span>
                  </span>
                </li>
              );
            }
            const isActive = item.key === active;
            return (
              <li key={item.key}>
                <Link
                  to={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-[38px] items-center rounded-full px-3.5 text-sm whitespace-nowrap transition-colors",
                    isActive ? "bg-accent-soft font-semibold text-accent-ink" : "text-muted hover:bg-chip hover:text-text",
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <AccountMenu user={user} />
    </header>
  );
}
