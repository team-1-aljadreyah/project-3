import { useId } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { SCORE_WORDS, SCORES } from "../rules";

/** The height of each step's bar, lowest first: the scale rises like a staircase. */
const STEP_HEIGHT = ["h-2", "h-3.5", "h-5", "h-6.5", "h-8"];

/**
 * The score as five small rising bars, the first `value` of them filled: the same staircase as the picker, small enough
 * for a list line or a table cell. `value` may be a decimal average (4.3 fills four and a third).
 */
export function ScoreBars({ value, large, className }: { value: number; large?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex items-end", large ? "h-6 gap-[3px]" : "h-3.5 gap-[2px]", className)}>
      {SCORES.map((s, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={s} className={cn("relative overflow-hidden rounded-[1px] bg-line-strong/45", large ? "w-[6px]" : "w-[4px]")} style={{ height: `${(i + 2) * (large ? 3.4 : 2)}px` }}>
            <span className="absolute inset-x-0 bottom-0 bg-accent" style={{ height: `${fill * 100}%` }} />
          </span>
        );
      })}
    </span>
  );
}

/** One rating's score: the number, the bars and the word ("4 ▂▃▅▆ جيد جداً"). */
export function ScoreMark({ score, className }: { score: number; className?: string }) {
  const { tr } = useFmt();
  const w = SCORE_WORDS[score];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="num text-xl leading-none font-semibold">{score}</span>
      <ScoreBars value={score} />
      <span className="text-sm font-medium">{w ? tr(w.ar, w.en) : "-"}</span>
      <span className="sr-only">{tr(`(${score} من 5)`, `(${score} of 5)`)}</span>
    </span>
  );
}

/**
 * Picking the score: five labelled steps (ضعيف، مقبول، جيد، جيد جداً، ممتاز) that rise like a staircase. It is a real
 * radio group (the browser's own radios, hidden behind the steps): Tab comes in, the arrow keys move, and a screen
 * reader hears "جيد جداً، 4 من 5". The steps up to the chosen one fill in; the chosen one is outlined and its word bold.
 */
export function ScorePicker({ value, onChange, invalid, describedBy }: { value: number | null; onChange: (score: number) => void; invalid?: boolean; describedBy?: string }) {
  const { tr } = useFmt();
  const name = useId();
  return (
    <fieldset aria-describedby={describedBy} className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{tr("الدرجة", "Score")}</legend>
      <div className={cn("grid grid-cols-5 gap-1 rounded-xl border bg-card-2 p-1", invalid ? "border-danger" : "border-line")}>
        {SCORES.map((s, i) => {
          const w = SCORE_WORDS[s];
          const chosen = value === s;
          const lit = value !== null && s <= value;
          return (
            <label
              key={s}
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-end gap-1.5 rounded-lg px-1 pt-3 pb-2 transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent",
                chosen ? "bg-card shadow-card ring-1 ring-accent" : "hover:bg-card",
              )}
            >
              <input type="radio" name={name} value={s} checked={chosen} onChange={() => onChange(s)} className="absolute inset-0 z-10 size-full cursor-pointer appearance-none opacity-0" aria-label={tr(`${w.ar}، ${s} من 5`, `${w.en}, ${s} of 5`)} />
              <span className={cn("num text-xs", chosen ? "font-semibold text-accent-ink" : "text-faint")}>{s}</span>
              <span aria-hidden="true" className={cn("w-full max-w-9 rounded-[3px] transition-colors", STEP_HEIGHT[i], lit ? "bg-accent" : "bg-line-strong/40", lit && !chosen && "opacity-55")} />
              <span className={cn("text-center text-[12px] leading-tight sm:text-[13px]", chosen ? "font-bold text-text" : "text-muted")}>{tr(w.ar, w.en)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
