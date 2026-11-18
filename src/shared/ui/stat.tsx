import { cn } from "@/shared/lib/utils";

/** One number box (board D's KPI row): a label, the number, and a short note under it. */
export function Stat({
  label,
  value,
  note,
  danger,
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  /** The number and the note in red: something needs attention. */
  danger?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border border-line bg-card px-4 py-3", className)}>
      <span className="text-[13px] text-muted">{label}</span>
      <span className={cn("num text-2xl font-semibold", danger && "text-danger")}>{value}</span>
      {note && <span className={cn("text-xs", danger ? "text-danger" : "text-muted")}>{note}</span>}
    </div>
  );
}
