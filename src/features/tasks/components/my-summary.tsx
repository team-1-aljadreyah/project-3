import Link from "next/link";
import type { ProjectSummary } from "@/features/projects";
import { arDays } from "@/shared/lib/format";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Skeleton, TONE_CLASS } from "@/shared/ui";
import { byTone, myNumbers, openByProject, WEEK_DAYS } from "../my-summary";
import type { Task } from "../types";
import { HalfGauge, StatusRing } from "./my-charts";

// The five tiles: in one row on a computer, 3 + 2 on a tablet, 1 + 2 + 2 on a phone. SPANS is each tile's width.
const TILES = "grid grid-cols-2 gap-3 sm:grid-cols-6 lg:grid-cols-5";
const SPANS = ["col-span-2 lg:col-span-1", "sm:col-span-2 lg:col-span-1", "sm:col-span-2 lg:col-span-1", "sm:col-span-3 lg:col-span-1", "sm:col-span-3 lg:col-span-1"];

/** How a tile looks. The two coloured ones lean a little and straighten under the pointer (not with "reduce motion"). */
const TILE = {
  plain: "border-line bg-card",
  accent: "border-transparent bg-accent text-on-accent motion-safe:hover:rotate-0 motion-safe:ltr:-rotate-2 motion-safe:rtl:rotate-2",
  done: cn("border-transparent motion-safe:hover:rotate-0 motion-safe:ltr:rotate-2 motion-safe:rtl:-rotate-2", TONE_CLASS.done.pill),
};

// The three cards: side by side on a computer (the gauge's card the narrowest, the ring's the widest for its legend),
// the pills over the two charts on a tablet, one under the other on a phone. "minmax(0, …)" and "min-w-0" keep a long
// project name from pushing a card wider than its column.
const CARDS = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1.17fr)_minmax(0,0.85fr)]";
const CARD = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-card p-4 sm:p-5";

/**
 * The summary at the top of "My tasks" (adapted from a dashboard design the team leader chose, in our own colours): a
 * row of number tiles, my open tasks per project as pills, all my tasks by status family as a ring, and the share that
 * is done as a half gauge. Every number is counted from the same tasks as the list under it (../my-summary.ts).
 */
/** Where a tile takes you in the list under the summary. */
export type ListPlace = "top" | "late" | "soon" | "done";

