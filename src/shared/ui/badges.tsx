import { useFmt } from "@/shared/lib/i18n";
import type { Priority, StatusTone, TaskStatus } from "@/shared/api/types";
import { cn } from "@/shared/lib/utils";
import { PRIORITY, TONE_CLASS } from "./tones";

/** A soft rounded label in a status family's colour. */
export function Pill({ tone, className, children }: { tone: StatusTone; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASS[tone].pill, className)}>{children}</span>;
}

/** A task status, in the current language. */
export function StatusPill({ status, className }: { status: TaskStatus; className?: string }) {
  const { lang } = useFmt();
  return (
    <Pill tone={status.tone} className={className}>
      {lang === "en" ? status.name_en : status.name}
    </Pill>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const { tr } = useFmt();
  const p = PRIORITY[priority];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", p.pill)}>{tr(p.ar, p.en)}</span>;
}
