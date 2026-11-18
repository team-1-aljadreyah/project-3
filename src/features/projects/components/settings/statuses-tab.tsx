import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { StatusTone } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Button, IconButton, Input, Select, StatusPill } from "@/shared/ui";
import { projectsApi } from "../../api";
import { useSave } from "../../hooks/use-save";
import { isBaseStatus, PROJECT_LIMITS as L } from "../../rules";
import type { Project, StatusInput } from "../../types";
import { FormError } from "../form-error";

/** What each colour family means. The family decides the rules: "blocked" needs a reason, "done" needs approval. */
const TONES: { tone: StatusTone; ar: string; en: string }[] = [
  { tone: "new", ar: "جديدة", en: "New" },
  { tone: "todo", ar: "بانتظار البدء", en: "To do" },
  { tone: "progress", ar: "قيد العمل", en: "In progress" },
  { tone: "review", ar: "مراجعة", en: "Review" },
  { tone: "testing", ar: "اختبار", en: "Testing" },
  { tone: "done", ar: "مكتملة (تحتاج اعتماداً)", en: "Done (needs approval)" },
  { tone: "blocked", ar: "متوقفة (تحتاج سبباً)", en: "Blocked (needs a reason)" },
];

type Row = StatusInput & { rowId: number };

/**
 * The project's columns. The seven base statuses (the brief) are locked: they can move but not be renamed or
 * removed. The project's own statuses can be added, renamed, moved and removed (if no task is in them).
 */
export function StatusesTab({ project }: { project: Project }) {
  const { tr, lang } = useFmt();
  const [rows, setRows] = useState<Row[]>(() => project.statuses.map((s, i) => ({ ...s, rowId: i })));
  const [nextId, setNextId] = useState(project.statuses.length);
  const { busy, errors, formError, save } = useSave();

  const update = (rowId: number, change: Partial<Row>) => setRows((list) => list.map((r) => (r.rowId === rowId ? { ...r, ...change } : r)));
  const move = (index: number, by: -1 | 1) =>
    setRows((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  const add = () => {
    setRows((list) => [...list, { rowId: nextId, name: "", name_en: "", tone: "review" }]);
    setNextId((n) => n + 1);
  };

  const submit = () =>
    save(
      () => projectsApi.saveStatuses(project.id, rows.map(({ key, name, name_en, tone }) => ({ key, name, name_en, tone }))),
      tr("حُفظت الحالات.", "Statuses saved."),
    );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted">
        {tr(
          "ترتيب الحالات هنا هو ترتيب أعمدة لوحة المهام. نوع الحالة يحدد قواعدها: المتوقفة تحتاج سبباً، والمكتملة تحتاج اعتماداً.",
          "The order here is the board's column order. A status's family sets its rules: blocked needs a reason, done needs approval.",
        )}
      </p>
      <ol className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const base = isBaseStatus(r.key);
          const label = r.name || tr("حالة جديدة", "New status");
          return (
            <li key={r.rowId} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-2.5">
              <div className="flex gap-1">
                <IconButton label={tr(`انقل «${label}» للأعلى`, `Move "${label}" up`)} disabled={i === 0} onClick={() => move(i, -1)} className="size-8 disabled:opacity-30">
                  <ArrowUp size={15} aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={tr(`انقل «${label}» للأسفل`, `Move "${label}" down`)}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                  className="size-8 disabled:opacity-30"
                >
                  <ArrowDown size={15} aria-hidden="true" />
                </IconButton>
              </div>
              {base ? (
                <span className="flex flex-1 items-center gap-2">
                  <StatusPill status={{ key: r.key!, name: r.name, name_en: r.name_en, tone: r.tone }} />
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Lock size={12} aria-hidden="true" />
                    {tr("حالة أساسية", "Base status")}
                  </span>
                </span>
              ) : (
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    aria-label={tr("اسم الحالة", "Status name")}
                    placeholder={tr("اسم الحالة", "Status name")}
                    maxLength={L.statusName}
                    value={r.name}
                    onChange={(e) => update(r.rowId, { name: e.target.value })}
                  />
                  <Input
                    aria-label={tr("الاسم بالإنجليزية", "English name")}
                    placeholder={tr("الاسم بالإنجليزية", "English name")}
                    dir="ltr"
                    maxLength={L.statusName}
                    value={r.name_en}
                    onChange={(e) => update(r.rowId, { name_en: e.target.value })}
                  />
                  <Select aria-label={tr("نوع الحالة", "Status family")} value={r.tone} onChange={(e) => update(r.rowId, { tone: e.target.value as StatusTone })}>
                    {TONES.map((t) => (
                      <option key={t.tone} value={t.tone}>
                        {lang === "en" ? t.en : t.ar}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {!base && (
                <IconButton
                  label={tr(`احذف «${label}»`, `Remove "${label}"`)}
                  onClick={() => setRows((list) => list.filter((x) => x.rowId !== r.rowId))}
                  className="size-8 text-danger hover:bg-danger-soft"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </IconButton>
              )}
            </li>
          );
        })}
      </ol>
      {errors.statuses && <p className="text-[13px] text-danger">{errors.statuses}</p>}
      <FormError text={formError} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={add} disabled={rows.length >= L.statuses}>
          <Plus size={15} aria-hidden="true" />
          {tr("أضف حالة", "Add a status")}
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ الحالات", "Save statuses")}
        </Button>
      </div>
    </div>
  );
}
