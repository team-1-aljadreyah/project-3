import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/features/auth";
import { AverageMark, RateButton, ratingsApi } from "@/features/ratings";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, today as todayIso } from "@/shared/lib/utils";
import { Avatar, ButtonLink, Empty, ErrorBox, LoadingBlock, PrintButton, ProgressBar, Skeleton } from "@/shared/ui";
import { performanceApi } from "../api";
import { PeriodPicker } from "../components/period-picker";
import { PersonView } from "../components/person-view";
import { presetPeriods } from "../metrics";
import { canSeePeoplePerf } from "../rules";
import type { Period } from "../types";

const th = "px-3 py-2 text-start text-xs font-medium whitespace-nowrap text-muted";
const td = "px-3 py-2 whitespace-nowrap";

/**
 * Performance (the brief): for management, PMs, M&E and team leaders, the people they may see and the teams, counted
 * over a period; each row opens the person's page with the reviews. An employee sees their own page.
 */
export function PerformancePage() {
  const me = useUser();
  if (!canSeePeoplePerf(me)) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <PersonView userId={me.id} me={me} />
      </div>
    );
  }
  return <PeopleList />;
}

function PeopleList() {
  const { tr, lang, num, pct } = useFmt();
  usePageTitle(tr("الأداء", "Performance"));
  const today = todayIso();
  const [period, setPeriod] = useState<Period>(() => presetPeriods(today).d90);
  const load = useLoad(() => Promise.all([performanceApi.overview(period), authApi.users()]), [period]);
  const people = new Map((load.data?.[1] ?? []).map((u) => [u.id, u]));
  // Quick ratings (the ratings feature): the teams' and people's averages this person may see, and who they may rate.
  const quick = useLoad(() => Promise.all([ratingsApi.teams().catch(() => []), ratingsApi.people().catch(() => [])]));
  const teamRatings = new Map((quick.data?.[0] ?? []).map((r) => [r.team.id, r]));
  const personRatings = new Map((quick.data?.[1] ?? []).map((r) => [r.user_id, r]));
  const ratingColumn = (load.data?.[0].people ?? []).some((r) => personRatings.has(r.user_id));
  const nameOf = (u?: { name: string; name_en?: string }) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("الأداء", "Performance")}</h1>
          <p className="text-sm text-muted">{tr("أرقام يحسبها النظام من المهام، وتقييمات المسؤول المباشر.", "Numbers the system counts from the tasks, and the direct manager's reviews.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={period} onChange={setPeriod} today={today} />
          <ButtonLink href="/performance/criteria" variant="secondary" pill>
            <SlidersHorizontal size={15} aria-hidden="true" />
            {tr("معايير التقييم", "Review criteria")}
          </ButtonLink>
          <PrintButton target={() => null} />
        </div>
      </div>

      {load.state.status === "loading" && !load.data && (
        <LoadingBlock>
          <Skeleton className="h-72" />
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}

      {load.data && (
        <>
          {load.data[0].teams.length > 0 && (
            <section aria-labelledby="teams-perf" className="grid gap-3 md:grid-cols-2">
              <h2 id="teams-perf" className="sr-only">
                {tr("أداء الفرق", "Team performance")}
              </h2>
              {load.data[0].teams.map((t) => {
                const rated = teamRatings.get(t.team_id);
                const teamName = lang === "en" && t.name_en ? t.name_en : t.name;
                return (
                // The whole card opens the team's page; its average and "Rate" sit above that link.
                <article key={t.team_id} className="relative flex flex-col gap-2 rounded-xl border border-line bg-card p-4 text-sm transition-colors focus-within:border-accent hover:border-accent">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link href={`/teams/${t.team_id}`} dir="auto" className="font-bold after:absolute after:inset-0 after:rounded-xl hover:underline">
                        {teamName}
                      </Link>
                      {rated?.ratings && <AverageMark summary={rated.ratings} href={`/teams/${t.team_id}#ratings`} />}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted">{tr(`${num(t.members)} أعضاء`, `${t.members} people`)}</span>
                      {rated?.can_rate && <RateButton target={{ subject: { type: "team", id: t.team_id }, name: teamName }} onSaved={quick.reload} />}
                    </span>
                  </div>
                  <ProgressBar value={t.completion} planned={t.planned} label={tr(`إنجاز ${t.name}`, `${t.name_en ?? t.name} done`)} />
                  <p className="text-xs text-muted">
                    {tr(
                      `الإنجاز ${pct(t.completion)} من ${pct(t.planned)} المخطط · منجزة ${num(t.done)} · متبقية ${num(t.left)} · متأخرة ${num(t.late)} · متوقفة ${num(t.blocked)}`,
                      `${pct(t.completion)} done of ${pct(t.planned)} planned · ${t.done} done · ${t.left} left · ${t.late} late · ${t.blocked} blocked`,
                    )}
                  </p>
                </article>
                );
              })}
            </section>
          )}

          {load.data[0].people.length === 0 ? (
            <Empty title={tr("لا أحد في قائمتك", "Nobody in your list")} body={tr("تظهر هنا الأسماء التي تتابع أداءها.", "The people whose work you follow show here.")} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">{tr("أداء الموظفين", "People's performance")}</caption>
                <thead className="border-b border-line">
                  <tr>
                    <th className={th}>{tr("الموظف", "Person")}</th>
                    <th className={th}>{tr("مسندة", "Assigned")}</th>
                    <th className={th}>{tr("منجزة", "Done")}</th>
                    <th className={th}>{tr("الإنجاز", "Completion")}</th>
                    <th className={th}>{tr("في الموعد", "On time")}</th>
                    <th className={th}>{tr("متأخرة", "Late")}</th>
                    <th className={th}>{tr("متوقفة", "Blocked")}</th>
                    {ratingColumn && <th className={th}>{tr("التقييم", "Rating")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {load.data[0].people.map((r) => {
                    const u = people.get(r.user_id);
                    return (
                      // The whole row opens the person (the name is the link, stretched over the row).
                      <tr key={r.user_id} className="relative hover:bg-card-2">
                        <td className={td}>
                          <Link href={`/performance/${r.user_id}`} className="flex items-center gap-2 font-medium after:absolute after:inset-0 hover:underline">
                            {u && <Avatar user={u} size="sm" />}
                            {nameOf(u)}
                          </Link>
                        </td>
                        <td className={cn(td, "num")}>{num(r.assigned)}</td>
                        <td className={cn(td, "num")}>{num(r.done)}</td>
                        <td className={cn(td, "num")}>{pct(r.completion)}</td>
                        <td className={cn(td, "num")}>{r.on_time === null ? "-" : pct(r.on_time)}</td>
                        <td className={cn(td, "num", r.late > 0 && "font-semibold text-danger")}>{num(r.late)}</td>
                        <td className={cn(td, "num")}>{num(r.blocked)}</td>
                        {ratingColumn && (
                          <td className={td}>
                            {(() => {
                              const q = personRatings.get(r.user_id);
                              if (!q) return null;
                              return (
                                <span className="flex items-center gap-2">
                                  <AverageMark summary={q.ratings} href={q.ratings.count > 0 ? `/performance/${r.user_id}#ratings` : undefined} />
                                  {q.can_rate && <RateButton target={{ subject: { type: "person", id: r.user_id }, name: nameOf(u) }} onSaved={quick.reload} />}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {/* Fixed words, there from the first paint (they don't wait for the numbers). */}
      <p className="text-xs text-faint">
        {tr(
          "الأرقام وحدها لا تكفي للحكم على الأداء: التقييم يجمعها مع تقدير المسؤول لجودة العمل والتعاون، بمعايير تعتمدها الإدارة.",
          "Numbers alone don't judge performance: a review adds the manager's view of quality and teamwork, with criteria the management approves.",
        )}
      </p>
    </div>
  );
}
