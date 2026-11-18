import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { Button, IconButton, Input } from "@/shared/ui";
import { projectsApi } from "../../api";
import { useSave } from "../../hooks/use-save";
import { PROJECT_LIMITS as L } from "../../rules";
import type { PhaseInput, Project } from "../../types";
import { FormError } from "../form-error";

type Row = PhaseInput & { rowId: number };

/**
 * The project's phases, in order. Optional (the brief): a project can work with tasks only and no phases.
 * A phase that still has tasks can't be removed until the tasks move to another phase.
 */
export function PhasesTab({ project }: { project: Project }) {
  const { tr } = useFmt();
  const [rows, setRows] = useState<Row[]>(() => project.phases.map((p, i) => ({ ...p, rowId: i })));
  const [nextId, setNextId] = useState(project.phases.length);
  const { busy, errors, formError, save } = useSave();

  const move = (index: number, by: -1 | 1) =>
    setRows((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  const add = () => {
    setRows((list) => [...list, { rowId: nextId, name: "" }]);
    setNextId((n) => n + 1);
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-muted">
        {tr(
          "المراحل اختيارية: بعض المشاريع مقسمة إلى مراحل، وبعضها مهام مباشرة. تُختار مرحلة كل مهمة من نموذج المهمة.",
          "Phases are optional: some projects have phases, some are tasks only. Each task's phase is chosen in the task form.",
        )}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          {tr("هذا المشروع بلا مراحل.", "This project has no phases.")}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const label = r.name || tr("مرحلة جديدة", "New phase");
            return (
              <li key={r.rowId} className="flex items-center gap-2 rounded-xl border border-line bg-card p-2.5">
                <span className="num w-6 text-center text-sm text-muted">{i + 1}</span>
                <Input
                  aria-label={tr(`اسم المرحلة ${i + 1}`, `Phase ${i + 1} name`)}
                  placeholder={tr("اسم المرحلة", "Phase name")}
                  maxLength={L.phaseName}
                  value={r.name}
                  onChange={(e) => setRows((list) => list.map((x) => (x.rowId === r.rowId ? { ...x, name: e.target.value } : x)))}
                />
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
                <IconButton
                  label={tr(`احذف «${label}»`, `Remove "${label}"`)}
                  onClick={() => setRows((list) => list.filter((x) => x.rowId !== r.rowId))}
                  className="size-8 text-danger hover:bg-danger-soft"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </IconButton>
              </li>
            );
          })}
        </ol>
      )}
      {errors.phases && <p className="text-[13px] text-danger">{errors.phases}</p>}
      <FormError text={formError} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={add} disabled={rows.length >= L.phases}>
          <Plus size={15} aria-hidden="true" />
          {tr("أضف مرحلة", "Add a phase")}
        </Button>
        <Button
          disabled={busy}
          onClick={() => save(() => projectsApi.savePhases(project.id, rows.map(({ id, name }) => ({ id, name }))), tr("حُفظت المراحل.", "Phases saved."))}
        >
          {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ المراحل", "Save phases")}
        </Button>
      </div>
    </div>
  );
}
