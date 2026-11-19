import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * A block that arrives out of focus and settles into place when it scrolls into view (the "settle" motion; styles in
 * app/styles.css, `.reveal`). It plays once. `delay` (ms) staggers blocks next to each other. With "reduce motion" it is
 * simply there. The content is always in the page (screen readers and search see it at once).
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-shown={shown}
      className={cn("reveal", className)}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** The loading ring: the logo mark inside a turning ring of the brand colours. */
export function LoadingRing({ mark, className }: { mark: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-14 items-center justify-center", className)}>
      <svg viewBox="0 0 56 56" className="ring-spin absolute inset-0">
        <circle cx="28" cy="28" r="25" fill="none" stroke="var(--chip)" strokeWidth="3" />
        <circle cx="28" cy="28" r="25" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="40 117" />
      </svg>
      <span className="flex size-8 items-center justify-center rounded-[9px] bg-accent text-sm font-bold text-on-accent">{mark}</span>
    </span>
  );
}
