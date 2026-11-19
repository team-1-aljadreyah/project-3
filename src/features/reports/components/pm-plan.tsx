import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { projectsApi } from "@/features/projects";
import { tasksApi } from "@/features/tasks";
import type { StatusTone, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Avatar, ErrorBox, LoadingBlock, Pill, PriorityPill, ProgressBar, Skeleton } from "@/shared/ui";
import { calendarDays, calendarPills, PLAN_COLUMNS, planColumns, planTasks, type PlanColumn, type PlanTask } from "../compute";

/** How many cards a column shows before it says "and N more". */
const CARDS = 4;
const COLUMN: Record<PlanColumn, { ar: string; en: string; tone: StatusTone }> = {
  todo: { ar: "للتنفيذ", en: "To do", tone: "todo" },
  doing: { ar: "قيد التنفيذ", en: "In progress", tone: "progress" },
  review: { ar: "قيد المراجعة", en: "In review", tone: "review" },
  done: { ar: "مكتملة", en: "Done", tone: "done" },
};

/**
 * The project manager's plan, over every project they run: a calendar strip (the tasks due around today, each a pill on
 * its day; today is the dark line, the weekend is hatched) and a board of four columns with every task as a card (its
 * project, priority, due day, how far along it is, and who has it). Every pill and card opens its task.
 */
