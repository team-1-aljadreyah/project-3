import { useCallback, useEffect, useRef, useState } from "react";
import { notificationsApi, type Notification } from "@/features/notifications";
import { isBirthday } from "@/shared/lib/birthday";
import { useFmt } from "@/shared/lib/i18n";
import { onDataChange } from "@/shared/lib/live";
import { usePoll } from "@/shared/lib/poll";
import { useUser } from "@/shared/lib/session";
import { roleName } from "@/shared/lib/site";
import { today } from "@/shared/lib/utils";
import { celebrationsApi } from "../api";
import { KIND_WORDS } from "../rules";
import type { Celebration } from "../types";
import { CelebrationOverlay, type Moment } from "./celebration-overlay";
import { useCelebrationsOn } from "./celebrations-switch";

/** After the welcome splash (about 2.3 s), so the two never meet. */
const START_MS = 2600;
/** Asked again every minute (and at once when the tab comes back): a team celebration sent meanwhile shows. */
const POLL_MS = 60_000;

// The birthday moments have no "seen" on the server: this browser remembers which it showed (the last 100).
const SHOWN_KEY = "p3.celebrated";
function shownBefore(key: string) {
  try {
    return (JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]") as string[]).includes(key);
  } catch {
    return false;
  }
}
function rememberShown(key: string) {
  try {
    const list = (JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]") as string[]).filter((k) => k !== key);
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...list, key].slice(-100)));
  } catch {}
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * The celebrations of the signed-in person, each shown once over the page:
 * - a celebration of their team by the monitoring officer (good work: confetti; a big achievement: fireworks), marked seen
 *   on the server when closed;
 * - on their own birthday, a cake, balloons and confetti;
 * - for whoever gets the birthday reminders (the monitoring officer and the CEO): "today is X's birthday" with balloons,
 *   and a week before, a gift. They come from those reminders, so each person's and the CEO's choices about them apply.
 * Mounted once in the signed-in layout. Nothing shows when the person turned celebrations off (the account menu).
 */
export function LiveCelebrations() {
  const me = useUser();
  const { tr, lang, day } = useFmt();
  const [queue, setQueue] = useState<(Moment & { celebrationId?: number })[]>([]);
  const handled = useRef(new Set<string>());
  const ready = useRef(false);
  const on = useCelebrationsOn();

  const fromTeam = useCallback(
    (c: Celebration): Moment & { celebrationId: number } => {
      const words = KIND_WORDS[c.kind];
      const team = lang === "en" && c.team_name_en ? c.team_name_en : c.team_name;
      return {
        key: `c-${c.id}`,
        celebrationId: c.id,
        effect: c.kind,
        eyebrow: tr(`احتفال مع ${team}`, `Celebrating with ${team}`),
        title: tr(words.title_ar, words.title_en),
        quote: c.message,
        body: c.message ? undefined : tr("شكراً على عملكم. يستحق هذا أن نحتفل به معاً.", "Thank you for your work. This deserves a celebration together."),
        from: { name: lang === "en" && c.by_name_en ? c.by_name_en : c.by_name, role: roleName({ role: c.by_role, custom_role: c.by_custom_role }, lang) },
        close: tr("شكراً!", "Thank you!"),
      };
    },
    [tr, lang],
  );

  const fromReminder = useCallback(
    (n: Notification): Moment => {
      const name = (lang === "en" && n.data.person_name_en) || n.data.person_name || "";
      const isToday = n.kind === "birthday_today";
      return {
        key: `n-${n.id}`,
        effect: isToday ? "birthday-today" : "birthday-soon",
        eyebrow: isToday ? tr("اليوم", "Today") : tr("تذكير قبل أسبوع", "A week's notice"),
        title: isToday ? tr(`اليوم عيد ميلاد ${name}`, `Today is ${name}'s birthday`) : tr(`بعد أسبوع: عيد ميلاد ${name}`, `${name}'s birthday is in a week`),
        body: isToday
          ? tr("فرصة جميلة لتهنئة طيبة من الفريق.", "A good moment for a kind word from the team.")
          : tr(`يوم ${day(n.data.due ?? today())}. وقت كافٍ لتحضير مفاجأة صغيرة.`, `On ${day(n.data.due ?? today())}. Time enough to plan a small surprise.`),
        action: { label: tr("أعياد الميلاد القادمة", "Upcoming birthdays"), href: "/dashboard#birthdays-title" },
        close: tr("حسناً", "Got it"),
      };
    },
    [tr, lang, day],
  );

  const collect = useCallback(async () => {
    if (!ready.current || !on) return;
    const found: (Moment & { celebrationId?: number })[] = [];
    const day0 = today();
    if (isBirthday(me, day0)) {
      const name = lang === "en" && me.name_en ? me.name_en : me.name;
      found.push({
        key: `bd-${me.id}-${day0}`,
        effect: "birthday",
        eyebrow: day(day0),
        title: tr(`عيد ميلاد سعيد يا ${firstName(name)}!`, `Happy birthday, ${firstName(name)}!`),
        body: tr("كل عام وأنت بخير. نتمنى لك سنة مليئة بالفرح والنجاح، من الفريق كله.", "Wishing you a year full of joy and success, from the whole team."),
        close: tr("شكراً!", "Thank you!"),
      });
    }
    const [mine, notes] = await Promise.all([celebrationsApi.mine().catch(() => []), notificationsApi.notifications().catch(() => [])]);
    found.push(...mine.map(fromTeam));
    for (const n of notes) {
      if (n.read || !n.data.due) continue;
      if ((n.kind === "birthday_today" && n.data.due === day0) || (n.kind === "birthday_soon" && n.data.due > day0)) found.push(fromReminder(n));
    }
    const fresh = found.filter((m) => !handled.current.has(m.key) && (m.celebrationId || !shownBefore(m.key)));
    if (!fresh.length) return;
    fresh.forEach((m) => handled.current.add(m.key));
    setQueue((q) => [...q, ...fresh]);
  }, [me, lang, tr, day, fromTeam, fromReminder, on]);

  useEffect(() => {
    const start = setTimeout(() => {
      ready.current = true;
      void collect();
    }, START_MS);
    const stop = onDataChange(() => void collect());
    return () => {
      clearTimeout(start);
      stop();
    };
  }, [collect]);
  usePoll(() => void collect(), POLL_MS);

  const current = queue[0];
  if (!current || !on) return null;
  const close = () => {
    if (current.celebrationId) void celebrationsApi.seen(current.celebrationId).catch(() => {});
    else rememberShown(current.key);
    setQueue((q) => q.slice(1));
  };
  return <CelebrationOverlay key={current.key} moment={current} onClose={close} />;
}
