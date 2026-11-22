import Link from "next/link";
import { Greeting } from "@/shared/ui";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import type { ProjectRow } from "../types";

// The orbits (radius x, radius y) and how long one turn takes, the inner one fastest.
const ORBITS: { rx: number; ry: number; turn: number }[] = [
  { rx: 92, ry: 92, turn: 70 },
  { rx: 124, ry: 124, turn: 95 },
  { rx: 150, ry: 150, turn: 120 },
];
const C = 160;
// The progress ring around the centre.
const RING = 52;
const RING_LENGTH = 2 * Math.PI * RING;

/**
 * The top of the department manager's dashboard, next to the team leader's sphere slide (same night colours,
 * `.sphere-slide`): a greeting, and their projects as small planets turning around the department's progress. When the
 * page opens the orbits draw themselves, the ring fills to the overall progress and the planets arrive and start
 * turning slowly; a planet behind its plan is the deep wine one. The projects are also listed as links at the side, and
 * the picture has a label with the same numbers. With "reduce motion" it is simply there, still.
 */
export function PmOrbit({ user, projects, date }: { user: Pick<User, "id" | "name" | "name_en">; projects: ProjectRow[]; date: string }) {
  const { tr, lang, num, pct } = useFmt();
  const mine = projects.filter((p) => p.pm_id === user.id && p.state !== "done").sort((a, b) => b.total - a.total);
  const total = mine.reduce((s, p) => s + p.total, 0);
  const done = mine.reduce((s, p) => s + p.done, 0);
  const late = mine.reduce((s, p) => s + p.late, 0);
  const behind = mine.filter((p) => p.behind || p.overdue).length;
  const ratio = total ? done / total : 0;
  const biggest = Math.max(1, ...mine.map((p) => p.total));
  const nameOf = (p: ProjectRow) => (lang === "en" && p.name_en ? p.name_en : p.name);

  // Up to three planets on each orbit, spaced around it.
  const planets = mine.slice(0, 9).map((p, i) => {
    const orbit = i % 3;
    const onOrbit = mine.slice(0, 9).filter((_, j) => j % 3 === orbit).length;
    const slot = Math.floor(i / 3);
    const angle = (slot / onOrbit) * 2 * Math.PI + orbit * 0.9 - Math.PI / 2;
    const { rx, ry } = ORBITS[orbit];
    return { p, orbit, x: C + rx * Math.cos(angle), y: C + ry * Math.sin(angle), r: 6 + 8 * Math.sqrt(p.total / biggest), late: p.behind || p.overdue };
  });

  return (
    <section aria-labelledby="dashboard-title" className="sphere-slide relative isolate overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-6">
          <div>
            <h1 id="dashboard-title" className="hero-in text-xs font-medium text-[#e6d3da]">
              {tr("لوحة التحكم", "Dashboard")} · {date}
            </h1>
            <Greeting user={user} className="mt-3" />
            <p className="hero-in mt-3 max-w-72 text-sm leading-relaxed text-[#e6d3da]">
              {mine.length ? (
                <>
                  {tr("مشاريع قسمك تدور حول هدف واحد.", "Your department's projects turn around one goal.")}
                  <br />
                  {tr(`الجارية اليوم: ${num(mine.length)}`, `Running today: ${mine.length}`)}
                </>
              ) : (
                tr("لا مشاريع جارية في قسمك بعد.", "No running projects in your department yet.")
              )}
            </p>
          </div>
          <dl className="orbit-late grid grid-cols-3 gap-3 border-t border-white/20 pt-4">
            {[
              { label: tr("الإنجاز", "Progress"), value: pct(ratio) },
              { label: tr("مهام متأخرة", "Late tasks"), value: num(late), alert: late > 0 },
              { label: tr("خلف الخطة", "Behind plan"), value: num(behind), alert: behind > 0 },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <dt className="text-[11px] text-[#e6d3da]">{s.label}</dt>
                <dd dir="ltr" className={`num text-start text-2xl leading-none font-light ${s.alert ? "text-[#f4a3b8]" : ""}`}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <svg
          viewBox="0 0 320 320"
          role="img"
          aria-label={tr(
            `مشاريع قسمك: ${mine.map((p) => `${nameOf(p)} ${pct(p.ratio)}`).join("، ")}. الإنجاز الكلي ${pct(ratio)}.`,
            `Your department's projects: ${mine.map((p) => `${nameOf(p)} ${pct(p.ratio)}`).join(", ")}. Overall progress ${pct(ratio)}.`,
          )}
          className="mx-auto w-[min(300px,72vw)]"
        >
          <defs>
            <radialGradient id="orbit-core" cx="38%" cy="32%" r="75%">
              <stop offset="0" stopColor="#f2dace" />
              <stop offset="0.45" stopColor="#b96a76" />
              <stop offset="1" stopColor="#4d0a2b" />
            </radialGradient>
            <radialGradient id="orbit-on" cx="34%" cy="30%" r="75%">
              <stop offset="0" stopColor="#fbeee8" />
              <stop offset="1" stopColor="#c98aa3" />
            </radialGradient>
            <radialGradient id="orbit-behind" cx="34%" cy="30%" r="75%">
              <stop offset="0" stopColor="#e27aa0" />
              <stop offset="1" stopColor="#6d0d3a" />
            </radialGradient>
          </defs>
          {ORBITS.map((o, i) => (
            <ellipse key={i} className="orbit-path" style={{ animationDelay: `${0.15 + i * 0.15}s` }} cx={C} cy={C} rx={o.rx} ry={o.ry} fill="none" stroke="#fff" strokeOpacity="0.18" strokeDasharray="1000" pathLength="1000" />
          ))}
          {/* The department's progress: a soft sun with a ring that fills to it. */}
          <circle cx={C} cy={C} r="40" fill="url(#orbit-core)" className="orbit-sun" />
          <circle cx={C} cy={C} r={RING} fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="4" />
          <circle
            cx={C}
            cy={C}
            r={RING}
            fill="none"
            stroke="#f2dace"
            strokeWidth="4"
            strokeLinecap="round"
            transform={`rotate(-90 ${C} ${C})`}
            strokeDasharray={RING_LENGTH}
            className="orbit-ring"
            style={{ "--ring-from": RING_LENGTH, "--ring-to": RING_LENGTH * (1 - ratio) } as React.CSSProperties}
            strokeDashoffset={RING_LENGTH * (1 - ratio)}
          />
          <text x={C} y={C + 6} textAnchor="middle" className="num" fill="#fff" fontSize="18" fontWeight="300">
            {pct(ratio)}
          </text>
          {ORBITS.map((o, orbit) => (
            <g key={orbit} className="orbit-turn" style={{ animationDuration: `${o.turn}s`, animationDirection: orbit === 1 ? "reverse" : "normal" }}>
              {planets
                .filter((pl) => pl.orbit === orbit)
                .map((pl, i) => (
                  <circle key={pl.p.id} className="orbit-planet" style={{ animationDelay: `${0.7 + (orbit + i * 3) * 0.08}s` }} cx={pl.x} cy={pl.y} r={pl.r} fill={pl.late ? "url(#orbit-behind)" : "url(#orbit-on)"} />
                ))}
            </g>
          ))}
        </svg>

        <div className="orbit-late flex flex-col gap-3">
          <h2 className="flex items-center gap-3 text-xs font-semibold text-[#f2dace]">
            {tr("مشاريع قسمك", "Your department's projects")}
            <span aria-hidden="true" className="h-px flex-1 bg-white/25" />
          </h2>
          {mine.length === 0 ? (
            <p className="text-sm text-[#e6d3da]">{tr("حين تنشئ مشروعاً يظهر هنا.", "A project you create shows here.")}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {mine.slice(0, 4).map((p) => {
                const late = p.behind || p.overdue;
                return (
                  // The whole line opens the project.
                  <li key={p.id} className="relative flex items-center gap-3">
                    <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: late ? "linear-gradient(135deg,#e27aa0,#6d0d3a)" : "linear-gradient(135deg,#fbeee8,#c98aa3)" }} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link href={`/projects/${p.id}`} dir="auto" className="truncate text-sm text-white after:absolute after:inset-0 hover:underline focus-visible:outline-white">
                        {nameOf(p)}
                      </Link>
                      <span aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-white/15">
                        <span className="block h-full rounded-full bg-[#f2dace]" style={{ width: `${Math.round(p.ratio * 100)}%` }} />
                      </span>
                    </span>
                    <span dir="ltr" className={`num w-11 text-end text-xs ${late ? "text-[#f4a3b8]" : "text-[#e6d3da]"}`}>
                      {pct(p.ratio)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {mine.length > 4 && (
            <Link href="/" className="self-start text-xs text-[#e6d3da] underline-offset-4 hover:underline focus-visible:outline-white">
              {tr(`كل المشاريع (${num(mine.length)})`, `All projects (${mine.length})`)}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
