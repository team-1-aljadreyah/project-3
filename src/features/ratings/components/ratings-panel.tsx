import { arN, W } from "@/shared/lib/count-words";
import { ArrowDown, ArrowUp, Lock, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/features/auth";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Avatar, Button, Dialog, errorText, ErrorBox, PersonName, Pill, Skeleton, useToast } from "@/shared/ui";
import { ratingsApi } from "../api";
import { canChangeRating, editTimeLeft, REASON_TYPES, REASON_WORDS, reasonWords, SCORE_WORDS, scoreStep, summarize, trendOf } from "../rules";
import type { Rating, ReasonType, Subject } from "../types";
import { RatingDialog, type RatingTarget } from "./rating-dialog";
import { ScoreBars, ScoreMark } from "./score-scale";

/** The average as a number with its bars and word: "4.3 ▂▃▅▆ جيد جداً". */
export function AverageBlock({ average, count }: { average: number | null; count: number }) {
  const { tr } = useFmt();
  if (average === null) return <p className="text-sm text-muted">{tr("لا تقييمات بعد.", "No ratings yet.")}</p>;
  const w = SCORE_WORDS[scoreStep(average)];
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-end gap-2.5">
        <span className="num text-4xl leading-none font-semibold tracking-tight">{average.toFixed(1)}</span>
        <ScoreBars value={average} large className="mb-1" />
      </span>
      <span className="text-sm">
        <b className="font-semibold">{tr(w.ar, w.en)}</b>
        <span className="text-muted">{tr(` · من 5، ${arN(count, W.rating)}`, ` · of 5, ${count} rating${count === 1 ? "" : "s"}`)}</span>
      </span>
    </div>
  );
}

