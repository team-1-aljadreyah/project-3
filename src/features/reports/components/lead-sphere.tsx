import { useFmt } from "@/shared/lib/i18n";
import type { TeamShares } from "../compute";

type Part = "done" | "doing" | "review" | "blocked";
// The four kinds of task, each with its sphere's two colours (light side, dark side): blush, dusty rose, mauve, wine.
const PARTS: { key: Part; ar: string; en: string; light: string; dark: string }[] = [
  { key: "done", ar: "مكتملة", en: "Done", light: "#fbeee8", dark: "#d9b0a3" },
  { key: "doing", ar: "قيد التنفيذ", en: "In progress", light: "#e9b4b0", dark: "#b96a76" },
  { key: "review", ar: "قيد المراجعة", en: "In review", light: "#c98aa3", dark: "#7f3d5b" },
  { key: "blocked", ar: "متوقفة", en: "Blocked", light: "#a8326c", dark: "#4d0a2b" },
];
// Where the small spheres sit inside the glass one, the biggest first (centre x, centre y).
const SPOTS: [number, number][] = [
  [150, 152],
  [224, 124],
  [100, 112],
  [176, 72],
];

/**
 * The top of the team leader's dashboard: a dark slide with a glass sphere. When the page opens the sphere clears and
 * shows a bowl of smaller spheres, one for each kind of task (the bigger the sphere, the more tasks), and the four
 * shares appear at the sides. Always dark, whatever the theme (styles in app/styles.css, `.sphere-slide`). Decoration
 * only: the numbers are also read out as the picture's label, and with "reduce motion" it is simply there.
 */
export function LeadSphere({ shares, team, date }: { shares: TeamShares; team: string; date: string }) {
  const { tr, num, pct } = useFmt();
  const parts = PARTS.map((p) => ({ ...p, label: tr(p.ar, p.en), value: shares[p.key], share: shares.total ? shares[p.key] / shares.total : 0 }));
  const biggest = Math.max(1, ...parts.map((p) => p.value));
  const ranked = [...parts].sort((a, b) => b.value - a.value);
  const list = (items: typeof parts) => (
    <ul className="flex flex-col gap-4">
      {items.map((p) => (
        <li key={p.key} className="flex items-center gap-3">
          <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ background: `linear-gradient(135deg, ${p.light}, ${p.dark})` }} />
          <span className="flex flex-col">
            <b dir="ltr" className="num text-start text-3xl leading-none font-light">
              {pct(p.share)}
            </b>
            <span className="mt-1 text-xs text-[#e6d3da]">{tr(`${p.label}: ${num(p.value)}`, `${p.label}: ${p.value}`)}</span>
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-labelledby="dashboard-title" className="sphere-slide relative isolate overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="grid items-stretch gap-8 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <h1 id="dashboard-title" className="hero-in text-xs font-medium text-[#e6d3da]">
              {tr("لوحة القيادة", "Dashboard")} · {date}
            </h1>
            <p className="hero-in mt-3 text-4xl leading-tight font-light sm:text-[2.6rem] sm:leading-tight">
              {tr("أين يقف", "Where the team")}
              <br />
              {tr("فريقك اليوم", "stands today")}
            </p>
          </div>
          <div className="sphere-late flex flex-col gap-4">
            <h2 className="flex items-center gap-3 text-xs font-semibold text-[#f2dace]">
              {tr("توزيع مهام الفريق", "How the team's tasks split")}
              <span aria-hidden="true" className="h-px flex-1 bg-white/25" />
            </h2>
            {list(parts.slice(0, 2))}
          </div>
        </div>

        <svg
          viewBox="0 0 320 320"
          role="img"
          aria-label={tr(`توزيع مهام الفريق: ${parts.map((p) => `${p.label} ${pct(p.share)}`).join("، ")}`, `How the team's tasks split: ${parts.map((p) => `${p.label} ${pct(p.share)}`).join(", ")}`)}
          className="mx-auto w-[min(320px,72vw)] self-center"
        >
          <defs>
            <radialGradient id="sphere-glass" cx="38%" cy="30%" r="80%">
              <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0.05" />
              <stop offset="1" stopColor="#fff" stopOpacity="0.1" />
            </radialGradient>
            <linearGradient id="sphere-bowl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2c1322" />
              <stop offset="1" stopColor="#0d070b" />
            </linearGradient>
            <radialGradient id="sphere-cover" cx="30%" cy="72%" r="85%">
              <stop offset="0" stopColor="#e3aaa8" />
              <stop offset="0.36" stopColor="#8f1f58" />
              <stop offset="0.74" stopColor="#1a0c14" />
              <stop offset="1" stopColor="#3a1830" />
            </radialGradient>
            {parts.map((p) => (
              <radialGradient key={p.key} id={`sphere-${p.key}`} cx="34%" cy="30%" r="75%">
                <stop offset="0" stopColor={p.light} />
                <stop offset="1" stopColor={p.dark} />
              </radialGradient>
            ))}
          </defs>
          <circle cx="160" cy="160" r="150" fill="url(#sphere-glass)" stroke="#fff" strokeOpacity="0.24" />
          {/* The bowl: its inside and back rim first, then the small spheres, then its front (which hides their feet). */}
          <ellipse cx="160" cy="178" rx="124" ry="34" fill="#150a11" stroke="#d49a9a" strokeWidth="2.5" />
          {ranked.map((p, i) =>
            p.value > 0 ? (
              <circle
                key={p.key}
                className="sphere-bubble"
                style={{ animationDelay: `${0.95 + i * 0.12}s` }}
                cx={SPOTS[i][0]}
                cy={SPOTS[i][1]}
                r={(i === 0 ? 20 : 14) + (i === 0 ? 40 : 30 - i * 4) * Math.sqrt(p.value / biggest)}
                fill={`url(#sphere-${p.key})`}
              />
            ) : null,
          )}
          <path d="M36 178 A124 34 0 0 0 284 178 A124 124 0 0 1 36 178 Z" fill="url(#sphere-bowl)" fillOpacity="0.94" />
          <path d="M36 178 A124 34 0 0 0 284 178" fill="none" stroke="#d49a9a" strokeWidth="2.5" />
          {/* The closed sphere, which clears when the page opens. It stays closed while the team has no tasks. */}
          <circle className={shares.total ? "sphere-cover" : undefined} cx="160" cy="160" r="150" fill="url(#sphere-cover)" stroke="#fff" strokeOpacity="0.3" />
        </svg>

        <div className="flex flex-col justify-between gap-8">
          <p className="hero-in text-sm leading-relaxed text-[#e6d3da] lg:max-w-56 lg:self-end lg:text-end">
            <b dir="auto" className="block font-semibold text-white">
              {team}
            </b>
            {shares.total
              ? tr(`مهام مفتوحة: ${num(shares.open)} · متأخرة: ${num(shares.late)}`, `Open tasks: ${shares.open} · Late: ${shares.late}`)
              : tr("لا مهام للفريق بعد.", "No tasks for the team yet.")}
          </p>
          <div className="sphere-late flex flex-col gap-4">
            <span aria-hidden="true" className="h-px w-full bg-white/25" />
            {list(parts.slice(2))}
          </div>
        </div>
      </div>
    </section>
  );
}
