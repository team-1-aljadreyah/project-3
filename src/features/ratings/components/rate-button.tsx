import { Gauge } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { SCORE_WORDS, scoreStep } from "../rules";
import type { Rating, RatingSummary } from "../types";
import { RatingDialog, type RatingTarget } from "./rating-dialog";
import { ScoreBars } from "./score-scale";

/**
 * A small "Rate" button that opens the rating window for one team or person. It sits above a row's stretched link
 * (`relative z-10`), so pressing it never opens the row.
 */
export function RateButton({ target, className, onSaved }: { target: RatingTarget; className?: string; onSaved?: (r: Rating) => void }) {
  const { tr } = useFmt();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tr(`قيّم ${target.name}`, `Rate ${target.name}`)}
        className={cn(
          "relative z-10 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line bg-card px-2.5 text-[13px] font-medium text-text transition-colors hover:border-accent hover:text-accent-ink",
          className,
        )}
      >
        <Gauge size={14} aria-hidden="true" />
        {tr("قيّم", "Rate")}
      </button>
      {open && <RatingDialog target={target} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

/**
 * The average of some ratings in a line: "4.3 ▂▃▅▆ (5)", or a dash when there are none. With `href`, it opens the ratings
 * (above a row's stretched link, like the button).
 */
export function AverageMark({ summary, href, className }: { summary: Pick<RatingSummary, "average" | "count">; href?: string; className?: string }) {
  const { tr, num } = useFmt();
  if (summary.average === null) return <span className={cn("text-xs text-faint", className)}>{tr("لا تقييم", "Not rated")}</span>;
  const w = SCORE_WORDS[scoreStep(summary.average)];
  const label = tr(`متوسط التقييم ${summary.average.toFixed(1)} من 5 (${w.ar})، ${num(summary.count)} تقييم`, `Average rating ${summary.average.toFixed(1)} of 5 (${w.en}), ${summary.count} rating${summary.count === 1 ? "" : "s"}`);
  const body = (
    <>
      <span className="num font-semibold text-text">{summary.average.toFixed(1)}</span>
      <ScoreBars value={summary.average} />
      <span className="num text-xs text-muted">({num(summary.count)})</span>
    </>
  );
  const cls = cn("inline-flex items-center gap-1.5 text-sm whitespace-nowrap", className);
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cn(cls, "relative z-10 rounded-md hover:underline")}>
      {body}
    </Link>
  ) : (
    <span role="img" aria-label={label} title={label} className={cls}>
      {body}
    </span>
  );
}
