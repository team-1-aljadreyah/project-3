import { cn } from "@/shared/lib/utils";

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

const control = (invalid?: boolean) =>
  cn(
    "w-full rounded-lg border border-line bg-card px-3 text-sm text-text placeholder:text-faint",
    "outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-60",
    invalid && "border-danger focus:border-danger focus:ring-danger-soft",
  );

/** The error under a field is linked to it, so a screen reader reads it with the field. */
const describedBy = (invalid?: boolean, id?: string) => (invalid && id ? `${id}-error` : undefined);

export function Input({ className, invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(invalid, props.id)}
      className={cn(control(invalid), "h-11", className)}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(invalid, props.id)}
      className={cn(control(invalid), "min-h-24 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

/** The browser's own select (works with the keyboard and phones' pickers), in our style. */
export function Select({ className, invalid, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(invalid, props.id)}
      className={cn(control(invalid), "h-11 pe-8", className)}
      {...props}
    />
  );
}
