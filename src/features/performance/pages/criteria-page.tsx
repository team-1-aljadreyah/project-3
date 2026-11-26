import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { Button, ErrorBox, IconButton, Input, LoadingBlock, Pill, Select, Skeleton, errorText, useToast } from "@/shared/ui";
import { performanceApi } from "../api";
import { canManageCriteria } from "../rules";
import type { Criteria, Criterion, Metric } from "../types";

const METRICS: { key: Metric; ar: string; en: string }[] = [
  { key: "completion", ar: "نسبة الإنجاز", en: "Completion" },
  { key: "on_time", ar: "الإنجاز في الموعد", en: "On time" },
  { key: "not_late", ar: "قلة التأخير", en: "Few late tasks" },
];

/**
 * The review criteria and formula (the brief: set and approved by the management before reviews are final). The total
 * is Σ score × weight / 100. Everyone who uses reviews can read them; the CEO changes and approves them.
 */
export function CriteriaPage() {
  const { tr } = useFmt();
  usePageTitle(tr("معايير التقييم", "Review criteria"));
  const user = useUser();
  const load = useLoad(() => performanceApi.criteria());

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted">
          <Link href="/performance" className="hover:text-text hover:underline">
            {tr("الأداء", "Performance")}
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{tr("معايير التقييم", "Review criteria")}</span>
        </nav>
        <h1 className="text-2xl font-semibold">{tr("معايير التقييم وطريقة الحساب", "Review criteria and formula")}</h1>
        <p className="text-sm text-muted">
          {tr("المجموع = مجموع (الدرجة × الوزن ÷ 100). تُحسب بعض المعايير من المهام، ويقيّم المسؤول البقية من 1 إلى 5.", "Total = sum of (score × weight ÷ 100). Counted criteria come from the tasks; the reviewer scores the rest 1–5.")}
        </p>
      </div>
      {load.state.status === "loading" && (
        <LoadingBlock>
          <Skeleton className="h-64" />
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}
      {load.data && <CriteriaEditor key={load.data.updated_at + (load.data.approved_at ?? "")} criteria={load.data} canEdit={canManageCriteria(user)} onSaved={load.reload} />}
    </div>
  );
}

function CriteriaEditor({ criteria, canEdit, onSaved }: { criteria: Criteria; canEdit: boolean; onSaved: () => void }) {
  const { tr, lang, day } = useFmt();
  const toast = useToast();
  const [items, setItems] = useState<Criterion[]>(criteria.items);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const sum = items.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const changed = JSON.stringify(items) !== JSON.stringify(criteria.items);
  const set = (i: number, patch: Partial<Criterion>) => setItems((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const run = async (job: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await job();
      toast(done);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError && e.errors ? Object.values(e.errors)[0] : errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {criteria.approved_at ? (
          <Pill tone="done">
            <CheckCircle2 size={13} aria-hidden="true" />
            {tr(`اعتُمدت في ${day(criteria.approved_at)}`, `Approved on ${day(criteria.approved_at)}`)}
          </Pill>
        ) : (
          <Pill tone="blocked">{tr("غير معتمدة: لا تُعتمد التقييمات قبل أن تعتمد الإدارة المعايير", "Not approved: reviews can't be final until the management approves")}</Pill>
        )}
      </p>

      <ul className="flex flex-col gap-2">
        {items.map((c, i) => (
          <li key={c.id || i} className="grid gap-2 rounded-xl border border-line bg-card p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-center">
            {canEdit ? (
              <>
                <Input aria-label={tr(`اسم المعيار ${i + 1}`, `Criterion ${i + 1} name`)} value={c.name} onChange={(e) => set(i, { name: e.target.value })} className="h-9" />
                <Input aria-label={tr(`الاسم الإنجليزي للمعيار ${i + 1}`, `Criterion ${i + 1} English name`)} dir="ltr" value={c.name_en} onChange={(e) => set(i, { name_en: e.target.value })} className="h-9" />
                <Select
                  aria-label={tr(`نوع المعيار ${i + 1}`, `Criterion ${i + 1} kind`)}
                  value={c.kind === "auto" ? c.metric : "manual"}
                  onChange={(e) => set(i, e.target.value === "manual" ? { kind: "manual", metric: undefined } : { kind: "auto", metric: e.target.value as Metric })}
                  className="h-9 w-auto"
                >
                  <option value="manual">{tr("يقيّمه المسؤول", "Reviewer scores")}</option>
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {tr(`محسوب: ${m.ar}`, `Counted: ${m.en}`)}
                    </option>
                  ))}
                </Select>
                <Input aria-label={tr(`وزن المعيار ${i + 1}`, `Criterion ${i + 1} weight`)} type="number" min={1} max={100} value={c.weight} onChange={(e) => set(i, { weight: Number(e.target.value) })} className="h-9 w-20" />
                <IconButton label={tr(`احذف المعيار ${i + 1}`, `Remove criterion ${i + 1}`)} onClick={() => setItems((list) => list.filter((_, j) => j !== i))} className="bg-transparent text-muted hover:text-danger">
                  <Trash2 size={15} aria-hidden="true" />
                </IconButton>
              </>
            ) : (
              <>
                <b className="sm:col-span-2">{lang === "en" ? c.name_en : c.name}</b>
                <span className="text-sm text-muted">{c.kind === "auto" ? tr(`محسوب: ${METRICS.find((m) => m.key === c.metric)?.ar}`, `Counted: ${METRICS.find((m) => m.key === c.metric)?.en}`) : tr("يقيّمه المسؤول", "Reviewer scores")}</span>
                <span className="num text-sm">{tr(`الوزن ${c.weight}`, `weight ${c.weight}`)}</span>
              </>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" pill onClick={() => setItems((list) => [...list, { id: "", name: "", name_en: "", kind: "manual", weight: 10 }])}>
            <Plus size={15} aria-hidden="true" />
            {tr("أضف معياراً", "Add a criterion")}
          </Button>
          <span className={sum === 100 ? "text-sm text-muted" : "text-sm font-semibold text-danger"}>{tr(`مجموع الأوزان: ${sum} من 100`, `Weights: ${sum} of 100`)}</span>
          <span className="ms-auto flex gap-2">
            <Button onClick={() => run(() => performanceApi.saveCriteria(items), tr("حُفظت المعايير. اعتمدها لتُستعمل.", "Criteria saved. Approve them to use them."))} disabled={busy || !changed}>
              {tr("احفظ المعايير", "Save criteria")}
            </Button>
            {!criteria.approved_at && (
              <Button onClick={() => run(() => performanceApi.approveCriteria(), tr("اعتُمدت المعايير.", "Criteria approved."))} disabled={busy || changed}>
                {tr("اعتمد المعايير", "Approve criteria")}
              </Button>
            )}
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
