"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useFmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A modal window, on the browser's own <dialog>: it keeps the keyboard inside while open, closes on Escape,
 * and gives focus back to what opened it. `open` controls it; `onClose` runs on Escape, ✕ or a click outside.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { tr } = useFmt();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape: let React decide (it sets open=false), so the state and the window never disagree.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dark area around the window (the <dialog> itself, not its content) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-card p-0 text-text shadow-xl backdrop:bg-black/40",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={tr("إغلاق", "Close")} className="rounded-full p-1.5 text-muted hover:bg-chip hover:text-text">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
