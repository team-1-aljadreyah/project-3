import { Cake } from "lucide-react";
import { useState } from "react";
import type { User } from "@/shared/api/types";
import { personHref } from "@/shared/lib/access";
import { BIRTHDAY_SOON_DAYS, UPCOMING_DAYS, upcomingBirthdays } from "@/shared/lib/birthday";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Avatar, MaybeLink } from "@/shared/ui";

/** How many rows show before "Show all". */
const SHOWN = 6;

/**
 * "Upcoming birthdays" on the monitoring officer's and the CEO's dashboard: the next 30 days, today first. Each row is a
 * small calendar leaf with the day, the person, the day and month in words, and how far it is ("today", "in 3 days").
 * Only the day and month: never the year or the age. The whole row opens the person's performance page when the viewer
 * may open it (personHref). The bell's birthday reminders land here (#birthdays-title) when there is no such page.
 */
export function UpcomingBirthdays({ viewer, people, today, projects = [] }: { viewer: User; people: User[]; today: string; projects?: { pm_id: number; member_ids: number[] }[] }) {
  const { tr, lang, day, due } = useFmt();
  const [all, setAll] = useState(false);
  const rows = upcomingBirthdays(people, today);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const nameOf = (u: User) => (lang === "en" && u.name_en ? u.name_en : u.name);

  return (
    <section aria-labelledby="birthdays-title" className="scroll-mt-24 rounded-xl border border-line bg-card p-4">
      <h2 id="birthdays-title" className="flex items-center gap-2 font-semibold">
        <Cake size={17} aria-hidden="true" className="text-accent" />
        {tr("أعياد الميلاد القادمة", "Upcoming birthdays")}
      </h2>
      <p className="mt-0.5 mb-3 text-xs text-muted">{tr(`خلال ${UPCOMING_DAYS} يوماً · اليوم والشهر فقط`, `The next ${UPCOMING_DAYS} days · day and month only`)}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{tr("لا أعياد ميلاد خلال الأيام الثلاثين القادمة.", "No birthdays in the next 30 days.")}</p>
      ) : (
        <ul aria-label={tr("أعياد الميلاد القادمة", "Upcoming birthdays")} className="flex flex-col gap-1">
          {shown.map(({ person, date, days }) => {
            const isToday = days === 0;
            const when = isToday ? tr("اليوم", "today") : days === BIRTHDAY_SOON_DAYS ? tr("بعد أسبوع", "in a week") : due(days);
            return (
              // The whole row opens the person, when the viewer may (click anywhere).
              <li key={person.id} className={cn("relative -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-card-2", isToday && "bg-accent-soft/60 hover:bg-accent-soft")}>
                {/* A small calendar leaf with the day of the month. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-10 w-9 shrink-0 flex-col overflow-hidden rounded-md border text-center",
                    isToday ? "border-accent bg-accent text-card" : "border-line bg-card-2 text-text",
                  )}
                >
                  <span className={cn("h-1.5 shrink-0", isToday ? "bg-black/20" : "bg-accent/70")} />
                  <span className="num flex flex-1 items-center justify-center text-[15px] leading-none font-semibold">{Number(date.slice(8))}</span>
                </span>
                <Avatar user={person} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <MaybeLink href={personHref(viewer, person, projects)} cover className="truncate text-sm font-medium">
                    {nameOf(person)}
                  </MaybeLink>
                  <span className="text-xs text-muted">{day(date)}</span>
                </span>
                <span className={cn("shrink-0 text-xs", isToday ? "inline-flex items-center gap-1 font-semibold text-accent-ink" : "text-muted")}>
                  {isToday && <Cake size={13} aria-hidden="true" />}
                  {when}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > SHOWN && (
        <button type="button" onClick={() => setAll((x) => !x)} className="mt-2 text-sm font-medium text-accent hover:underline">
          {all ? tr("أقل", "Show fewer") : tr(`عرض الكل (${rows.length})`, `Show all (${rows.length})`)}
        </button>
      )}
    </section>
  );
}
