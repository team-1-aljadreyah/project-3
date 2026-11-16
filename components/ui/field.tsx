import { cn } from "@/lib/utils";

/** A label, the field itself, and the error or hint under it. */
export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-card px-3 text-sm text-text placeholder:text-faint",
        "outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft",
        invalid && "border-danger focus:border-danger focus:ring-danger-soft",
        className,
      )}
      {...props}
    />
  );
}
