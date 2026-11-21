import Link from "next/link";
import { cn } from "@/shared/lib/utils";

/** The label as the box's one link or button, stretched over the whole box, with a focus ring round the box. */
const COVER =
  "text-[13px] text-muted after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent";

/**
 * One number box (board D's KPI row): a label, the number, and a short note under it. With `href`, the whole box opens
 * that page (the label is the link, stretched over the box, so keyboards and screen readers get one clear link); with
 * `onClick`, the same as a button (for a box that changes something on its own page, like a filter).
 */
export function Stat({
  label,
  value,
  note,
  danger,
  href,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  /** The number and the note in red: something needs attention. */
  danger?: boolean;
  /** Where a press on the box goes. */
  href?: string;
  /** What a press on the box does, on this page. */
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-line bg-card px-4 py-3",
        (href || onClick) && "relative transition-colors focus-within:border-accent hover:border-accent",
        className,
      )}
    >
      {href ? (
        <Link href={href} className={COVER}>
          {label}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cn(COVER, "text-start")}>
          {label}
        </button>
      ) : (
        <span className="text-[13px] text-muted">{label}</span>
      )}
      <span className={cn("num text-2xl font-semibold", danger && "text-danger")}>{value}</span>
      {note && <span className={cn("text-xs", danger ? "text-danger" : "text-muted")}>{note}</span>}
    </div>
  );
}
