import { ChevronDown, Eye, Lock } from "lucide-react";
import { useState } from "react";
import { projectsApi } from "@/features/projects";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Dialog, errorText, Field, Input, Pill, Select, Textarea, useToast } from "@/shared/ui";
import { ratingsApi } from "../api";
import { RATING_LIMITS, REASON_TYPES, REASON_WORDS } from "../rules";
import type { Rating, ReasonType, Subject } from "../types";
import { ScorePicker } from "./score-scale";

/** A team or a person to rate, with its name in the reader's language. */
export interface RatingTarget {
  subject: Subject;
  name: string;
  /** People whose projects the "about a project" list offers first (a team's members, or the person). */
  memberIds?: number[];
}

/**
 * A quick rating (or changing one): the score on the five-step scale, the kind of reason ("another reason" is always
 * there), the reason in the rater's own words, optionally the project or period it is about, and whether the team (or
 * the person) sees it. `choices`: several teams or people to pick from first (the dashboard's quick rating).
 */
export function RatingDialog({
  target: start,
  choices,
  editing,
  onClose,
  onSaved,
}: {
  target?: RatingTarget;
  choices?: RatingTarget[];
  editing?: Rating;
  onClose: () => void;
  onSaved?: (rating: Rating) => void;
}) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const [target, setTarget] = useState<RatingTarget | undefined>(start ?? (choices?.length === 1 ? choices[0] : undefined));
  const [score, setScore] = useState<number | null>(editing?.score ?? null);
  const [type, setType] = useState<ReasonType | null>(editing?.reason_type ?? null);
  const [reason, setReason] = useState(editing?.reason ?? "");
  const [projectId, setProjectId] = useState(editing?.project_id ? String(editing.project_id) : "");
  const [from, setFrom] = useState(editing?.period?.from ?? "");
  const [to, setTo] = useState(editing?.period?.to ?? "");
  const [isPrivate, setPrivate] = useState(editing?.private ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const projects = useLoad(() => projectsApi.projects().catch(() => []));
  const team = target?.subject.type === "team";

  // The projects the subject works in come first; the others after them.
  const all = projects.data ?? [];
  const ids = new Set(target?.memberIds ?? []);
  const theirs = all.filter((p) => p.member_ids.some((id) => ids.has(id)));
  const others = all.filter((p) => !theirs.includes(p));
  const projectName = (p: { name: string; name_en?: string }) => (lang === "en" && p.name_en ? p.name_en : p.name);

  const save = async () => {
    if (!target) {
      setErrors({ subject: team ? tr("اختر الفريق.", "Choose the team.") : tr("اختر من تقيّمه.", "Choose who you rate.") });
      return;
    }
    setBusy(true);
    setErrors({});
    const input = {
      score: score ?? 0,
      reason_type: type as ReasonType,
      reason,
      project_id: projectId ? Number(projectId) : null,
      period: from || to ? { from, to } : null,
      private: isPrivate,
    };
    try {
      const saved = editing ? await ratingsApi.updateRating(editing.id, input) : await ratingsApi.rate(target.subject, input);
      toast(
        editing
          ? tr("حُفظ التعديل.", "The change is saved.")
          : isPrivate
            ? tr("حُفظ التقييم الخاص.", "The private rating is saved.")
            : team
              ? tr("حُفظ التقييم وأُبلغ قائد الفريق.", "Rating saved; the team leader was told.")
              : tr("حُفظ التقييم وأُبلغ صاحبه.", "Rating saved; the person was told."),
      );
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else setErrors({ form: errorText(e, tr) });
    } finally {
      setBusy(false);
    }
  };

  const title = editing ? tr("تعديل التقييم", "Change the rating") : target ? tr(`تقييم ${target.name}`, `Rate ${target.name}`) : tr("تقييم سريع", "Quick rating");

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {editing ? tr("احفظ التعديل", "Save the change") : tr("احفظ التقييم", "Save the rating")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 text-sm">
        {choices && !editing && (
          <Field label={choices[0]?.subject.type === "person" ? tr("من تقيّم؟", "Who do you rate?") : tr("الفريق", "Team")} htmlFor="rating-subject" error={errors.subject}>
            <Select
              id="rating-subject"
              invalid={!!errors.subject}
              value={target ? `${target.subject.type}-${target.subject.id}` : ""}
              onChange={(e) => setTarget(choices.find((c) => `${c.subject.type}-${c.subject.id}` === e.target.value))}
            >
              <option value="">{tr("اختر…", "Choose…")}</option>
              {choices.map((c) => (
                <option key={`${c.subject.type}-${c.subject.id}`} value={`${c.subject.type}-${c.subject.id}`}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="flex flex-col gap-1.5">
          <ScorePicker value={score} onChange={setScore} invalid={!!errors.score} describedBy={errors.score ? "rating-score-error" : undefined} />
          {errors.score && (
            <p id="rating-score-error" className="text-[13px] text-danger">
              {errors.score}
            </p>
          )}
        </div>

        <fieldset aria-describedby={errors.reason_type ? "rating-type-error" : undefined} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{tr("نوع السبب", "Kind of reason")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {REASON_TYPES.map((t) => {
              const w = REASON_WORDS[t];
              const chosen = type === t;
              return (
                <label
                  key={t}
                  className={cn(
                    "relative inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] transition-colors",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent",
                    chosen ? "border-accent bg-accent-soft font-semibold text-accent-ink" : "border-line bg-card text-text hover:border-line-strong",
                  )}
                >
                  <input type="radio" name="rating-type" value={t} checked={chosen} onChange={() => setType(t)} className="absolute inset-0 z-10 size-full cursor-pointer appearance-none opacity-0" />
                  <span aria-hidden="true" className={cn("size-2 rounded-full border", chosen ? "border-accent bg-accent" : "border-line-strong")} />
                  {tr(w.ar, w.en)}
                </label>
              );
            })}
          </div>
          {errors.reason_type && (
            <p id="rating-type-error" className="text-[13px] text-danger">
              {errors.reason_type}
            </p>
          )}
        </fieldset>

        <Field
          label={tr("السبب بكلماتك", "The reason, in your words")}
          htmlFor="rating-reason"
          error={errors.reason}
          hint={
            <span className="flex justify-between gap-2">
              <span>{tr("ما الذي رأيته؟ اكتبه كما تقوله لزميل.", "What did you see? Write it as you'd tell a colleague.")}</span>
              <span className="num shrink-0">
                {reason.length} / {RATING_LIMITS.reason}
              </span>
            </span>
          }
        >
          <Textarea id="rating-reason" rows={4} maxLength={RATING_LIMITS.reason} invalid={!!errors.reason} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>

        <details className="group rounded-xl border border-line" open={!!(editing?.project_id || editing?.period || errors.period || errors.project_id)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
            <span>
              {tr("عن مشروع أو فترة", "About a project or a period")} <span className="font-normal text-muted">{tr("(اختياري)", "(optional)")}</span>
            </span>
            <ChevronDown size={16} aria-hidden="true" className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
            <Field label={tr("المشروع", "Project")} htmlFor="rating-project" error={errors.project_id}>
              <Select id="rating-project" invalid={!!errors.project_id} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">{tr("ليس عن مشروع بعينه", "Not about one project")}</option>
                {theirs.length > 0 && (
                  <optgroup label={team ? tr("مشاريع الفريق", "The team's projects") : tr("مشاريعه", "Their projects")}>
                    {theirs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {projectName(p)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label={tr("مشاريع أخرى", "Other projects")}>
                    {others.map((p) => (
                      <option key={p.id} value={p.id}>
                        {projectName(p)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("من يوم", "From")} htmlFor="rating-from" error={errors.period}>
                <Input id="rating-from" type="date" invalid={!!errors.period} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label={tr("إلى يوم", "To")} htmlFor="rating-to">
                <Input id="rating-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
          </div>
        </details>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{tr("من يراه", "Who sees it")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                value: false,
                icon: Eye,
                title: team ? tr("يراه الفريق", "The team sees it") : tr("يراه صاحبه", "They see it"),
                body: team ? tr("ويصل إشعار إلى قائد الفريق.", "The team leader is told.") : tr("ويصله إشعار به.", "They are told."),
              },
              { value: true, icon: Lock, title: tr("خاص", "Private"), body: tr("يراه المدير التنفيذي وأنت فقط، دون إشعار.", "Only the CEO and you see it; nobody is told.") },
            ].map((o) => {
              const chosen = isPrivate === o.value;
              return (
                <label
                  key={String(o.value)}
                  className={cn(
                    "relative grid cursor-pointer grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 rounded-xl border p-3 transition-colors",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent",
                    chosen ? "border-accent bg-accent-soft/50" : "border-line hover:border-line-strong",
                  )}
                >
                  <input type="radio" name="rating-private" checked={chosen} onChange={() => setPrivate(o.value)} className="absolute inset-0 z-10 size-full cursor-pointer appearance-none opacity-0" />
                  <o.icon size={17} aria-hidden="true" className={cn("row-span-2 mt-0.5 shrink-0", chosen ? "text-accent-ink" : "text-muted")} />
                  <span className="font-semibold">{o.title}</span>
                  <span className="text-xs text-muted">{o.body}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {editing ? (
          <p className="text-xs text-muted">{tr("يبقى التقييم قابلاً للتعديل والحذف 24 ساعة من كتابته، ثم يُحفظ في السجل.", "A rating can be changed or removed for 24 hours after it is written; then it stays in the history.")}</p>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Pill tone="new">{tr("تقييم سريع", "Quick rating")}</Pill>
            {tr("ليس التقييم الدوري للأداء. يمكنك تعديله أو حذفه خلال 24 ساعة.", "Not the periodic performance review. You can change or remove it for 24 hours.")}
          </p>
        )}

        {errors.form && (
          <p role="alert" className="text-danger">
            {errors.form}
          </p>
        )}
      </div>
    </Dialog>
  );
}