/** The trend: the last 90 days against everything before, with an arrow. */
function Trend({ recent, before, delta }: { recent: number | null; before: number | null; delta: number | null }) {
  const { tr } = useFmt();
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted">{tr("الاتجاه", "Trend")}</span>
      {delta === null ? (
        <span className="text-sm text-muted">{tr("لا يكفي للمقارنة بعد: تحتاج تقييمات من الفترتين.", "Not enough to compare yet: it needs ratings from both periods.")}</span>
      ) : (
      <span className={cn("flex items-center gap-1.5 text-lg font-semibold", delta !== null && delta > 0 && "text-success", delta !== null && delta < 0 && "text-danger")}>
        <Icon size={18} aria-hidden="true" />
        <span className="num">{`${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}</span>
      </span>
      )}
      <span className="text-xs text-muted">
        {tr(`آخر 90 يوماً: ${recent === null ? "-" : recent.toFixed(1)} · قبلها: ${before === null ? "-" : before.toFixed(1)}`, `Last 90 days: ${recent === null ? "-" : recent.toFixed(1)} · before: ${before === null ? "-" : before.toFixed(1)}`)}
      </span>
    </div>
  );
}

/**
 * A team's or a person's quick ratings: the average and its trend, how many of each kind of reason (each opens the list
 * of that kind), and the list itself, newest first, with the private ones only for those who may see them. Its writer
 * changes or removes one for 24 hours (the CEO any time). The "Rate" button shows for those who may rate.
 */
export function RatingsPanel({ target, title, rateLabel }: { target: RatingTarget; title: string; rateLabel: string }) {
  const { tr, num } = useFmt();
  const me = useUser();
  const toast = useToast();
  const subject: Subject = target.subject;
  const load = useLoad(() => Promise.all([ratingsApi.ratings(subject), authApi.users()]), [subject.type, subject.id]);
  const [type, setType] = useQueryParam<ReasonType | "">("type", "", ["", ...REASON_TYPES]);
  const [dialog, setDialog] = useState<{ editing?: Rating } | null>(null);
  const [removing, setRemoving] = useState<Rating | null>(null);
  const [busy, setBusy] = useState(false);

  if (load.state.status === "loading" && !load.data) return <Skeleton className="h-64" />;
  if (load.state.status === "error") {
    // Not allowed to read them: the section isn't there for this person.
    if (load.state.error instanceof ApiError && load.state.error.status === 403) return null;
    return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  }
  if (!load.data) return null;
  const [{ items, can_rate }, users] = load.data;
  const people = new Map(users.map((u) => [u.id, u]));
  const now = new Date();
  const s = summarize(items, now);
  const shown = type ? items.filter((r) => r.reason_type === type) : items;

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await ratingsApi.deleteRating(removing.id);
      toast(tr("حُذف التقييم.", "The rating was removed."));
      setRemoving(null);
      load.reload();
    } catch (e) {
      toast(errorText(e, tr), "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="ratings" aria-labelledby="ratings-title" className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ratings-title" className="flex items-center gap-2 text-lg font-semibold">
          {title}
          <span className="num rounded-md bg-chip px-1.5 text-xs font-medium text-muted">{num(items.length)}</span>
        </h2>
        {can_rate && (
          <Button pill onClick={() => setDialog({})}>
            <Plus size={16} aria-hidden="true" />
            {rateLabel}
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-[1fr_1fr_1.4fr]">
          <div className="bg-card p-4">
            <AverageBlock average={s.average} count={s.count} />
          </div>
          <div className="bg-card p-4">
            <Trend recent={s.recent.average} before={s.before.average} delta={trendOf(s)} />
          </div>
          <div className="bg-card p-4">
            <p className="mb-2 text-[13px] text-muted">{tr("حسب نوع السبب", "By kind of reason")}</p>
            <ul aria-label={tr("عدد التقييمات حسب نوع السبب", "Ratings by kind of reason")} className="flex flex-col gap-1">
              {REASON_TYPES.filter((t) => s.by_type[t] > 0).map((t) => {
                const w = REASON_WORDS[t];
                const on = type === t;
                return (
                  <li key={t}>
                    {/* Each line filters the list below to that kind (pressed again: all of them). */}
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setType(on ? "" : t)}
                      className={cn("grid w-full grid-cols-[minmax(0,11.5rem)_1fr_1.5rem] items-center gap-2 rounded-md px-1.5 py-1 text-start text-[13px] hover:bg-card-2", on && "bg-accent-soft text-accent-ink")}
                    >
                      <span className="truncate">{tr(w.ar, w.en)}</span>
                      <span aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full bg-chip">
                        <span className="h-full shrink-0 rounded-full bg-accent" style={{ width: `${(s.by_type[t] / Math.max(1, s.count)) * 100}%` }} />
                      </span>
                      <span className="num text-end font-semibold">{s.by_type[t]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {type && (
        <p className="flex items-center gap-2 text-sm">
          {tr(`تظهر تقييمات «${reasonWords(type).ar}» فقط.`, `Showing "${reasonWords(type).en}" only.`)}
          <button type="button" onClick={() => setType("")} className="font-medium text-accent underline underline-offset-4">
            {tr("اعرض الكل", "Show all")}
          </button>
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-muted">
          {can_rate ? tr("لا تقييمات بعد. أول تقييم يبدأ السجل.", "No ratings yet. The first one starts the history.") : tr("لا تقييمات بعد.", "No ratings yet.")}
        </div>
      ) : (
        <ol aria-label={tr("التقييمات، الأحدث أولاً", "Ratings, newest first")} className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {shown.map((r) => (
            <RatingLine key={r.id} rating={r} rater={people.get(r.rater_id)} editor={r.edited_by ? people.get(r.edited_by) : undefined} mine={canChangeRating(me, r, now)} now={now} onEdit={() => setDialog({ editing: r })} onRemove={() => setRemoving(r)} />
          ))}
        </ol>
      )}

      {dialog && <RatingDialog target={target} editing={dialog.editing} onClose={() => setDialog(null)} onSaved={load.reload} />}
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={tr("حذف التقييم", "Remove the rating")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button onClick={remove} disabled={busy} className="bg-danger text-white hover:bg-danger/90">
              {tr("احذفه", "Remove it")}
            </Button>
          </>
        }
      >
        <p className="text-sm">{tr("يُحذف التقييم ويُكتب حذفه في سجل العمليات. لا يمكن التراجع.", "The rating is removed and the removal is written in the audit log. This can't be undone.")}</p>
      </Dialog>
    </section>
  );
}

/** One rating: the score, the kind, the reason, who and when, what it is about, and its own buttons. */
function RatingLine({ rating: r, rater, editor, mine, now, onEdit, onRemove }: { rating: Rating; rater?: User; editor?: User; mine: boolean; now: Date; onEdit: () => void; onRemove: () => void }) {
  const { tr, lang, ago, dateTime, day } = useFmt();
  const w = reasonWords(r.reason_type);
  const left = editTimeLeft(r, now);
  const until = new Date(now.getTime() + left).toISOString();
  const nameOf = (u?: User) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-");
  return (
    <li className={cn("flex flex-col gap-2.5 p-4 sm:flex-row sm:gap-5", r.private && "bg-card-2")}>
      <div className="flex shrink-0 items-center gap-3 sm:w-48 sm:flex-col sm:items-start sm:gap-1.5">
        <ScoreMark score={r.score} />
        <Pill tone={w.tone}>{tr(w.ar, w.en)}</Pill>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p dir="auto" className="text-sm leading-relaxed whitespace-pre-wrap">
          {r.reason}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            {rater && <Avatar user={rater} size="sm" />}
            {rater ? <PersonName person={rater} className="font-medium text-text" /> : "-"}
          </span>
          <time dateTime={r.created_at} title={dateTime(r.created_at)}>
            {ago(r.created_at, now)}
          </time>
          {r.project_id && (
            <Link href={`/projects/${r.project_id}`} className="hover:text-text hover:underline">
              {tr("عن: ", "About: ")}
              <span dir="auto">{(lang === "en" && r.project_name_en) || r.project_name}</span>
            </Link>
          )}
          {r.period && (
            <span>
              {tr("الفترة: ", "Period: ")}
              {day(r.period.from)} – {day(r.period.to)}
            </span>
          )}
          {r.private && (
            <span className="inline-flex items-center gap-1 font-medium text-text">
              <Lock size={12} aria-hidden="true" />
              {tr("خاص: المدير التنفيذي وكاتبه فقط", "Private: the CEO and its writer only")}
            </span>
          )}
          {r.edited_at && <span>{editor ? tr(`عدّله ${nameOf(editor)}`, `changed by ${nameOf(editor)}`) : tr("عُدّل", "changed")}</span>}
        </div>
      </div>
      {mine && (
        <div className="flex shrink-0 items-start gap-1 sm:flex-col sm:items-end">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={tr("عدّل هذا التقييم", "Change this rating")}>
            <Pencil size={14} aria-hidden="true" />
            {tr("تعديل", "Change")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} aria-label={tr("احذف هذا التقييم", "Remove this rating")}>
            <Trash2 size={14} aria-hidden="true" />
            {tr("حذف", "Remove")}
          </Button>
          {left > 0 && <span className="text-[11px] text-faint">{tr(`حتى ${dateTime(until)}`, `until ${dateTime(until)}`)}</span>}
        </div>
      )}
    </li>
  );
}
