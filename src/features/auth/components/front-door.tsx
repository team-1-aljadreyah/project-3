// The front door's moving parts (the sign-in page): the ring that counts the page in, the tilting
// glass window with a live task, the plate that opens out of the logo, and the sections that settle into focus. Motion
// is decoration only: everything works and reads the same with "reduce motion" (styles in app/styles.css).
import { useEffect, useRef, useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { BrandMark, Frost, Pill, Reveal } from "@/shared/ui";

const INTRO_KEY = "p3.intro";
const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

/** Will the ring count the page in on this visit? (Once per browser tab, never with "reduce motion" or in a background tab.) */
export function introPlays() {
  try {
    // Not in a background tab either: the browser slows its timers, and the ring would wait there.
    return !sessionStorage.getItem(INTRO_KEY) && !reducedMotion() && document.visibilityState === "visible";
  } catch {
    return false;
  }
}

/**
 * The ring that counts the page in (0 → 100), then folds away into the logo. Once per visit (this browser tab), never
 * with "reduce motion". It never blocks a click (pointer-events: none) and is gone after two seconds.
 */
export function IntroRing({ target, onLand }: { target: React.RefObject<HTMLElement | null>; onLand: () => void }) {
  const [playing, setPlaying] = useState(introPlays);
  const [count, setCount] = useState(0);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {}
    // Where the logo is, so the ring folds into it.
    const box = target.current?.getBoundingClientRect();
    if (box && ring.current) {
      ring.current.style.setProperty("--to-x", `${box.left + box.width / 2 - window.innerWidth / 2}px`);
      ring.current.style.setProperty("--to-y", `${box.top + box.height / 2 - window.innerHeight / 2}px`);
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - start - 100) / 1050);
      setCount(Math.max(0, Math.round((1 - (1 - p) ** 3) * 100)));
      if (p < 1) frame = requestAnimationFrame(tick);
    });
    const land = setTimeout(onLand, 1450);
    const done = setTimeout(() => setPlaying(false), 2000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(land);
      clearTimeout(done);
    };
  }, [playing, target, onLand]);

  if (!playing) return null;
  return (
    <div className="intro" aria-hidden="true">
      <div ref={ring} className="intro-ring relative grid size-28 place-items-center">
        <svg viewBox="0 0 112 112" className="absolute inset-0 -rotate-90">
          <circle cx="56" cy="56" r="48" fill="none" stroke="#33202a" strokeWidth="4" />
          <circle className="intro-arc" cx="56" cy="56" r="48" fill="none" stroke="#d49a9a" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span className="num text-2xl font-semibold text-[#f2dace]">{count}</span>
      </div>
    </div>
  );
}

const STAGES = [
  { key: "new", ar: "جديدة", en: "New", tone: "new" },
  { key: "progress", ar: "قيد التنفيذ", en: "In progress", tone: "progress" },
  { key: "review", ar: "قيد المراجعة", en: "In review", tone: "review" },
  { key: "done", ar: "مكتملة", en: "Done", tone: "done" },
] as const;

const LOG = [
  { who: "سارة", who_en: "Sara", ar: "بدأت العمل على المهمة", en: "started the task" },
  { who: "سارة", who_en: "Sara", ar: "طلبت المراجعة", en: "asked for a review" },
  { who: "مصطفى", who_en: "Mustafa", ar: "اعتمد الإكمال", en: "approved it as done" },
  { who: "أحمد", who_en: "Ahmed", ar: "أنشأ المهمة وأسندها إلى سارة", en: "created the task, gave it to Sara" },
];

/**
 * The hero's tilting glass window: a live task moves through its stages, light runs between them, and its history is
 * written as it goes. It leans toward the pointer. With "reduce motion" it stays still on the last stage.
 */
