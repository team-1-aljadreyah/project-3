import { cn } from "@/shared/lib/utils";

/**
 * The platform's logo, «لوحة» (the board), chosen by the client on 21 November 2026: a task board read right to left,
 * like the app's own board. Cards pile up column by column into "done" (on the left), whose top card carries the
 * check, and the next card is on its way. The columns rise like progress.
 *
 * - `size`: "full" draws the card in flight (for 40 px and up); "small" keeps only the columns, which stay sharp at
 *   16–32 px (the top bar, the browser tab, the loading ring).
 * - `on`: what it sits on. "page" follows the theme (`--brand-a…d` in app/styles.css); "accent" is for a wine tile (the
 *   app icon look: light columns on wine); "light" keeps the light-theme colours on any background (the welcome card).
 *
 * Decoration next to the platform's written name, so it is hidden from screen readers unless given a `label`.
 */
export function BrandMark({ size = "small", on = "page", label, className }: { size?: "full" | "small"; on?: "page" | "accent" | "light"; label?: string; className?: string }) {
  const c =
    on === "accent"
      ? { a: "#f2dace", b: "#d49a9a", c: "#c07a92", d: "#5c0a32" }
      : on === "light"
        ? { a: "#7c0e44", b: "#aa5e7a", c: "#d49a9a", d: "#f2dace" }
        : { a: "var(--brand-a)", b: "var(--brand-b)", c: "var(--brand-c)", d: "var(--brand-d)" };
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {size === "full" ? (
        <>
          <rect x="44" y="45" width="13" height="10" rx="3" fill={c.c} />
          <rect x="25.5" y="45" width="13" height="10" rx="3" fill={c.b} />
          <rect x="25.5" y="32" width="13" height="10" rx="3" fill={c.b} />
          <rect x="7" y="45" width="13" height="10" rx="3" fill={c.a} />
          <rect x="7" y="32" width="13" height="10" rx="3" fill={c.a} />
          <rect x="7" y="19" width="13" height="10" rx="3" fill={c.a} />
          <path d="M10.3 24 l2.4 2.4 l4.2 -4.8" fill="none" stroke={c.d} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="44" y="30" width="13" height="10" rx="3" fill="none" stroke={c.c} strokeWidth="2" strokeDasharray="3 2.6" />
          <path d="M41 25 C 34 17, 26 14, 20 14" fill="none" stroke={c.c} strokeWidth="2" strokeLinecap="round" strokeDasharray="0.1 4" />
          <path d="M23 11.5 L19.6 14 L23 16.6" fill="none" stroke={c.c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <rect x="44" y="41" width="13" height="14" rx="3.5" fill={c.c} />
          <rect x="25.5" y="41" width="13" height="14" rx="3.5" fill={c.b} />
          <rect x="25.5" y="24" width="13" height="14" rx="3.5" fill={c.b} />
          <rect x="7" y="41" width="13" height="14" rx="3.5" fill={c.a} />
          <rect x="7" y="24" width="13" height="14" rx="3.5" fill={c.a} />
          <rect x="7" y="7" width="13" height="14" rx="3.5" fill={c.a} />
        </>
      )}
    </svg>
  );
}
