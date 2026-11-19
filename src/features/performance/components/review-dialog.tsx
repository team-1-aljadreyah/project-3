import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, errorText, Field, Input, Select, Textarea, useToast } from "@/shared/ui";
import { performanceApi } from "../api";
import { scoreReview } from "../metrics";
import { REVIEW_LIMITS } from "../rules";
import type { Criteria, Period, PersonPerf, Review } from "../types";

/**
 * Writing a review (or changing a draft): the counted criteria come from the tasks of the period, the reviewer gives
 * 1–5 for the others and writes notes. Saved as a draft; "Make final" (when the criteria are approved) can't be undone.
 */
export function ReviewDialog({
  userId,
  name,
  criteria,
  perf,
  period: startPeriod,
  draft,
  today,
  onClose,
  onSaved,
}: {
  userId: number;
  name: string;
  criteria: Criteria;
  /** The counted numbers for the chosen period (shown as the counted scores; the server counts them again). */
  perf: PersonPerf;
  period: Period;
  draft?: Review;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>(draft?.period ?? { ...startPeriod, to: startPeriod.to > today ? today : startPeriod.to });
  const [stars, setStars] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.entries(draft?.scores ?? {}).filter(([k]) => criteria.items.some((c) => c.id === k && c.kind === "manual")).map(([k, v]) => [k, v / 20])),
  );
  const [note, setNote] = useState(draft?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const preview = scoreReview(criteria.items, perf, stars);
  const approved = !!criteria.approved_at;
  const complete = criteria.items.every((c) => c.kind === "auto" || stars[c.id]);

  const save = async (final: boolean) => {
    setBusy(true);
    setErrors({});
    try {
      const saved = await performanceApi.saveReview({ user_id: userId, period, stars, note }, draft?.id);
      if (final) await performanceApi.finalizeReview(saved.id);
      toast(final ? tr("اعتُمد التقييم وأُبلغ الموظف.", "The review is final; the person was told.") : tr("حُفظت المسودة.", "Draft saved."));
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else setErrors({ form: errorText(e, tr) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={tr(`تقييم أداء ${name}`, `Review of ${name}`)}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
            {tr("احفظ مسودة", "Save draft")}
          </Button>
          <Button onClick={() => save(true)} disabled={busy || !approved || !complete}>
            {tr("اعتمد التقييم", "Make final")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("من", "From")} htmlFor="review-from" error={errors.period}>
            <Input id="review-from" type="date" value={period.from} max={period.to} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} />
          </Field>
          <Field label={tr("إلى", "To")} htmlFor="review-to">
            <Input id="review-to" type="date" value={period.to} min={period.from} max={today} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} />
          </Field>
        </div>
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {criteria.items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span>
                <b className="font-medium">{lang === "en" ? c.name_en : c.name}</b>{" "}
                <span className="text-xs text-muted">
                  ({tr(`الوزن ${c.weight}`, `weight ${c.weight}`)} · {c.kind === "auto" ? tr("يحسبه النظام", "counted") : tr("يقيّمه المسؤول", "you score it")})
                </span>
              </span>
              {c.kind === "auto" ? (
                <span className="num font-semibold">{preview.scores[c.id]}/100</span>
              ) : (
                <Select
                  aria-label={tr(`درجة ${c.name}`, `Score for ${c.name_en}`)}
                  value={stars[c.id] ?? ""}
                  onChange={(e) => setStars((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                  className="h-9 w-40"
                >
                  <option value="">{tr("اختر…", "Choose…")}</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)} {tr(["", "ضعيف", "مقبول", "جيد", "جيد جداً", "ممتاز"][n], ["", "Poor", "Fair", "Good", "Very good", "Excellent"][n])}
                    </option>
                  ))}
                </Select>
              )}
            </li>
          ))}
        </ul>
        <p className="flex items-center justify-between rounded-lg bg-chip px-3 py-2">
          <span>{tr("المجموع (بالأوزان)", "Total (weighted)")}</span>
          <b className="num text-lg">{preview.total}/100</b>
        </p>
        <Field label={tr("ملاحظات المسؤول المباشر", "The manager's notes")} htmlFor="review-note" error={errors.note}>
          <Textarea id="review-note" rows={3} maxLength={REVIEW_LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {!approved && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-danger">
            {tr("لم تعتمد الإدارة معايير التقييم بعد: يمكنك حفظ مسودة فقط.", "The management hasn't approved the criteria yet: you can only save a draft.")}
          </p>
        )}
        {(errors.form || errors.stars) && (
          <p role="alert" className="text-danger">
            {errors.form ?? errors.stars}
          </p>
        )}
      </div>
    </Dialog>
  );
}
