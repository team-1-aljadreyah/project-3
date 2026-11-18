"use client";

import { Languages, LogOut, Moon, RotateCcw, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { ROLES } from "@/lib/access";
import type { User } from "@/lib/api/types";
import { clearSession } from "@/lib/auth";
import { setLang, useFmt } from "@/lib/i18n";
import { setTheme, useTheme } from "@/lib/theme";

const itemClass = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm hover:bg-chip";

/** The avatar at the end of the top bar: who is signed in, day/night, language, and signing out. */
export function AccountMenu({ user }: { user: User }) {
  const { tr, lang } = useFmt();
  const theme = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Closes on a click outside it, and on Escape (focus goes back to the avatar button).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        box.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = () => {
    setOpen(false);
    clearSession();
    router.replace("/login");
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={tr(`حسابي: ${user.name}`, `My account: ${user.name_en ?? user.name}`)}
        onClick={() => setOpen((o) => !o)}
        className="flex rounded-full"
      >
        <Avatar user={user} size="lg" />
      </button>
      {open && (
        <div id={menuId} role="menu" className="absolute end-0 top-12 z-40 w-64 rounded-xl border border-line bg-card p-2 shadow-lg">
          <div className="border-b border-line px-3 pt-1 pb-3">
            <p className="font-semibold">{lang === "en" && user.name_en ? user.name_en : user.name}</p>
            <p className="text-[13px] text-muted">{tr(ROLES[user.role].ar, ROLES[user.role].en)}</p>
          </div>
          <div className="flex flex-col pt-2">
            <button type="button" role="menuitem" className={itemClass} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              {theme === "dark" ? tr("الوضع النهاري", "Light mode") : tr("الوضع الليلي", "Dark mode")}
            </button>
            <button type="button" role="menuitem" className={itemClass} onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
              <Languages size={16} aria-hidden="true" />
              {lang === "ar" ? "English" : "العربية"}
            </button>
            {process.env.NEXT_PUBLIC_USE_MOCK === "true" && (
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  setOpen(false);
                  // Demo build only (the check is written out so the real build drops this button).
                  import("@/lib/api/mock/db").then((m) => m.resetDb());
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                {tr("إعادة البيانات التجريبية", "Reset demo data")}
              </button>
            )}
            <button type="button" role="menuitem" className={`${itemClass} text-danger`} onClick={signOut}>
              <LogOut size={16} aria-hidden="true" className="rtl:-scale-x-100" />
              {tr("تسجيل الخروج", "Sign out")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
