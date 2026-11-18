/** The error message at the bottom of a form, read out by screen readers when it appears. */
export function FormError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {text}
    </p>
  );
}
