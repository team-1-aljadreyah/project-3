import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { activeNavKey, navFor } from "@/shared/lib/access";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { hiddenNavKeys, useSiteLive } from "@/shared/lib/site";
import { cn } from "@/shared/lib/utils";
import { AccountMenu, type ProfileSlot } from "./account-menu";
import { Logo } from "./logo";

/**
 * The floating top bar from board D: the logo, the pages as pill tabs, and the account.
 * On a phone the tabs move to a second row that scrolls sideways. The nav is `relative` so the hidden
 * "(coming soon)" labels for screen readers stay inside it; without it they stretched the phone page sideways.
 */
export function TopNav({ user, actions, profile }: { user: User; actions?: React.ReactNode; profile?: ProfileSlot }) {
  const { tr } = useFmt();
  const path = usePathname();
  const active = activeNavKey(path);
  // A feature the CEO switched off leaves the menu (never the CEO's menu).
  const hidden = hiddenNavKeys(useSiteLive(), user);
  // Items that live in the account menu (the avatar) are not repeated here.
  const items = navFor(user.role).filter((item) => !hidden.includes(item.key) && !item.inAccountMenu);
  // A long menu (the CEO sees every item; the PM and monitoring have ten) is a little tighter, so it stays on one row on
  // a computer.
  const dense = items.length > 9;
  // When the menu scrolls sideways, the page you are on is brought into view.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <header className="sticky top-[calc(0.75rem+env(safe-area-inset-top))] z-30 print:hidden mx-3 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:flex-nowrap rounded-2xl border border-line bg-card px-2.5 py-2 shadow-card sm:mx-7">
      <Logo />
      <nav ref={navRef} aria-label={tr("القائمة الرئيسية", "Main menu")} className="relative order-last -mx-1 w-full overflow-x-auto [scrollbar-width:none] lg:order-none lg:mx-0 lg:w-auto lg:min-w-0 lg:flex-1">
        {/* On a computer the menu shares the row with the logo and the account; if it is still too long it scrolls
            sideways instead of pushing the account to a row of its own. */}
        <ul className="flex items-center gap-0.5 px-1 lg:mx-auto lg:w-max">
          {items.map((item) => {
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
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-[38px] items-center rounded-full whitespace-nowrap transition-colors",
                    dense ? "px-2.5 text-[13px]" : "px-3.5 text-sm",
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
      <div className="flex items-center gap-1">
        {actions}
        <AccountMenu user={user} profile={profile} />
      </div>
    </header>
  );
}
