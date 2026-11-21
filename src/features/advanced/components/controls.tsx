// The building blocks of every part of the advanced settings: a card of settings (Part), one setting (Row) with
// «Changed» and the way back to the default, and the controls (a switch, chips, a choice of a few, a number box).
import { Lock, RotateCcw } from "lucide-react";
import { useId } from "react";
import type { Tr } from "@/shared/lib/i18n";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Input, Pill } from "@/shared/ui";
import type { AdvancedRules } from "../types";

/** What every part gets: the draft, what is saved, a way to change the draft, and the mistakes by field. */
export interface Ctx {
  r: AdvancedRules;
  set: (patch: Partial<AdvancedRules>) => void;
  errors: Record<string, string>;
  tr: Tr;
}

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A card of settings with a title (a real heading) and a line under it. */
export function Part({ title, sub, icon, action, children, className }: { title: string; sub?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("overflow-hidden rounded-2xl border border-line bg-card shadow-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id={id} className="flex items-center gap-2 text-[17px] font-semibold">
            {icon}
            {title}
          </h2>
          {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

/**
 * One setting: its name and what it does on one side, the control on the other. When it differs from the default the
 * row is tinted, says «Changed», and offers the default back. A mistake shows in red under the control as you type.
 */
export function Row({
  label,
  hint,
  changed,
  onDefault,
  defText,
  error,
  errorId,
  wide,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  changed?: boolean;
  onDefault?: () => void;
  defText?: string;
  error?: string;
  /** The id of the error line, for the control's aria-describedby. */
  errorId?: string;
  /** The control takes the whole width under the name (lists, tables). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { tr } = useFmt();
  return (
    <div
      data-changed={changed || undefined}
      className={cn(
        "grid gap-3 border-b border-line px-5 py-4 last:border-0",
        !wide && "sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:items-center sm:gap-6",
        changed && "bg-(--st-review)/40",
      )}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {label}
          {changed && <Pill tone="review">{tr("معدَّل", "Changed")}</Pill>}
        </p>
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-muted">{hint}</p>}
        {changed && onDefault && (
          <button type="button" onClick={onDefault} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            <RotateCcw size={12} aria-hidden="true" />
            {tr("الافتراضي", "Default")}
            {defText ? `: ${defText}` : ""}
          </button>
        )}
      </div>
      <div className="min-w-0">
        {children}
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** An on/off switch (a real switch for screen readers), with the state written beside it. */
export function Switch({ checked, onChange, label, text, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; text?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-3 rounded-full text-sm disabled:opacity-60"
    >
      <span className={cn("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors", checked ? "justify-end bg-accent" : "justify-start bg-line-strong/60")}>
        <span className="size-5 rounded-full bg-card shadow-sm transition-transform group-active:scale-90" />
      </span>
      {text && <span className={cn("font-medium", checked ? "text-text" : "text-muted")}>{text}</span>}
    </button>
  );
}

/** Pick several (jobs, days). Locked chips can't change. */
export function Chips<T extends string | number>({ value, options, onChange, locked = [], label }: { value: T[]; options: { v: T; l: string }[]; onChange: (v: T[]) => void; locked?: T[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.v);
        const lock = locked.includes(o.v);
        return (
          <button
            key={String(o.v)}
            type="button"
            disabled={lock}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.v) : [...value, o.v])}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors",
              on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-card text-muted hover:border-line-strong hover:text-text",
              lock && "cursor-not-allowed opacity-70",
            )}
          >
            {lock && <Lock size={11} aria-hidden="true" />}
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

/** Choose one of a few, side by side. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-chip/50 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn("min-h-9 flex-1 rounded-lg px-3 text-[13px] whitespace-nowrap transition-colors", value === o.v ? "bg-card font-semibold text-text shadow-sm" : "text-muted hover:text-text")}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

/** A whole number box with its unit inside. An emptied box keeps NaN, so the check marks it. */
export function NumberBox({ value, onChange, unit, label, invalid, errorId }: { value: number; onChange: (v: number) => void; unit?: string; label: string; invalid?: boolean; errorId?: string }) {
  return (
    <div className="relative">
      <Input
        type="number"
        inputMode="numeric"
        dir="ltr"
        aria-label={label}
        invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
        className={cn("num text-left", unit && "pr-20")}
      />
      {/* The number reads left to right in both languages, so its unit sits on the right. */}
      {unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-faint">{unit}</span>}
    </div>
  );
}

/** A number setting: the row and its box together. */
export function NumRow({ c, label, hint, value, def, put, unit, field }: { c: Ctx; label: string; hint?: string; value: number; def: number; put: (v: number) => void; unit?: string; field: string }) {
  const errorId = useId();
  const error = c.errors[field];
  return (
    <Row label={label} hint={hint} changed={!same(value, def)} onDefault={() => put(def)} defText={`${def}${unit ? ` ${unit}` : ""}`} error={error} errorId={errorId}>
      <NumberBox value={value} onChange={put} unit={unit} label={label} invalid={!!error} errorId={errorId} />
    </Row>
  );
}

/** A yes/no setting. */
export function FlagRow({ c, label, hint, value, def, put }: { c: Ctx; label: string; hint?: string; value: boolean; def: boolean; put: (v: boolean) => void }) {
  const { tr } = c;
  return (
    <Row label={label} hint={hint} changed={value !== def} onDefault={() => put(def)} defText={def ? tr("مفعّل", "On") : tr("متوقف", "Off")}>
      <Switch checked={value} onChange={put} label={label} text={value ? tr("مفعّل", "On") : tr("متوقف", "Off")} />
    </Row>
  );
}

/** A short blue note at the top of a part. */
export function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-(--st-testing-ink)/20 bg-(--st-testing) px-4 py-3 text-[13px] leading-relaxed text-(--st-testing-ink)">{children}</p>;
}
