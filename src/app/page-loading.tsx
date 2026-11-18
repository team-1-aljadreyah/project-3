import { useEffect, useState } from "react";
import { useFmt } from "@/shared/lib/i18n";

/**
 * Shown while the first page's code downloads (the pages load lazily, see routes.tsx).
 * Most loads take a moment, so the spinner waits 300 ms before it appears: a fast load shows nothing at all,
 * instead of a spinner that flashes and is gone.
 */
export function PageLoading() {
  const { tr } = useFmt();
  // false at first; becomes true after 300 ms (if this screen is still here).
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 300);
    // The page arrived first: this screen is removed, so cancel the timer.
    return () => clearTimeout(timer);
  }, []);

  return (
    // role="status": screen readers say "Loading…" without moving the focus.
    <div role="status" className="flex min-h-dvh items-center justify-center">
      <span className="sr-only">{tr("جارٍ التحميل…", "Loading…")}</span>
      {show && (
        <span
          aria-hidden="true"
          className="size-8 animate-spin rounded-full border-[3px] border-line border-t-accent motion-reduce:animate-none"
        />
      )}
    </div>
  );
}