export function PmPlan({ today, people }: { today: string; people: Map<number, User> }) {
  const { tr, lang, num, pct, day } = useFmt();
  const load = useLoad(async () => {
    const projects = await projectsApi.projects();
    return Promise.all(projects.map(async (project) => ({ project, tasks: await tasksApi.tasks(project.id) })));
  }, []);
  const items = useMemo(() => (load.data ? planTasks(load.data, today) : []), [load.data, today]);
  const days = useMemo(() => calendarDays(items, today), [items, today]);
  const strip = useMemo(() => calendarPills(days), [days]);
  const columns = useMemo(() => planColumns(items), [items]);
  const dayLabel = useMemo(() => new Intl.DateTimeFormat(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", { weekday: "short", day: "numeric" }), [lang]);

  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="flex flex-col gap-5">
        <Skeleton className="h-44" />
        <Skeleton className="h-72" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;

  const projectName = (t: PlanTask) => (lang === "en" && t.project.name_en ? t.project.name_en : t.project.name);
  const nameOf = (u: User) => (lang === "en" && u.name_en ? u.name_en : u.name);
  const dueCount = days.reduce((n, d) => n + d.tasks.length, 0);

  return (
    <>
      <section aria-labelledby="calendar-title" className="rounded-xl border border-line bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="calendar-title" className="font-semibold">
            {tr("تقويم المهام", "Task calendar")}
          </h2>
          <span className="text-xs text-muted">{tr(`مهام مستحقة في هذه الأيام: ${num(dueCount)}`, `Due in these days: ${dueCount}`)}</span>
        </div>
        {/* A week across: on a phone it scrolls sideways. */}
        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${strip.rows}, 2.1rem) 1.2rem` }}>
            {days.map((d, i) => (
              <div
                key={d.date}
                aria-hidden="true"
                style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
                className={cn("border-s border-line", d.dayOff && "day-off", d.isToday && "relative border-s-2 border-accent before:absolute before:-start-[5px] before:top-0 before:size-2 before:rounded-full before:bg-accent")}
              />
            ))}
            {days.map((d, i) => (
              <div key={d.date} style={{ gridColumn: i + 1, gridRow: 1 }} className={cn("px-2.5 pb-3 text-xs", d.isToday ? "font-semibold text-text" : "text-muted")}>
                {dayLabel.format(new Date(d.date + "T00:00:00"))}
                {d.isToday && <span className="ms-1.5 text-accent-ink">{tr("اليوم", "today")}</span>}
              </div>
            ))}
            {strip.pills.map(({ item, col, span, row }) => (
              <Link
                key={item.task.id}
                href={`/tasks/${item.task.id}`}
                title={`${item.task.title} · ${projectName(item)}`}
                style={{ gridColumn: `${col + 1} / span ${span}`, gridRow: row + 2 }}
                className={cn(
                  "z-10 mx-1.5 my-0.5 inline-flex max-w-[calc(100%-0.75rem)] items-center justify-self-start rounded-full border px-3 text-xs hover:border-accent",
                  days[col].isToday
                    ? "border-accent bg-accent font-medium text-on-accent"
                    : item.late > 0
                      ? "border-transparent bg-(--st-blocked) text-(--st-blocked-ink)"
                      : "border-line bg-card-2 text-text",
                )}
              >
                <span dir="auto" className="truncate">
                  {item.task.title}
                </span>
              </Link>
            ))}
            {strip.more.map((n, i) =>
              n > 0 ? (
                <span key={days[i].date} style={{ gridColumn: i + 1, gridRow: strip.rows + 2 }} className="px-2.5 text-[11px] text-muted">
                  {tr(`مهام أخرى: ${num(n)}`, `+${n} more`)}
                </span>
              ) : null,
            )}
          </div>
        </div>
        {dueCount === 0 && <p className="mt-2 text-sm text-muted">{tr("لا مهام مستحقة في هذه الأيام.", "Nothing is due in these days.")}</p>}
      </section>

      <section aria-labelledby="board-title" className="rounded-xl border border-line bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="board-title" className="font-semibold">
            {tr("كل المهام", "All tasks")}
          </h2>
          <span className="text-xs text-muted">{tr(`${num(items.length)} مهمة في مشاريعك`, `${items.length} tasks in your projects`)}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_COLUMNS.map((key) => {
            const list = columns[key];
            const label = tr(COLUMN[key].ar, COLUMN[key].en);
            return (
              <div key={key} className="flex flex-col gap-2 rounded-lg bg-card-2 p-2">
                <h3 className="flex items-center gap-2 px-1 py-0.5 text-sm">
                  <Pill tone={COLUMN[key].tone}>{label}</Pill>
                  <span className="num text-muted">{num(list.length)}</span>
                </h3>
                <ul aria-label={label} className="flex flex-col gap-2">
                  {list.slice(0, CARDS).map((t) => {
                    const who = t.task.assignee_id ? people.get(t.task.assignee_id) : undefined;
                    return (
                      <li key={t.task.id}>
                        {/* The whole card opens the task (click anywhere). */}
                        <Link href={`/tasks/${t.task.id}`} className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3 hover:border-accent">
                          <span className="flex items-center justify-between gap-2 text-xs">
                            <b dir="auto" className="truncate font-semibold">
                              {projectName(t)}
                            </b>
                            <span dir="ltr" className="num shrink-0 text-faint">
                              {t.task.code}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <PriorityPill priority={t.task.priority} />
                            {t.task.due && (
                              <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]", t.late > 0 ? "border-transparent bg-(--st-blocked) text-(--st-blocked-ink)" : "border-line text-muted")}>
                                <CalendarDays size={12} aria-hidden="true" />
                                {day(t.task.due)}
                              </span>
                            )}
                            {t.tone === "blocked" && <Pill tone="blocked">{tr("متوقفة", "Blocked")}</Pill>}
                          </span>
                          <span dir="auto" className="line-clamp-2 text-sm font-medium">
                            {t.task.title}
                          </span>
                          <span className="flex flex-col gap-1">
                            <ProgressBar value={t.progress} label={tr(`إنجاز ${t.task.title}`, `${t.task.title} progress`)} barClassName="bg-(--st-done-ink)" />
                            <span className="text-[11px] text-muted">
                              {tr("الإنجاز", "Progress")}: <span dir="ltr">{pct(t.progress)}</span>
                            </span>
                          </span>
                          {who && (
                            <span className="flex items-center gap-2 text-xs text-muted">
                              <Avatar user={who} size="sm" />
                              <span className="truncate">{nameOf(who)}</span>
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {list.length === 0 && <p className="px-1 pb-1 text-xs text-muted">{tr("لا مهام هنا.", "Nothing here.")}</p>}
                {list.length > CARDS && <p className="px-1 pb-1 text-xs text-muted">{tr(`مهام أخرى: ${num(list.length - CARDS)}`, `+${list.length - CARDS} more`)}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
