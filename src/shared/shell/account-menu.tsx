import { Camera, ChevronRight, Languages, LogOut, Moon, RotateCcw, SlidersHorizontal, Sun, TrendingUp, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/shared/ui";
import { navFor } from "@/shared/lib/access";
import { hiddenNavKeys, roleName, useSiteLive } from "@/shared/lib/site";
import { resetDemoData } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { signOut as endSession } from "@/shared/lib/session";
import { USE_MOCK } from "@/shared/lib/config";
import { setLang, useFmt } from "@/shared/lib/i18n";
import { setTheme, useTheme } from "@/shared/lib/theme";
import { cn } from "@/shared/lib/utils";
import { InstallMenuItem } from "@/shared/pwa";

/**
 * The profile window, drawn by the profile feature. `app/` passes it in (through the frame), so this shared menu never
 * imports a feature. `start: "pick"` opens it straight on choosing a new picture (the camera on the big avatar).
 */
export type ProfileSlot = (o: { start: "view" | "pick"; onClose: () => void }) => React.ReactNode;

// Hover shows only under a pointer, and the focus ring only from the keyboard (:focus-visible), so nothing looks
// chosen when the menu opens.
const rowClass =
  "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start text-sm transition-colors hover:bg-chip/60 focus-visible:bg-chip/60";
const iconBox = "flex size-8 shrink-0 items-center justify-center rounded-lg";

/** Draws the profile window that app/ passed in. */
function SlotHost({ slot, ...o }: { slot: ProfileSlot; start: "view" | "pick"; onClose: () => void }) {
  return slot(o);
}

/** One half of a two-way switch (day / night, Arabic / English). */
function Segment({ on, label, onPick, children, lang }: { on: boolean; label?: string; onPick: () => void; children: React.ReactNode; lang?: string }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={on}
      aria-label={label}
      lang={lang}
      tabIndex={-1}
      onClick={onPick}
      className={cn(
        "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors",
        on ? "bg-card font-medium text-text shadow-[0_1px_3px_rgb(60_10_35/0.14)] dark:bg-accent-soft dark:text-accent-ink" : "text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

/** One labelled two-way switch of the account menu (Theme, Language, and the ones app/ passes in, like Notifications). */
export function MenuSwitch({ icon, label, options }: { icon: React.ReactNode; label: string; options: { key: string; on: boolean; label: string; onPick: () => void }[] }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={id} className="flex items-center gap-2 text-[13px] text-muted">
        {icon}
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex w-44 shrink-0 rounded-full bg-chip/70 p-0.5 dark:bg-chip">
        {options.map((o) => (
          <Segment key={o.key} on={o.on} onPick={o.onPick}>
            {o.label}
          </Segment>
        ))}
      </div>
    </div>
  );
}

/**
 * The avatar at the end of the top bar opens the account card: who is signed in (the camera on the picture changes it),
 * day/night and the language as two small switches, the profile and "my performance", and signing out. A menu
 * (role="menu"): the arrows move between its items, Escape closes it and gives the focus back to the avatar.
 */
export function AccountMenu({ user, profile, switches }: { user: User; profile?: ProfileSlot; /** More switches under Theme and Language (from app/). */ switches?: React.ReactNode }) {
  const { tr, lang } = useFmt();
  const theme = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileStart, setProfileStart] = useState<"view" | "pick" | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  /** Opened from the keyboard: the first item takes the focus (from a mouse, nothing looks chosen). */
  const fromKeyboard = useRef(false);
  const menuId = useId();
  const themeId = useId();
  const langId = useId();

  // Closes on a click outside it, and on Escape (focus goes back to the avatar button).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // On opening: the first item from the keyboard, else the menu itself (so the arrows work, with no ring).
  useEffect(() => {
    if (!open) return;
    const first = menu.current?.querySelector<HTMLElement>("[role^=menuitem]");
    (fromKeyboard.current ? first : menu.current)?.focus();
  }, [open]);

  /** The arrows, Home and End move between the items (all of them, in the order they are drawn). */
  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at < 0 ? items.length - 1 : at - 1, Home: 0, End: items.length - 1 };
    if (!(e.key in go)) return;
    e.preventDefault();
    items[(go[e.key] + items.length) % items.length].focus();
  };

  const signOut = () => {
    setOpen(false);
    endSession();
    router.replace("/login");
  };

  const openProfile = (start: "view" | "pick") => {
    setOpen(false);
    setProfileStart(start);
  };

  /** The profile window closed: the focus goes back to the avatar button. */
  const closeProfile = () => {
    setProfileStart(null);
    button.current?.focus();
  };

  const name = lang === "en" && user.name_en ? user.name_en : user.name;
  const role = roleName(user, lang);
  // "My performance": the jobs whose own work is counted (not the CEO, not the system admin).
  const hasOwnPerformance = user.role !== "ceo" && user.role !== "admin";
  // Pages that open from here instead of the top bar (the CEO's advanced settings).
  const hidden = hiddenNavKeys(useSiteLive(), user);
  const settings = navFor(user.role).filter((n) => n.inAccountMenu && n.ready && !hidden.includes(n.key));

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={tr(`حسابي: ${user.name}`, `My account: ${user.name_en ?? user.name}`)}
        onClick={(e) => {
          fromKeyboard.current = e.detail === 0;
          setOpen((o) => !o);
        }}
        className="flex rounded-full transition-shadow hover:ring-4 hover:ring-accent-soft"
      >
        <Avatar user={user} size="lg" />
      </button>
      {open && (
        // The keys are handled for the whole menu here; each item is a real button or link.
        <div
          ref={menu}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label={tr("حسابي", "My account")}
          onKeyDown={onMenuKey}
          className="menu-pop absolute end-0 top-[calc(100%+0.6rem)] z-40 w-[min(20rem,calc(100vw-2.5rem))] origin-top-right overflow-hidden rounded-2xl border border-line bg-card shadow-[0_18px_44px_-14px_rgb(70_12_40/0.3),0_2px_8px_rgb(70_12_40/0.06)] outline-none rtl:origin-top-left dark:shadow-[0_18px_44px_-10px_rgb(0_0_0/0.7)]"
        >
          {/* Who is signed in, on a soft wine wash. */}
          <div className="relative bg-linear-to-b from-accent-soft/80 to-card px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              {profile ? (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-label={tr("غيّر صورتك الشخصية", "Change your picture")}
                  title={tr("غيّر صورتك الشخصية", "Change your picture")}
                  onClick={() => openProfile("pick")}
                  className="group relative shrink-0 rounded-full"
                >
                  <Avatar user={user} size="xl" className="ring-2 ring-card" />
                  <span
                    aria-hidden="true"
                    className="absolute -end-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full bg-accent text-on-accent ring-2 ring-card transition-transform group-hover:scale-110"
                  >
                    <Camera size={13} />
                  </span>
                </button>
              ) : (
                <Avatar user={user} size="xl" className="ring-2 ring-card" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{name}</p>
                {user.title && <p className="truncate text-[13px] text-muted">{user.title}</p>}
                <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-medium text-accent-ink ring-1 ring-accent-soft dark:bg-accent-soft">
                  {role}
                </span>
              </div>
            </div>
            <p className="mt-2.5 truncate text-xs text-muted">
              <bdi dir="ltr">{user.email}</bdi>
            </p>
          </div>

          {/* Quick settings: two small switches, not rows. */}
          <div className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span id={themeId} className="flex items-center gap-2 text-[13px] text-muted">
                {theme === "dark" ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
                {tr("المظهر", "Theme")}
              </span>
              <div role="group" aria-labelledby={themeId} className="flex w-44 shrink-0 rounded-full bg-chip/70 p-0.5 dark:bg-chip">
                <Segment on={theme === "light"} label={tr("الوضع النهاري", "Light mode")} onPick={() => setTheme("light")}>
                  <Sun size={14} aria-hidden="true" />
                  {tr("نهاري", "Light")}
                </Segment>
                <Segment on={theme === "dark"} label={tr("الوضع الليلي", "Dark mode")} onPick={() => setTheme("dark")}>
                  <Moon size={14} aria-hidden="true" />
                  {tr("ليلي", "Dark")}
                </Segment>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span id={langId} className="flex items-center gap-2 text-[13px] text-muted">
                <Languages size={14} aria-hidden="true" />
                {tr("اللغة", "Language")}
              </span>
              <div role="group" aria-labelledby={langId} className="flex w-44 shrink-0 rounded-full bg-chip/70 p-0.5 dark:bg-chip">
                <Segment on={lang === "ar"} lang="ar" onPick={() => setLang("ar")}>
                  العربية
                </Segment>
                <Segment on={lang === "en"} lang="en" onPick={() => setLang("en")}>
                  English
                </Segment>
              </div>
            </div>
            {switches}
          </div>

          {/* My own pages. */}
          {(profile || hasOwnPerformance || settings.length > 0) && (
            <div className="flex flex-col gap-0.5 border-t border-line px-2 py-2">
              {profile && (
                <button type="button" role="menuitem" tabIndex={-1} className={rowClass} onClick={() => openProfile("view")}>
                  <span className={cn(iconBox, "bg-accent-soft text-accent-ink")}>
                    <UserRound size={16} aria-hidden="true" />
                  </span>
                  <span className="flex-1">{tr("ملفي الشخصي", "My profile")}</span>
                  <ChevronRight size={16} aria-hidden="true" className="text-faint rtl:-scale-x-100" />
                </button>
              )}
              {hasOwnPerformance && (
                <Link href={`/performance/${user.id}`} role="menuitem" tabIndex={-1} className={rowClass} onClick={() => setOpen(false)}>
                  <span className={cn(iconBox, "bg-(--st-done) text-(--st-done-ink)")}>
                    <TrendingUp size={16} aria-hidden="true" />
                  </span>
                  <span className="flex-1">{tr("أدائي", "My performance")}</span>
                  <ChevronRight size={16} aria-hidden="true" className="text-faint rtl:-scale-x-100" />
                </Link>
              )}
              {settings.map((n) => (
                <Link key={n.key} href={n.href} role="menuitem" tabIndex={-1} className={rowClass} onClick={() => setOpen(false)}>
                  <span className={cn(iconBox, "bg-chip text-text")}>
                    {n.key === "users" ? <UsersRound size={16} aria-hidden="true" /> : <SlidersHorizontal size={16} aria-hidden="true" />}
                  </span>
                  <span className="flex-1">{tr(n.ar, n.en)}</span>
                  <ChevronRight size={16} aria-hidden="true" className="text-faint rtl:-scale-x-100" />
                </Link>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-0.5 border-t border-line px-2 py-2">
            {USE_MOCK && (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-start text-xs text-muted transition-colors hover:bg-chip/60 hover:text-text focus-visible:bg-chip/60"
                onClick={() => {
                  setOpen(false);
                  resetDemoData();
                }}
              >
                <RotateCcw size={13} aria-hidden="true" />
                {tr("إعادة ضبط البيانات التجريبية", "Reset demo data")}
              </button>
            )}
            <InstallMenuItem className={rowClass} iconClassName={cn(iconBox, "bg-accent-soft text-accent-ink")} onPick={() => setOpen(false)} />
            <button type="button" role="menuitem" tabIndex={-1} className={cn(rowClass, "text-danger hover:bg-danger-soft focus-visible:bg-danger-soft")} onClick={signOut}>
              <span className={cn(iconBox, "bg-danger-soft")}>
                <LogOut size={16} aria-hidden="true" className="rtl:-scale-x-100" />
              </span>
              {tr("تسجيل الخروج", "Sign out")}
            </button>
          </div>
        </div>
      )}
      {profileStart && profile && <SlotHost slot={profile} start={profileStart} onClose={closeProfile} />}
    </div>
  );
}
