import { Ban, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/features/auth";
import { RatingsPanel } from "@/features/ratings";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useLoad } from "@/shared/lib/use-load";
import { today as todayIso } from "@/shared/lib/utils";
import { Avatar, Button, Empty, ErrorBox, LoadingBlock, Pill, ProgressBar, Skeleton, Stat } from "@/shared/ui";
import { performanceApi } from "../api";
import { presetPeriods } from "../metrics";
import type { Period, Review } from "../types";
import { PeriodPicker } from "./period-picker";
import { ReviewDialog } from "./review-dialog";

/**
 * One person's performance (the brief, per employee): assigned, done, late, completion, on-time rate, blocked tasks
 * and why, the manager's notes (the reviews), past reviews and the trend over time.
 */
export function PersonView({ userId, me }: { userId: number; me: User }) {
  const { tr, lang, num, pct, day } = useFmt();
  const today = todayIso();
  const [period, setPeriod] = useState<Period>(() => presetPeriods(today).d90);
  const load = useLoad(() => Promise.all([performanceApi.person(userId, period), performanceApi.criteria(), authApi.users()]), [userId, period]);
  const [writing, setWriting] = useState<{ draft?: Review } | null>(null);
  const people = new Map((load.data?.[2] ?? []).map((u) => [u.id, u]));
  const subject = people.get(userId);
  const nameOf = (u?: User) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-");
  usePageTitle(userId === me.id ? tr("أدائي", "My performance") : tr(`أداء ${nameOf(subject)}`, `${nameOf(subject)}'s performance`));

  if (load.state.status === "loading" && !load.data) {
    return (
      <LoadingBlock className="flex flex-col gap-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} backHref="/performance" />;
  if (!load.data) return null;
  const [detail, criteria] = load.data;
  const { perf } = detail;
  const finals = detail.reviews.filter((r) => r.state === "final").sort((a, b) => a.period.to.localeCompare(b.period.to));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {subject && <Avatar user={subject} size="lg" />}
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold">{userId === me.id ? tr("أدائي", "My performance") : nameOf(subject)}</h1>
            {subject && <p className="text-sm text-muted">{subject.title}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={period} onChange={setPeriod} today={today} />
          {detail.can_review && (
            <Button pill onClick={() => setWriting({})}>
              <Plus size={16} aria-hidden="true" />
              {tr("تقييم دوري جديد", "New periodic review")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={tr("مسندة", "Assigned")} value={num(perf.assigned)} note={tr("في الفترة", "in the period")} />
        <Stat label={tr("منجزة", "Done")} value={num(perf.done)} note={tr(`الإنجاز ${pct(perf.completion)}`, `${pct(perf.completion)} done`)} />
        <Stat label={tr("متأخرة", "Late")} value={num(perf.late)} danger={perf.late > 0} note={tr("بعد موعد التسليم", "after the due day")} href={detail.blocked.length > 0 ? "#blocked-title" : undefined} />
        <Stat label={tr("في الموعد", "On time")} value={perf.on_time === null ? "-" : pct(perf.on_time)} note={tr("من المنجزة ذات الموعد", "of the done ones with a due day")} />
        <Stat label={tr("متوقفة", "Blocked")} value={num(perf.blocked)} danger={perf.blocked > 0} note={tr("الآن", "now")} href={detail.blocked.length > 0 ? "#blocked-title" : undefined} />
      </div>

      {detail.blocked.length > 0 && (
        <section aria-labelledby="blocked-title" className="rounded-xl border border-line bg-card p-4">
          <h2 id="blocked-title" className="mb-2 flex scroll-mt-24 items-center gap-2 font-semibold">
            <Ban size={16} aria-hidden="true" className="text-danger" />
            {tr("المهام المتوقفة وأسبابها", "Blocked tasks and why")}
          </h2>
          <ul className="flex flex-col gap-1">
            {detail.blocked.map((b) => (
              <li key={b.task_id}>
                <Link href={`/tasks/${b.task_id}`} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-chip">
                  <span dir="ltr" className="text-xs text-muted">
                    {b.code}
                  </span>
                  <span dir="auto" className="font-medium">
                    {b.title}
                  </span>
                  {b.reason && (
                    <span dir="auto" className="text-danger">
                      — {b.reason}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Quick ratings (any time, any reason: the ratings feature), apart from the periodic reviews below. */}
      {subject && subject.role !== "ceo" && subject.role !== "admin" && (
        <RatingsPanel
          target={{ subject: { type: "person", id: userId }, name: nameOf(subject), memberIds: [userId] }}
          title={tr("تقييمات سريعة", "Quick ratings")}
          rateLabel={tr("تقييم سريع", "Quick rating")}
        />
      )}

      <section aria-labelledby="trend-title" className="rounded-xl border border-line bg-card p-4">
        <h2 id="trend-title" className="mb-3 font-semibold">
          {tr("التقييم الدوري عبر الفترات", "Periodic reviews over time")}
        </h2>
        {finals.length === 0 ? (
          <p className="text-sm text-muted">{tr("لا تقييمات معتمدة بعد.", "No final reviews yet.")}</p>
        ) : (
          <ul aria-label={tr("تطور التقييم", "Review trend")} className="flex flex-col gap-2">
            {finals.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 text-xs text-muted">
                  {day(r.period.from)} – {day(r.period.to)}
                </span>
                <ProgressBar value={r.total / 100} label={tr(`تقييم ${day(r.period.to)}`, `Review ${day(r.period.to)}`)} className="flex-1" />
                <b className="num w-12 text-end">{r.total}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reviews-title" className="flex flex-col gap-3">
        <h2 id="reviews-title" className="font-semibold">
          {tr("سجل التقييم الدوري", "Past periodic reviews")}
        </h2>
        {detail.reviews.length === 0 && <Empty title={tr("لا توجد تقييمات", "No reviews")} body={tr("تظهر هنا تقييمات المسؤول المباشر وملاحظاته.", "The manager's reviews and notes show here.")} />}
        {detail.reviews.map((r) => (
          <article key={r.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <b>
                  {day(r.period.from)} – {day(r.period.to)}
                </b>
                {r.state === "final" ? <Pill tone="done">{tr("معتمد", "Final")}</Pill> : <Pill tone="review">{tr("مسودة", "Draft")}</Pill>}
              </span>
              <span className="text-muted">
                {tr(`بواسطة ${nameOf(people.get(r.reviewer_id))}`, `by ${nameOf(people.get(r.reviewer_id))}`)} · <b className="num text-text">{r.total}/100</b>
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {r.criteria.map((c) => (
                <li key={c.id}>
                  <Pill tone="new">
                    {lang === "en" ? c.name_en : c.name}: {r.scores[c.id] ?? 0}
                  </Pill>
                </li>
              ))}
            </ul>
            {r.note && (
              <p dir="auto" className="whitespace-pre-wrap text-muted">
                {r.note}
              </p>
            )}
            {r.state === "draft" && r.reviewer_id === me.id && (
              <Button variant="secondary" pill className="self-start" onClick={() => setWriting({ draft: r })}>
                {tr("أكمل المسودة", "Continue the draft")}
              </Button>
            )}
          </article>
        ))}
      </section>

      {writing && (
        <ReviewDialog
          userId={userId}
          name={nameOf(subject)}
          criteria={criteria}
          perf={perf}
          period={period}
          draft={writing.draft}
          today={today}
          onClose={() => setWriting(null)}
          onSaved={load.reload}
        />
      )}
    </div>
  );
}
