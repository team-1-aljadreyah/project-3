import { useState } from "react";
import type { StatusTone } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { TONE_CLASS } from "@/shared/ui";
import { arcPath, pointAt, ringPiece, ringSegments } from "../chart-shapes";
import { toneName, type ToneSlice } from "../my-summary";

/** Each status family's colour for a chart line (the tokens of app/styles.css; the legend's dots use TONE_CLASS). */
const TONE_LINE: Record<StatusTone, string> = {
  new: "var(--st-new-ink)",
  todo: "var(--st-todo-ink)",
  progress: "var(--st-progress-ink)",
  review: "var(--st-review-ink)",
  testing: "var(--st-testing-ink)",
  done: "var(--st-done-ink)",
  blocked: "var(--st-blocked-ink)",
};

// The ring, in the units of its 160 x 160 drawing: the middle, the hole and the rim, the gap between two pieces, and
// how round a piece's corners are (each piece is drawn smaller by CORNER, then a line that thick rounds it off).
const MID = 80;
const INNER = 46;
const OUTER = 68;
const GAP = 3;
const CORNER = 4;
// The least every piece gets, in turns: its two rounded ends and the gap, and a little length of its own.
const PAD = (2 * Math.asin((GAP / 2 + CORNER) / (INNER + CORNER))) / (2 * Math.PI) + 0.004;

/**
 * My tasks by status family as a ring: one rounded piece per family with a small gap between them, the total in the
 * middle, and a floating label with the share of the largest family (or of the one under the pointer). The legend
 * beside it names every family with its count, so nothing depends on telling the colours apart.
 */
export function StatusRing({ slices, total }: { slices: ToneSlice[]; total: number }) {
  const { tr, num, pct } = useFmt();
  // The family under the pointer: it stays bright and the others fade, on the ring and in the legend.
  const [pointed, setPointed] = useState<StatusTone | null>(null);
  if (slices.length === 0) return null;
  // A refresh can take the pointed family away (its last task moved on): then nothing is picked.
  const hot = slices.some((s) => s.tone === pointed) ? pointed : null;

  const name = (tone: StatusTone) => tr(toneName(tone).ar, toneName(tone).en);
  const pieces = ringSegments(slices.map((s) => s.share), PAD);
  const largest = slices.reduce((a, b) => (b.count > a.count ? b : a));
  const labelled = slices.findIndex((s) => s.tone === (hot ?? largest.tone));
  // The floating label sits on the rim, at the middle of its piece.
  const label = pointAt(MID, MID, OUTER, (pieces[labelled].from + pieces[labelled].to) / 2);
  const said = slices.map((s) => `${name(s.tone)} ${num(s.count)}`);

  return (
    <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-x-5 gap-y-4">
      <div className="relative size-36 shrink-0">
        <svg
          viewBox="0 0 160 160"
          role="img"
          aria-label={tr(`مهامي حسب الحالة: ${said.join("، ")}`, `My tasks by status: ${said.join(", ")}`)}
          className="size-full"
        >
          {slices.length === 1 ? (
            // One family only: a whole ring, with no gap to draw.
            <circle cx={MID} cy={MID} r={(INNER + OUTER) / 2} fill="none" stroke={TONE_LINE[slices[0].tone]} strokeWidth={OUTER - INNER} />
          ) : (
            slices.map((s, i) => (
              <path
                key={s.tone}
                d={ringPiece(MID, MID, INNER + CORNER, OUTER - CORNER, pieces[i].from, pieces[i].to, GAP / 2 + CORNER)}
                fill={TONE_LINE[s.tone]}
                stroke={TONE_LINE[s.tone]}
                strokeWidth={CORNER * 2}
                strokeLinejoin="round"
                className={cn("transition-opacity", hot && hot !== s.tone && "opacity-25")}
                onPointerEnter={() => setPointed(s.tone)}
                onPointerLeave={() => setPointed(null)}
              >
                <title>{`${name(s.tone)}: ${num(s.count)}`}</title>
              </path>
            ))
          )}
        </svg>
        {/* The words on the drawing are for the eye only: the drawing's own name already says every number. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
          {/* A total in the thousands is set smaller, so it stays inside the hole. */}
          <span className={cn("leading-none font-semibold", total < 1000 ? "text-3xl" : "text-xl")}>{num(total)}</span>
          <span className="text-xs text-muted">{tr("المجموع", "total")}</span>
        </span>
        {slices.length > 1 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-card px-2 py-0.5 text-xs font-semibold shadow-card"
            style={{ left: `${(label.x / 160) * 100}%`, top: `${(label.y / 160) * 100}%` }}
          >
            {pct(slices[labelled].share)}
          </span>
        )}
      </div>

      <ul className="flex max-w-60 min-w-28 flex-1 flex-col gap-1.5 text-[13px]">
        {slices.map((s) => (
          <li
            key={s.tone}
            className={cn("flex items-center gap-2 transition-opacity", hot && hot !== s.tone && "opacity-40")}
            onPointerEnter={() => setPointed(s.tone)}
            onPointerLeave={() => setPointed(null)}
          >
            <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", TONE_CLASS[s.tone].bar)} />
            <span className="min-w-0 flex-1 truncate">{name(s.tone)}</span>
            <span className="num font-semibold">{num(s.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A share (0–1) as a half ring with the percentage in the middle. It fills from the reading side, like the progress
 * bars: from the left in English, from the right in Arabic (the drawing is mirrored; it holds no text).
 */
export function HalfGauge({ value, label, caption }: { value: number; label: string; caption: string }) {
  const { pct } = useFmt();
  const share = Math.min(1, Math.max(0, value));
  // The half ring runs from the left (0.75 of a turn) over the top to the right (1.25).
  const end = 0.75 + share / 2;
  const knob = pointAt(100, 100, 84, end);

  return (
    <div className="relative mx-auto w-full max-w-60">
      <svg viewBox="0 0 200 112" role="img" aria-label={label} className="block w-full rtl:-scale-x-100">
        <path d={arcPath(100, 100, 84, 0.75, 1.25)} fill="none" stroke="var(--chip)" strokeWidth="16" strokeLinecap="round" />
        {share > 0 && <path d={arcPath(100, 100, 84, 0.75, end)} fill="none" stroke="var(--accent)" strokeWidth="16" strokeLinecap="round" />}
        {/* The knob marks where the share ends (at the very start when nothing is done yet). */}
        <circle cx={knob.x} cy={knob.y} r="7" fill="var(--card)" stroke="var(--accent)" strokeWidth="4" />
      </svg>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[8%] flex flex-col items-center gap-1">
        <span className="text-3xl leading-none font-semibold">{pct(share)}</span>
        <span className="text-xs text-muted">{caption}</span>
      </span>
    </div>
  );
}