export function MySummary({ tasks, projects, today, onShow }: { tasks: Task[]; projects: ProjectSummary[]; today: string; onShow?: (place: ListPlace) => void }) {
  const { tr, lang, num, pct, due } = useFmt();
  const n = myNumbers(tasks, projects, today);
  const bars = openByProject(tasks, projects);
  // Under the gauge: each number as a part of all my tasks (short names: the four share one row).
  const parts = [
    { ar: "مكتملة", en: "Done", value: n.done },
    { ar: "مفتوحة", en: "Open", value: n.open },
    { ar: "متأخرة", en: "Late", value: n.late },
    { ar: "مراجعة", en: "Review", value: n.inReview },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="my-numbers-title">
        <h2 id="my-numbers-title" className="sr-only">
          {tr("ملخص مهامي", "My summary")}
        </h2>
        <ul className={TILES}>
          <Tile onClick={onShow && (() => onShow("top"))} look="accent" className={SPANS[0]} value={num(n.open)} label={tr("مهام مفتوحة", "Open tasks")} note={tr(`من أصل ${num(n.total)}`, `of ${n.total} tasks`)} />
          <Tile
            onClick={onShow && (() => onShow("soon"))}
            className={SPANS[1]}
            value={num(n.dueToday)}
            label={tr("موعدها اليوم", "Due today")}
            note={n.dueWeek > 0 ? tr(`خلال ${arDays(WEEK_DAYS)}: ${num(n.dueWeek)}`, `${n.dueWeek} in the next ${WEEK_DAYS} days`) : undefined}
          />
          <Tile
            onClick={onShow && (() => onShow("late"))}
            className={SPANS[2]}
            value={num(n.late)}
            label={tr("متأخرة", "Late")}
            danger={n.late > 0}
            note={n.late > 0 ? tr(`أقدمها ${due(-n.longestLate)}`, `Oldest: ${due(-n.longestLate)}`) : undefined}
          />
          <Tile
            onClick={onShow && (() => onShow("top"))}
            className={SPANS[3]}
            value={num(n.inReview)}
            label={tr("بانتظار المراجعة", "In review")}
            note={n.awaitingApproval > 0 ? tr(`بانتظار الاعتماد: ${num(n.awaitingApproval)}`, `${n.awaitingApproval} waiting for approval`) : undefined}
          />
          <Tile onClick={onShow && (() => onShow("done"))} look="done" className={SPANS[4]} value={num(n.done)} label={tr("مكتملة", "Done")} note={tr(`${pct(n.ratio)} من مهامي`, `${pct(n.ratio)} of my tasks`)} />
        </ul>
      </section>

      <div className={CARDS}>
        <section aria-labelledby="my-projects-title" className={cn(CARD, "md:col-span-2 lg:col-span-1")}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="my-projects-title" className="font-semibold">
              {tr("مهامي حسب المشروع", "My tasks by project")}
            </h2>
            {/* The pills count open tasks only (the ring beside them counts every task). */}
            <span className="shrink-0 text-xs text-muted">{tr("المفتوحة", "Open")}</span>
          </div>
          {bars.length === 0 ? (
            // No pill to draw: everything is done, or (it should not happen) the open tasks' projects did not come.
            <p className="text-sm text-muted">
              {n.open === 0
                ? tr("لا مهام مفتوحة لديك الآن.", "You have no open tasks right now.")
                : tr("مشاريع مهامك المفتوحة ليست في قائمتك.", "The projects of your open tasks are not in your list.")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bars.map((b) => {
                const name = lang === "en" && b.name_en ? b.name_en : b.name;
                return (
                  <li key={b.id}>
                    {/* The whole pill opens the project's board (click anywhere). Its name says what the number is. */}
                    <Link
                      href={`/projects/${b.id}`}
                      aria-label={tr(`${name}، مهام مفتوحة: ${num(b.open)}`, `${name}, open tasks: ${b.open}`)}
                      className="relative flex h-10 items-center gap-2 overflow-hidden rounded-full border border-line bg-card-2 ps-4 pe-1.5 transition-colors hover:border-accent"
                    >
                      {/* The tinted part is as long as the count: the project with the most fills its pill. */}
                      <span aria-hidden="true" className="absolute inset-y-0 start-0 rounded-e-xl bg-accent-soft" style={{ width: pct(b.length) }} />
                      <span title={name} className="relative min-w-0 flex-1 truncate text-sm font-medium">
                        <bdi>{name}</bdi>
                      </span>
                      <span className="num relative flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent">{num(b.open)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="my-status-title" className={CARD}>
          <h2 id="my-status-title" className="font-semibold">
            {tr("حسب الحالة", "By status")}
          </h2>
          <StatusRing slices={byTone(tasks, projects)} total={n.total} />
        </section>

        <section aria-labelledby="my-done-title" className={CARD}>
          <h2 id="my-done-title" className="font-semibold">
            {tr("المنجز", "Done")}
          </h2>
          <HalfGauge
            value={n.ratio}
            label={tr(`المنجز: ${num(n.done)} من ${num(n.total)} (${pct(n.ratio)})`, `Done: ${n.done} of ${n.total} tasks (${pct(n.ratio)})`)}
            caption={tr("من مهامي مكتملة", "of my tasks done")}
          />
          <dl className="mx-auto grid w-full max-w-64 grid-cols-4 gap-2 text-center text-xs">
            {parts.map((p) => (
              // The name comes first for a screen reader; on screen the number sits above it.
              <div key={p.en} className="flex min-w-0 flex-col-reverse gap-0.5">
                <dt className="truncate text-muted">{tr(p.ar, p.en)}</dt>
                <dd dir="ltr" className="num text-[13px]">
                  <b className="font-semibold">{num(p.value)}</b>
                  {/* "3/11": 3 of my 11 tasks. Left out when the numbers get too long for four in a row. */}
                  {n.total < 1000 && (
                    <span aria-hidden="true" className="text-faint">
                      /{num(n.total)}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

/** The summary's place while the tasks load: the same tiles and the row of cards, as grey blocks. */
export function MySummarySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className={TILES}>
        {SPANS.map((span, i) => (
          <Skeleton key={i} className={cn("h-26 rounded-2xl", span)} />
        ))}
      </div>
      <div className={CARDS}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={cn("h-64 rounded-2xl", i === 0 && "md:col-span-2 lg:col-span-1")} />
        ))}
      </div>
    </div>
  );
}

/** One number of the summary: the number, its name, and a second line only when there is something real to say. */
function Tile({
  value,
  label,
  note,
  look = "plain",
  danger,
  onClick,
  className,
}: {
  /** A press on the tile: show that part of the list. */
  onClick?: () => void;
  value: string;
  label: string;
  note?: string;
  look?: keyof typeof TILE;
  /** The number and the note in red: something needs attention. */
  danger?: boolean;
  className?: string;
}) {
  return (
    <li className={cn("relative flex min-h-26 flex-col gap-2.5 rounded-2xl border px-4 py-3.5 transition-transform duration-300", onClick && "hover:-translate-y-0.5", TILE[look], className)}>
      <span className={cn("text-3xl leading-none font-semibold", danger && "text-danger")}>{value}</span>
      <span className="flex flex-col gap-0.5">
        {onClick ? (
          // The label is the tile's one button, stretched over the whole tile.
          <button type="button" onClick={onClick} className={cn("text-start text-[13px] font-medium after:absolute after:inset-0 after:rounded-2xl", look === "plain" && "text-muted")}>
            {label}
          </button>
        ) : (
          <span className={cn("text-[13px] font-medium", look === "plain" && "text-muted")}>{label}</span>
        )}
        {note && <span className={cn("text-xs", look === "plain" && (danger ? "text-danger" : "text-muted"))}>{note}</span>}
      </span>
    </li>
  );
}
