import { cn } from "@/lib/utils";

/**
 * A progress bar. `planned` (0–1) draws a small mark where the plan says the work should be,
 * so "64% done of 70% planned" is visible at a glance (the brief: actual progress against the plan).
 */
export function ProgressBar({
  value,
  planned,
  label,
  className,
  barClassName = "bg-accent",
}: {
  value: number;
  planned?: number;
  label: string;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("relative h-1.5 rounded-full bg-chip", className)}
    >
      <div className={cn("h-full rounded-full", barClassName)} style={{ width: `${pct}%` }} />
      {planned !== undefined && (
        <span aria-hidden="true" className="absolute -top-[3px] h-3 w-0.5 bg-text" style={{ insetInlineStart: `${Math.round(planned * 100)}%` }} />
      )}
    </div>
  );
}
