import { Star } from "lucide-react";
import { useId } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { SCORE_NAMES, scoreText } from "../rules";

/** Five stars, filled up to the score (a half star for .5 and above), with the score in words for screen readers. */
export function Stars({ value, size = 15, className }: { value?: number; size?: number; className?: string }) {
  const { tr } = useFmt();
  const label = value === undefined ? tr("بلا تقييم", "Not rated") : tr(`${scoreText(value)} من 5`, `${scoreText(value)} of 5`);
  return (
    <span role="img" aria-label={label} className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = value === undefined ? 0 : value >= n ? 1 : value >= n - 0.5 ? 0.5 : 0;
        return (
          <span key={n} aria-hidden="true" className="relative inline-flex" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-line-strong/60" strokeWidth={1.6} />
            {fill > 0 && (
              // A half star is the full one cut at the middle (from the start side, so it reads right in both directions).
              <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: fill === 1 ? size : size / 2 }}>
                <Star size={size} className="fill-[#e7a93b] text-[#c98a1f]" strokeWidth={1.4} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Choosing a score: five big stars as one group of radio buttons (arrows move, the name of each score is said). */
export function StarPicker({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const { tr } = useFmt();
  const name = useId();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label={tr("الدرجة", "Score")} className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="group relative cursor-pointer rounded-md p-0.5 has-focus-visible:ring-2 has-focus-visible:ring-accent">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              // A second press on the chosen star clears the score (a note alone is fine).
              onClick={() => value === n && onChange(undefined)}
              aria-label={`${n} · ${tr(SCORE_NAMES[n].ar, SCORE_NAMES[n].en)}`}
              className="sr-only"
            />
            <Star
              size={28}
              strokeWidth={1.5}
              aria-hidden="true"
              className={cn("transition-transform group-hover:scale-110", value && n <= value ? "fill-[#e7a93b] text-[#c98a1f]" : "text-line-strong")}
            />
          </label>
        ))}
      </div>
      <span className="min-w-20 text-sm text-muted">{value ? tr(SCORE_NAMES[value].ar, SCORE_NAMES[value].en) : tr("بلا درجة", "No score")}</span>
    </div>
  );
}
