import { useEffect, useState } from "react";
import { roleName } from "@/shared/lib/site";
import { BRAND } from "@/shared/lib/brand";
import { useFmt } from "@/shared/lib/i18n";
import { useSession, useUser } from "@/shared/lib/session";
import { today } from "@/shared/lib/utils";

const KEY = "p3.welcome";
const SHOWN_MS = 2300;

/** "صباح الخير" until noon, then "مساء الخير" (and the same in English). */
export function greeting(hour: number) {
  return hour >= 5 && hour < 12 ? { ar: "صباح الخير", en: "Good morning" } : { ar: "مساء الخير", en: "Good evening" };
}

// Decided once per sign-in (React may run a start-up effect twice in development; the answer must not change).
const decided = new Map<string, boolean>();
/**
 * Should the splash show now? Yes the first time a signed-in page opens in this tab for this sign-in: in a new tab, a
 * new browser start, and after every sign-in (a new sign-in has a new token). Not on a reload of the same tab.
 */
function opensNow(token: string) {
  if (!decided.has(token)) {
    let show = false;
    try {
      show = sessionStorage.getItem(KEY) !== token && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      sessionStorage.setItem(KEY, token);
    } catch {
      show = false;
    }
    decided.set(token, show);
  }
  return decided.get(token)!;
}

/** The first name, for a warm hello ("مريم العبيدي" → "مريم"). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * The welcome splash: every time the app opens (a new tab or a new browser start) and after every sign-in (not on a
 * reload of the same tab), a
 * short greeting with the person's first name, their job and the day, which then lifts away into their page.
 * It never blocks anything: clicks pass through it, it is hidden from screen readers (the page itself is announced), it
 * is gone after about two seconds, and with "reduce motion" it is not shown at all. Styles in app/styles.css (.welcome).
 */
export function WelcomeSplash() {
  const user = useUser();
  const { tr, lang, day } = useFmt();
  const token = useSession()?.token ?? "";
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!token || !opensNow(token)) return;
    // Shown from the browser only (after the first paint), so the server and the browser draw the same page first.
    const start = requestAnimationFrame(() => setShow(true));
    const done = setTimeout(() => setShow(false), SHOWN_MS);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(done);
    };
  }, [token]);

  if (!show) return null;
  const hello = greeting(new Date().getHours());
  const name = lang === "en" && user.name_en ? user.name_en : user.name;
  return (
    <div className="welcome" aria-hidden="true">
      <div className="welcome-card flex flex-col items-center gap-4 px-6 text-center">
        <span className="welcome-mark flex size-16 items-center justify-center rounded-2xl bg-[#f2dace] text-2xl font-bold text-[#3b0720]">
          {BRAND.mark}
        </span>
        <p className="welcome-line text-3xl font-semibold text-white sm:text-4xl">
          {tr(`${hello.ar}، ${firstName(name)}`, `${hello.en}, ${firstName(name)}`)}
        </p>
        <p className="welcome-line text-sm text-[#e6d3da]" style={{ animationDelay: "0.35s" }}>
          {roleName(user, lang)} · {day(today())}
        </p>
        <span className="welcome-bar mt-2 h-1 w-24 overflow-hidden rounded-full bg-white/15">
          <span className="block h-full rounded-full bg-[#d49a9a]" />
        </span>
      </div>
    </div>
  );
}
