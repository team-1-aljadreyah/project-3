import { useFmt } from "@/shared/lib/i18n";
import type { Priority, StatusTone, TaskStatus } from "@/shared/api/types";
import { cn } from "@/shared/lib/utils";
import { PRIORITY, TONE_CLASS } from "./tones";

/** The tag's frame: a thin outline, slightly squared corners, the text in the page's own colour. */
const TAG = "inline-flex items-center gap-1.5 rounded-[5px] border border-line bg-card px-1.5 py-px text-xs leading-5 font-medium whitespace-nowrap text-text";

/**
 * A label in a status family's colour: a small coloured dot before plain text (the colour carries the meaning, the
 * text stays easy to read). "Blocked" also colours its text, since it asks for attention.
 */
export function Pill({ tone, className, children }: { tone: StatusTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn(TAG, tone === "blocked" && TONE_CLASS.blocked.text, className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", TONE_CLASS[tone].bar)} />
      {children}
    </span>
  );
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

/** A priority: signal bars (one for low, two for medium, three for high) before its name. */
export function PriorityPill({ priority }: { priority: Priority }) {
  const { tr } = useFmt();
  const p = PRIORITY[priority];
  const lit = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  return (
    <span className={TAG}>
      <svg aria-hidden="true" viewBox="0 0 12 12" className={cn("size-3 shrink-0", p.text)}>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={1 + i * 4} y={8 - i * 3} width="2.5" height={3 + i * 3} rx="0.75" fill="currentColor" opacity={i < lit ? 1 : 0.25} />
        ))}
      </svg>
      {tr(p.ar, p.en)}
    </span>
  );
}
