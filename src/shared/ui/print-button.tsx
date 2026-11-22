import { Printer } from "lucide-react";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

/**
 * Print one part of a page (a note, a list, a report): only that part goes on the paper, under the platform's name and
 * the date. The browser's print window also offers "Save as PDF", so this one button is both print and PDF.
 * `target` finds the part to print (an element, or a function that returns it when pressed).
 */
export function printPart(el: HTMLElement | null) {
  if (!el) return window.print();
  const body = document.body;
  el.classList.add("print-target");
  body.classList.add("print-one");
  const done = () => {
    el.classList.remove("print-target");
    body.classList.remove("print-one");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  // Some browsers don't send "afterprint": clean up soon anyway (the print window has copied the page by then).
  setTimeout(done, 1000);
}

export function PrintButton({ target, label, compact, className }: { target: () => HTMLElement | null; label?: string; compact?: boolean; className?: string }) {
  const { tr } = useFmt();
  const text = label ?? tr("اطبع أو احفظ PDF", "Print or save as PDF");
  return (
    <button
      type="button"
      onClick={() => printPart(target())}
      aria-label={compact ? text : undefined}
      title={text}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full text-sm text-muted hover:bg-chip hover:text-text print:hidden",
        compact ? "size-8 justify-center" : "h-9 border border-line px-3",
        className,
      )}
    >
      <Printer size={15} aria-hidden="true" />
      {!compact && <span>{text}</span>}
    </button>
  );
}