export function FlowWindow() {
  const { tr, lang } = useFmt();
  const [stage, setStage] = useState(() => (reducedMotion() ? 3 : 0));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const timer = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 1700);
    return () => clearInterval(timer);
  }, []);

  const lean = (e: React.PointerEvent) => {
    const el = box.current;
    if (!el || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${x * 14}deg`);
    el.style.setProperty("--rx", `${-y * 10}deg`);
  };
  // The history shows the lines up to the current stage (the creation line first).
  const lines = [LOG[3], ...LOG.slice(0, stage)];

  return (
    <div
      ref={box}
      onPointerMove={lean}
      onPointerLeave={() => {
        box.current?.style.removeProperty("--rx");
        box.current?.style.removeProperty("--ry");
      }}
      aria-hidden="true"
      className="glass relative isolate w-full max-w-[520px] rounded-3xl p-5"
    >
      <Frost />
      <div className="mb-4 flex items-center justify-between text-xs text-muted">
        <span dir="ltr" className="num">
          TSK-204
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 animate-pulse rounded-full bg-[#86dcae] motion-reduce:animate-none" />
          {tr("مباشر", "Live")}
        </span>
      </div>
      <p className="mb-5 text-lg font-semibold">{tr("تصميم شاشة الدفع", "Design the payment screen")}</p>

      <div className="relative mb-5">
        {/* One track between the first and the last stage: it fills up to the current one, and light runs along it. */}
        <div className="absolute top-[7px] h-0.5 bg-line" style={{ insetInline: "12.5%" }}>
          <div className="h-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${(stage / (STAGES.length - 1)) * 100}%` }} />
          <span key={stage} className="pulse absolute inset-0" />
        </div>
        <ol className="relative grid grid-cols-4">
          {STAGES.map((s, i) => (
            <li key={s.key} className="flex flex-col items-center gap-2">
              <span className={cn("size-4 rounded-full border-2 transition-colors duration-500", i <= stage ? "border-accent bg-accent" : "border-line-strong bg-card")} />
              <span className={cn("text-[11px] transition-colors", i === stage ? "font-semibold text-text" : "text-faint")}>{tr(s.ar, s.en)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Pill tone={STAGES[stage].tone}>{tr(STAGES[stage].ar, STAGES[stage].en)}</Pill>
        {stage === 2 && <span className="text-xs text-muted">{tr("بانتظار اعتماد الإكمال", "Waiting for approval")}</span>}
      </div>

      {/* Room for all four lines from the start, so the window never changes size. */}
      <ul className="flex min-h-[5.75rem] flex-col gap-1.5 border-t border-line pt-3 text-xs">
        {lines.map((l, i) => (
          <li key={i} className={cn("flex gap-2 text-muted", i === lines.length - 1 && "settle text-text")}>
            <b className="font-medium">{lang === "en" ? l.who_en : l.who}</b>
            <span>{tr(l.ar, l.en)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The plate that opens out of the logo mid-page and folds back into it as you scroll past: how the work flows. */
export function FlowPlate() {
  const { tr } = useFmt();
  const steps = [
    { n: "١", n_en: "1", ar: "خطّط", en: "Plan", body_ar: "مشروع بمراحله ودوراته وحالاته الخاصة، أو من قالب جاهز.", body_en: "A project with its phases, sprints and own statuses, or from a template." },
    { n: "٢", n_en: "2", ar: "نفّذ", en: "Do", body_ar: "لوحة كانبان أو سكرم، ومهام تنتظر بعضها، ومحادثة لكل مشروع وفريق.", body_en: "Kanban or Scrum boards, tasks that wait for each other, a chat per project and team." },
    { n: "٣", n_en: "3", ar: "تابع", en: "Follow", body_ar: "لوحة قيادة وتقارير وتقييم أداء عادل، وكل تغيير مسجّل.", body_en: "A dashboard, reports and fair reviews, with every change on record." },
  ];
  return (
    // A soft section: the threads of light behind it show as a blurred glow (the Frost), like frosted glass.
    <section data-threads="soft" aria-labelledby="flow-title" className="relative isolate border-t border-white/5 px-4 py-24">
      <Frost kind="soft" />
      <div className="plate relative mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-3xl border border-line bg-card/75 p-8 sm:p-12">
        <span aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#7c0e44]">
          <BrandMark on="accent" className="size-10" />
        </span>
        <h2 id="flow-title" className="text-center text-3xl font-semibold">
          {tr("هكذا يمضي العمل", "How the work flows")}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="flex flex-col gap-2 rounded-2xl bg-card-2 p-5">
              <span className="num text-sm text-accent">{tr(s.n, s.n_en)}</span>
              <b className="text-lg">{tr(s.ar, s.en)}</b>
              <p className="text-sm leading-relaxed text-muted">{tr(s.body_ar, s.body_en)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** A week on the platform: tasks done per day, rising when the section settles in. */
export function WeekPreview() {
  const { tr, num } = useFmt();
  const days = [
    { ar: "الأحد", en: "Sun", n: 9 },
    { ar: "الإثنين", en: "Mon", n: 14 },
    { ar: "الثلاثاء", en: "Tue", n: 21 },
    { ar: "الأربعاء", en: "Wed", n: 17 },
    { ar: "الخميس", en: "Thu", n: 12 },
  ];
  const max = Math.max(...days.map((d) => d.n));
  return (
    <Reveal as="section" className="relative isolate rounded-3xl border border-line bg-card p-6">
      <Frost />
      <p className="text-xs text-muted">{tr("لوحة الأسبوع", "The week's dashboard")}</p>
      <h3 className="mt-1 mb-5 text-xl font-semibold">{tr("ما أُنجز، يوماً بيوم", "What got done, day by day")}</h3>
      <ul className="flex h-40 items-end gap-3">
        {days.map((d, i) => (
          <li key={d.en} className="flex flex-1 flex-col items-center gap-2">
            <span className="num text-xs text-muted">{num(d.n)}</span>
            <span
              className="w-full origin-bottom rounded-t-lg bg-gradient-to-t from-[#7c0e44] to-[#d49a9a] transition-transform duration-1000 ease-out [.reveal[data-shown=false]_&]:scale-y-0"
              style={{ height: `${(d.n / max) * 100}px`, transitionDelay: `${300 + i * 90}ms` }}
            />
            <span className="text-[11px] text-faint">{tr(d.ar, d.en)}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/** Every change on record: a task's history, as the platform keeps it. */
export function HistoryPreview() {
  const { tr } = useFmt();
  const lines = [
    { ar: "نقل TSK-109 إلى «قيد المراجعة»", en: 'moved TSK-109 to "In review"', when_ar: "قبل دقيقتين", when_en: "2 min ago" },
    { ar: "غيّر موعد التسليم: أُضيف قسم الإعلانات المثبّتة", en: "changed the due date: pinned announcements added", when_ar: "أمس", when_en: "yesterday" },
    { ar: "أوقف TSK-097: بانتظار صلاحية الوصول", en: "blocked TSK-097: waiting for access", when_ar: "قبل يومين", when_en: "2 days ago" },
  ];
  return (
    <Reveal as="section" delay={120} className="relative isolate rounded-3xl border border-line bg-card p-6">
      <Frost />
      <p className="text-xs text-muted">{tr("سجل لا يُمحى", "A record nobody erases")}</p>
      <h3 className="mt-1 mb-5 text-xl font-semibold">{tr("كل تغيير، مع من ومتى ولماذا", "Every change: who, when and why")}</h3>
      <ul className="flex flex-col gap-3 text-sm">
        {lines.map((l) => (
          <li key={l.en} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
            <span className="flex-1">{tr(l.ar, l.en)}</span>
            <span className="shrink-0 text-xs text-faint">{tr(l.when_ar, l.when_en)}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/** A sprint meter you drag: the day of a ten-day sprint, the plan against what is done. */
export function SprintMeter() {
  const { tr, pct } = useFmt();
  const [day, setDay] = useState(6);
  const planned = day / 10;
  // A made-up but believable team: a slow start, then it catches up.
  const done = Math.min(1, Math.max(0, (day / 10) ** 1.35 * 0.95));
  const behind = planned - done > 0.12;
  return (
    <Reveal as="section" delay={60} className="relative isolate rounded-3xl border border-line bg-card p-6">
      <Frost />
      <p className="text-xs text-muted">{tr("مقياس الدورة", "The sprint meter")}</p>
      <h3 className="mt-1 mb-5 text-xl font-semibold">{tr("اسحب لترى الدورة يوماً بيوم", "Drag to see the sprint day by day")}</h3>
      <label htmlFor="sprint-day" className="mb-2 block text-sm text-muted">
        {tr(`اليوم ${day} من 10`, `Day ${day} of 10`)}
      </label>
      <input id="sprint-day" type="range" min={0} max={10} value={day} onChange={(e) => setDay(Number(e.target.value))} className="w-full accent-[#d49a9a]" />
      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted">{tr("المخطط", "Planned")}</span>
          <div className="mt-1 h-2.5 rounded-full bg-chip">
            <div className="h-full rounded-full bg-[#aa5e7a] transition-[width] duration-300" style={{ width: pct(planned) }} />
          </div>
          <b className="num mt-1 block">{pct(planned)}</b>
        </div>
        <div>
          <span className="text-muted">{tr("المنجز", "Done")}</span>
          <div className="mt-1 h-2.5 rounded-full bg-chip">
            <div className="h-full rounded-full bg-[#f2dace] transition-[width] duration-300" style={{ width: pct(done) }} />
          </div>
          <b className="num mt-1 block">{pct(done)}</b>
        </div>
      </div>
      <p className={cn("mt-4 text-sm", behind ? "text-[#f6c681]" : "text-[#86dcae]")}>
        {behind ? tr("متأخرة عن الخطة: تظهر في «تحتاج إلى قرار».", 'Behind the plan: it shows under "needs a decision".') : tr("على الخطة.", "On plan.")}
      </p>
    </Reveal>
  );
}
