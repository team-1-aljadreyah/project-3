import { Bug, Clock3, FolderKanban, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { User } from "@/shared/api/types";
import { roleName } from "@/shared/lib/site";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Avatar, ButtonLink, Input, Pill, ProgressBar, Select } from "@/shared/ui";
import { followUp, type FollowUpFilter, type totals } from "../compute";
import type { Overview } from "../types";
import { MonitorCharacter } from "./monitor-character";
import { Greeting } from "@/shared/ui";

const FILTERS: { key: FollowUpFilter; ar: string; en: string }[] = [
  { key: "all", ar: "كل المشاريع", en: "All projects" },
  { key: "behind", ar: "متأخرة عن الخطة", en: "Behind the plan" },
  { key: "overdue", ar: "تجاوزت موعدها", en: "Past their end" },
  { key: "on-plan", ar: "على الخطة", en: "On plan" },
];

/**
 * The top of the monitoring and evaluation officer's dashboard: a wine banner with the page's name and a small animated
 * character (MonitorCharacter), a card with who is signed in resting on its edge, the summary numbers as four cards with an icon each, and "following the projects": a
 * list of every project against its plan, with a filter and a search. Every row opens its project.
 */
export function MonitorSummary({ user, o, t }: { user: User; o: Overview; t: ReturnType<typeof totals> }) {
  const { tr, lang, num, pct, day } = useFmt();
  const [filter, setFilter] = useState<FollowUpFilter>("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => followUp(o.projects, filter, query), [o.projects, filter, query]);
  const projectName = (p: { name: string; name_en?: string }) => (lang === "en" && p.name_en ? p.name_en : p.name);
  const stats = [
    { icon: FolderKanban, label: tr("المشاريع النشطة", "Active projects"), href: "/", value: num(t.projects.active), note: tr(`من ${num(t.projects.all)} مشاريع`, `of ${t.projects.all} projects`) },
    { icon: TrendingUp, label: tr("الإنجاز الكلي", "Overall progress"), href: "/reports", value: pct(t.ratio), note: tr(`${num(t.tasks.done)} من ${num(t.tasks.total)} مهمة`, `${t.tasks.done} of ${t.tasks.total} tasks`) },
    { icon: Clock3, label: tr("مهام متأخرة", "Late tasks"), href: "#follow-title", value: num(t.tasks.late), note: tr(`متوقفة ${num(t.tasks.blocked)}`, `${t.tasks.blocked} blocked`), danger: t.tasks.late > 0 },
    { icon: Bug, label: tr("أخطاء مفتوحة", "Open bugs"), href: o.bugs.late > 0 ? "/bugs?show=late" : "/bugs", value: num(o.bugs.open), note: tr(`متأخرة ${num(o.bugs.late)} · حرجة ${num(o.bugs.critical_open)}`, `${o.bugs.late} late · ${o.bugs.critical_open} critical`), danger: o.bugs.late > 0 },
  ];

  return (
    <>
      <section aria-labelledby="dashboard-title">
        <div className="wave-banner relative isolate h-36 overflow-hidden rounded-2xl px-5 pt-4 sm:h-40 lg:h-48">
          {/* Soft waves across the banner: a drawing, not a photo. */}
          <svg aria-hidden="true" viewBox="0 0 1200 160" preserveAspectRatio="none" className="absolute inset-0 -z-10 h-full w-full">
            <path d="M0 96C180 40 330 150 540 92S900 24 1200 84V160H0Z" fill="#fff" fillOpacity="0.07" />
            <path d="M0 126C220 76 380 168 620 118S960 58 1200 112V160H0Z" fill="#fff" fillOpacity="0.07" />
            <path d="M0 58C240 6 420 108 660 54S980 4 1200 40" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" />
          </svg>
          <h1 id="dashboard-title" className="text-sm font-semibold text-white">
            {tr("لوحة التحكم", "Dashboard")}
          </h1>
          <Greeting user={user} className="mt-2 max-w-[60%]" />
          {/* Her character, at the end side away from the name. Her lower edge is the card's top edge (the card rises
              3rem into the banner), so she seems to stand behind it and never covers it. */}
          <MonitorCharacter className="absolute end-4 bottom-12 h-[5.25rem] sm:end-8 sm:h-[6.25rem] lg:end-12 lg:h-[8.5rem]" />
        </div>
        <div className="relative mx-3 -mt-12 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card/95 p-3 shadow-card sm:mx-5">
          <Avatar user={user} size="lg" className="size-12 rounded-xl text-base" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={`/performance/${user.id}`} className="truncate font-bold hover:underline">
              {lang === "en" && user.name_en ? user.name_en : user.name}
            </Link>
            <span className="truncate text-sm text-muted">{roleName(user, lang)}</span>
          </div>
          <ButtonLink href="/reports" variant="secondary" pill>
            {tr("كل التقارير", "All reports")}
          </ButtonLink>
        </div>
      </section>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{tr("ملخص المتابعة", "Follow-up summary")}</h2>
        <span className="text-sm text-muted">{tr(`آخر تحديث للبيانات: ${day(o.today)}`, `Data last updated: ${day(o.today)}`)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {stats.map((s) => (
          // The whole card opens its page (the label is the link, stretched over the card).
          <div key={s.label} className="relative flex items-center gap-3.5 rounded-xl border border-line bg-card px-4 py-3.5 transition-colors focus-within:border-accent hover:border-accent">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              <s.icon size={21} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <Link href={s.href} className="text-[13px] text-muted after:absolute after:inset-0 after:rounded-xl">
                {s.label}
              </Link>
              <span className={cn("num text-xl font-semibold", s.danger && "text-danger")}>{s.value}</span>
              <span className={cn("text-xs", s.danger ? "text-danger" : "text-muted")}>{s.note}</span>
            </span>
          </div>
        ))}
      </div>

      <section aria-labelledby="follow-title" className="rounded-xl border border-line bg-card p-4">
        <h2 id="follow-title" className="mb-3 font-semibold">
          {tr("متابعة المشاريع", "Following the projects")}
        </h2>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <Select aria-label={tr("اعرض المشاريع", "Show projects")} value={filter} onChange={(e) => setFilter(e.target.value as FollowUpFilter)} className="sm:w-56">
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {tr(f.ar, f.en)}
              </option>
            ))}
          </Select>
          <Input type="search" aria-label={tr("ابحث باسم المشروع", "Search by project name")} placeholder={tr("ابحث باسم المشروع أو رمزه…", "Search by project name or code…")} value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" />
        </div>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{tr("لا مشاريع بهذا البحث.", "No projects match.")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((p) => (
              <li key={p.id}>
                {/* The whole row opens the project's board (click anywhere). */}
                <Link href={`/projects/${p.id}`} className="flex flex-col gap-2 rounded-lg border border-line p-3 hover:border-accent sm:flex-row sm:items-center">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span dir="ltr" className="num text-xs text-faint">
                      {p.code}
                    </span>
                    <span dir="auto" className="font-medium">
                      {projectName(p)}
                    </span>
                    {p.overdue && <Pill tone="blocked">{tr(`تجاوز موعده ${day(p.end)}`, `Past its end, ${day(p.end)}`)}</Pill>}
                    {p.behind && <Pill tone="review">{tr("متأخر عن الخطة", "Behind the plan")}</Pill>}
                    {!p.overdue && !p.behind && <Pill tone="done">{tr("على الخطة", "On plan")}</Pill>}
                    {p.late > 0 && <span className="text-xs text-danger">{tr(`مهام متأخرة: ${num(p.late)}`, `Late tasks: ${p.late}`)}</span>}
                  </span>
                  <span className="flex w-full items-center gap-2 text-xs text-muted sm:w-72">
                    <ProgressBar value={p.ratio} planned={p.planned_ratio} label={tr(`إنجاز ${projectName(p)}`, `${projectName(p)} progress`)} className="flex-1" />
                    <span dir="ltr" className="num shrink-0">
                      {pct(p.ratio)} / {pct(p.planned_ratio)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
