import { useEffect, useState } from "react";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

/** The time now, redrawn when the minute changes (and when the tab is shown again). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      // The next minute's start, so the clock turns exactly with the real one.
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const onShow = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
  return now;
}

/** Good morning / afternoon / evening, by the hour. */
export function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return { ar: "صباح الخير", en: "Good morning" };
  if (hour >= 12 && hour < 17) return { ar: "نهارك سعيد", en: "Good afternoon" };
  return { ar: "مساء الخير", en: "Good evening" };
}

/**
 * The top of a dashboard: "Good evening, Huda" and a live clock with the day and the date. The greeting settles in when
 * the page opens; the clock's colon breathes and each new minute rolls in from below (all off with "reduce motion").
 * `tone`: "light" on the dark banners (white text), "plain" on the page's own colours.
 */
export function Greeting({ user, tone = "light", size = "lg", className }: { user: Pick<User, "name" | "name_en">; tone?: "light" | "plain"; size?: "lg" | "md"; className?: string }) {
  const { tr, lang } = useFmt();
  const now = useNow();
  const hello = greetingFor(now.getHours());
  const first = (lang === "en" && user.name_en ? user.name_en : user.name).split(" ")[0];
  const locale = lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB";
  const [hh, mm] = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now).split(":");
  const h12 = Number(hh) % 12 || 12;
  const half = Number(hh) < 12 ? tr("ص", "AM") : tr("م", "PM");
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(now);
  const light = tone === "light";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className={cn("greet-in font-semibold leading-tight", size === "lg" ? "text-2xl sm:text-3xl" : "text-xl", light ? "text-white" : "text-text")}>
        {tr(hello.ar, hello.en)}
        {tr("، ", ", ")}
        <span className={light ? "text-[#f2dace]" : "text-accent-ink"}>{first}</span>
      </p>
      <p className={cn("greet-in greet-later flex flex-wrap items-baseline gap-x-2 text-sm", light ? "text-white/80" : "text-muted")}>
        {/* The time, read as one: "2:31 PM". Each new minute rolls in. */}
        <time dateTime={now.toISOString()} aria-label={`${h12}:${mm} ${half}`} className={cn("num inline-flex items-baseline font-semibold", light ? "text-white" : "text-text")} dir="ltr">
          {/* Arabic reads the time right to left: «2:23 م» has the م on the left of the digits. */}
          {lang === "ar" && <span className="me-1 text-xs font-medium">{half}</span>}
          <span key={`${h12}`} className="clock-roll">
            {h12}
          </span>
          <span aria-hidden="true" className="clock-colon px-px">
            :
          </span>
          <span key={mm} className="clock-roll">
            {mm}
          </span>
          {lang !== "ar" && <span className="ms-1 text-xs font-medium">{half}</span>}
        </time>
        <span aria-hidden="true">·</span>
        <span>
          {weekday} {date}
        </span>
      </p>
    </div>
  );
}
