import { useCallback, useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { ToastContext, type ToastTone } from "./use-toast";

interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

/** Short messages at the bottom of the screen ("Saved", "Sent for approval"). Screen readers hear them too. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((text: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <p
            key={t.id}
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg",
              t.tone === "success" && "bg-text text-bg",
              t.tone === "danger" && "bg-danger text-card",
              t.tone === "info" && "bg-accent text-on-accent",
            )}
          >
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

