import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { type Effect, startEffect } from "../effects";
import { Art, Balloon } from "./art";

/** One moment to celebrate, already in the viewer's language. */
export interface Moment {
  /** Unique, to show each moment once. */
  key: string;
  effect: Effect;
  /** The small line above the title (the team, the day). */
  eyebrow: string;
  title: string;
  /** The sender's own words. */
  quote?: string;
  body?: string;
  /** Who sent it, and their job. */
  from?: { name: string; role: string };
  action?: { label: string; href: string };
  close: string;
}

const BALLOON_COLORS = ["#7c0e44", "#aa5e7a", "#d49a9a", "#e7bf6a", "#c9445f", "#f2dace"];

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A celebration over the whole page: confetti, fireworks or balloons (drawn by ./effects.ts and in CSS) behind a card with
 * a drawing, the title, the sender's words and a thank-you button. On the browser's own <dialog>: the keyboard stays in
 * it, Escape or the button closes it, and screen readers read the title. With "reduce motion" nothing moves: only the
 * card shows.
 */
export function CelebrationOverlay({ moment, onClose }: { moment: Moment; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const thanks = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const still = reduceMotion();
  const balloons = !still && (moment.effect === "birthday" || moment.effect === "birthday-today");

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // The keyboard starts on the thank-you button (not on the link before it).
    thanks.current?.focus();
    if (still || !canvas.current) return;
    return startEffect(canvas.current, moment.effect);
  }, [moment.effect, still]);

  return (
    // The click below is mouse-only on purpose: on a keyboard, Escape (onCancel) or the button closes it.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="cel-dialog"
    >
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-0" />
      {balloons && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          {Array.from({ length: moment.effect === "birthday" ? 11 : 6 }, (_, i) => (
            <span
              key={i}
              className="cel-balloon"
              style={{ insetInlineStart: `${(i * 37 + 7) % 92}%`, animationDuration: `${7 + (i % 4) * 1.3}s`, animationDelay: `${(i % 5) * 0.55 + (i > 5 ? 1.6 : 0)}s` }}
            >
              <span className="cel-sway" style={{ animationDelay: `${i * 0.3}s` }}>
                <Balloon color={BALLOON_COLORS[i % BALLOON_COLORS.length]} className={cn(i % 3 === 0 ? "w-14" : i % 3 === 1 ? "w-11" : "w-9")} />
              </span>
            </span>
          ))}
        </div>
      )}
      <div className={cn("cel-card", moment.effect === "big" && "cel-card-big")}>
        <div className="cel-art" aria-hidden="true">
          <span className={cn("cel-glow", moment.effect === "big" && "cel-rays")} />
          <span className="relative block size-full">
            <Art effect={moment.effect} />
          </span>
        </div>
        <p className="cel-up text-[13px] font-medium text-[#d49a9a]" style={{ animationDelay: "0.25s" }}>
          {moment.eyebrow}
        </p>
        <h2 id={titleId} dir="auto" className="cel-up text-[28px] leading-tight font-semibold text-[#faf3ef] sm:text-3xl" style={{ animationDelay: "0.35s" }}>
          {moment.title}
        </h2>
        {moment.quote && (
          <blockquote dir="auto" className="cel-up mt-1 rounded-2xl border border-[#f2dace]/12 bg-white/4 px-4 py-3 text-[15px] leading-relaxed text-[#f2dace]" style={{ animationDelay: "0.45s" }}>
            «{moment.quote}»
          </blockquote>
        )}
        {moment.body && (
          <p dir="auto" className="cel-up text-[15px] leading-relaxed text-[#e6d3da]" style={{ animationDelay: "0.45s" }}>
            {moment.body}
          </p>
        )}
        {moment.from && (
          <p className="cel-up flex items-center justify-center gap-2 text-sm text-[#e6d3da]" style={{ animationDelay: "0.55s" }}>
            <span aria-hidden="true" className="h-px w-6 bg-[#d49a9a]/50" />
            <span>
              <b className="font-semibold text-[#faf3ef]">{moment.from.name}</b> · {moment.from.role}
            </span>
            <span aria-hidden="true" className="h-px w-6 bg-[#d49a9a]/50" />
          </p>
        )}
        <div className="cel-up mt-2 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: "0.65s" }}>
          {moment.action && (
            <Link
              href={moment.action.href}
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-full border border-[#f2dace]/25 px-5 text-sm font-medium text-[#f2dace] transition-colors hover:border-[#f2dace]/60 hover:bg-white/5"
            >
              {moment.action.label}
            </Link>
          )}
          <button
            type="button"
            ref={thanks}
            onClick={onClose}
            className="inline-flex h-11 min-w-32 items-center justify-center rounded-full bg-[#f2dace] px-6 text-sm font-semibold text-[#3b0720] shadow-[0_8px_24px_-8px_rgba(242,218,206,0.6)] transition-colors hover:bg-white"
          >
            {moment.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
