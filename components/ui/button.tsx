import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line bg-card text-text hover:bg-card-2",
  ghost: "text-muted hover:bg-chip hover:text-text",
};

const SIZE: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-[13px]",
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50";

export function Button({
  variant = "primary",
  size = "md",
  pill,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; pill?: boolean }) {
  return <button type="button" className={cn(base, VARIANT[variant], SIZE[size], pill && "rounded-full", className)} {...props} />;
}

/** A link that looks like a button. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  pill,
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size; pill?: boolean }) {
  return <Link className={cn(base, VARIANT[variant], SIZE[size], pill && "rounded-full", className)} {...props} />;
}

/** A round button with only an icon. `label` is read by screen readers and shown as a tooltip. */
export function IconButton({ label, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-bg text-text transition-colors hover:bg-chip", className)}
      {...props}
    />
  );
}
