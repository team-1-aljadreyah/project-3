import { useId, useMemo } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { place, scaleSteps, softArea, softLine } from "../curve";

/**
 * The small line along the bottom of a number card: how the number moved over the days (oldest first), with a dot on
 * the last day. It takes the card's own text colour. Screen readers get `label` (the numbers in words) instead.
 */
export function Sparkline({ values, label, className }: { values: number[]; label: string; className?: string }) {
  const dots = place(values);
  const last = dots[dots.length - 1];
  return (
    <div role="img" aria-label={label} className={cn("relative h-10", className)}>
      {/* The drawing stretches to the card's width (the line keeps its thickness). In Arabic it is mirrored, so time
          runs in the reading direction: right to left. */}
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible rtl:-scale-x-100">
        <path d={softLine(dots)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {last && <span aria-hidden="true" className="absolute -m-1 size-2 rounded-full bg-current" style={{ insetInlineStart: `${last.x * 100}%`, top: `${last.y * 100}%` }} />}
    </div>
  );
}

/**
 * The activity chart: one count a day as a soft line with a light fill under it, a side scale in whole numbers, the day
 * under each point, and a mark with its number on the busiest day. Pointing at a day shows that day's number. Screen
 * readers get `label` (every number in words) instead of the drawing.
 */
export function ActivityChart({ days, values, today, label }: { days: string[]; values: number[]; today: string; label: string }) {
  const { tr, lang, num, day } = useFmt();
  const fillId = `activity-fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const weekday = useMemo(() => new Intl.DateTimeFormat(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", { weekday: "short" }), [lang]);
  const highest = Math.max(0, ...values);
  const steps = scaleSteps(highest);
  const top = steps[steps.length - 1];
  const dots = place(values, { min: 0, max: top }, true);
  // The busiest day carries the mark (the latest one, when two days are equal).
  const peak = highest > 0 ? values.lastIndexOf(highest) : -1;
  const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
  const height = "h-44 sm:h-52";

  return (
    // The picture has one name (`label`); what is drawn inside it is hidden from screen readers.
    <div role="img" aria-label={label} className="flex gap-2 pt-10">
      {/* The side scale: whole numbers, each beside its line. */}
      <div aria-hidden="true" className={cn("relative w-5 shrink-0 text-[11px] text-faint", height)}>
        {steps.map((s) => (
          <span key={s} className="num absolute end-0 -translate-y-1/2" style={{ top: `${(1 - s / top) * 100}%` }}>
            {num(s)}
          </span>
        ))}
      </div>
      <div aria-hidden="true" className="min-w-0 flex-1">
        <div className={cn("relative", height)}>
          {steps.map((s) => (
            <span key={s} className="absolute inset-x-0 h-px bg-line" style={{ top: `${(1 - s / top) * 100}%` }} />
          ))}
          {/* The line and its fill, stretched to the box. Mirrored in Arabic, like the columns over it. */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible text-accent rtl:-scale-x-100">
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={softArea(dots)} fill={`url(#${fillId})`} />
            <path d={softLine(dots)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {highest === 0 && <p className="absolute inset-0 grid place-items-center text-sm text-muted">{tr("لا عمليات في هذه الأيام.", "No actions in these days.")}</p>}
          {/* One column per day, over the drawing: the busiest day's mark, and the pointer's line, dot and box. */}
          <div className="absolute inset-0 grid" style={columns}>
            {days.map((d, i) => {
              const isPeak = i === peak;
              const y = dots[i].y;
              const above = { bottom: `calc(${(1 - y) * 100}% + 16px)` };
              return (
                <div key={d} className="group relative">
                  <span className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-line-strong group-hover:block" />
                  {isPeak && <span className="absolute left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20" style={{ top: `${y * 100}%` }} />}
                  <span
                    className={cn("absolute left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-card", !isPeak && "hidden group-hover:block")}
                    style={{ top: `${y * 100}%` }}
                  />
                  {isPeak && (
                    <span className="num absolute left-1/2 -translate-x-1/2 text-xs font-semibold group-hover:hidden" style={above}>
                      {num(values[i])}
                    </span>
                  )}
                  {/* The box stays inside the chart: the first and last days open towards the middle, and a high
                      point opens downwards. */}
                  <span
                    className={cn(
                      "absolute z-10 hidden flex-col gap-0.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs whitespace-nowrap shadow-card group-hover:flex",
                      i === 0 ? "start-0" : i === days.length - 1 ? "end-0" : "left-1/2 -translate-x-1/2",
                    )}
                    style={y < 0.35 ? { top: `calc(${y * 100}% + 16px)` } : above}
                  >
                    <span className="text-muted">{day(d)}</span>
                    <span>
                      {tr("العمليات", "Actions")}: <b className="num font-semibold">{num(values[i])}</b>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Under each column: the weekday (not on a phone: no room) and the day of the month. Today is the strong one. */}
        <div className="mt-2 grid text-center text-[11px] text-muted" style={columns}>
          {days.map((d) => (
            <span key={d} className={cn("flex flex-col", d === today && "font-semibold text-text")}>
              <span className="truncate max-sm:hidden">{d === today ? tr("اليوم", "Today") : weekday.format(new Date(d + "T00:00:00"))}</span>
              <span className="num">{num(Number(d.slice(8)))}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
