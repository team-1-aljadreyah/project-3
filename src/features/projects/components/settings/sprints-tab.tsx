import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { today } from "@/shared/lib/utils";
import { Button, Dialog, Field, IconButton, Input, Pill } from "@/shared/ui";
import { projectsApi } from "../../api";
import { useSave } from "../../hooks/use-save";
import { PROJECT_LIMITS as L } from "../../rules";
import type { Project, Sprint, SprintInput } from "../../types";
import { FormError } from "../form-error";

const empty: SprintInput = { name: "", start: "", end: "" };

/**
 * The project's sprints: add one, change its name or days, or remove it (only when no task is in it).
 * Sprints of a project can't overlap.
 */
export function SprintsTab({ project, sprints }: { project: Project; sprints: Sprint[] }) {
  const { tr, day } = useFmt();
  const [form, setForm] = useState<SprintInput>(empty);
  const [editing, setEditing] = useState<Sprint | null>(null);
  const [removing, setRemoving] = useState<Sprint | null>(null);
  const { busy, errors, formError, save } = useSave();
  const remover = useSave();
  const now = today();
  const sorted = [...sprints].sort((a, b) => a.start.localeCompare(b.start));
  const set = (k: keyof SprintInput, value: string) => setForm((f) => ({ ...f, [k]: value }));

  const submit = async () => {
    const ok = await save(
      () => (editing ? projectsApi.updateSprint(editing.id, form) : projectsApi.createSprint(project.id, form)),
      editing ? tr("حُفظت الدورة.", "Sprint saved.") : tr("أُضيفت الدورة.", "Sprint added."),
    );
    if (ok) {
      setForm(empty);
      setEditing(null);
    }
  };

  if (!project.uses_sprints) {
    return (
      <p className="max-w-2xl rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
        {tr("هذا المشروع لا يعمل بالدورات. فعّلها من تبويب «البيانات» إذا احتجتها.", "This project doesn't use sprints. Turn them on in the Details tab if needed.")}
      </p>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <form
        noValidate
        className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h3 className="font-semibold">{editing ? tr(`تعديل ${editing.name}`, `Edit ${editing.name}`) : tr("دورة جديدة", "New sprint")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={tr("الاسم", "Name")} htmlFor="sprint-name" error={errors.name}>
            <Input id="sprint-name" maxLength={L.sprintName} value={form.name} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={tr("البداية", "Start")} htmlFor="sprint-start" error={errors.start}>
            <Input id="sprint-start" type="date" value={form.start} invalid={!!errors.start} onChange={(e) => set("start", e.target.value)} />
          </Field>
          <Field label={tr("النهاية", "End")} htmlFor="sprint-end" error={errors.end}>
            <Input id="sprint-end" type="date" min={form.start || undefined} value={form.end} invalid={!!errors.end} onChange={(e) => set("end", e.target.value)} />
          </Field>
        </div>
        <FormError text={formError} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? tr("جارٍ الحفظ…", "Saving…") : editing ? tr("احفظ الدورة", "Save sprint") : tr("أضف الدورة", "Add sprint")}
          </Button>
          {editing && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
            >
              {tr("إلغاء التعديل", "Cancel")}
            </Button>
          )}
        </div>
      </form>

      {sorted.length === 0 ? (
        <p className="text-center text-sm text-muted">{tr("لا توجد دورات بعد.", "No sprints yet.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((s) => {
            const state =
              s.end < now ? { ar: "انتهت", en: "Finished", tone: "new" as const }
              : s.start > now ? { ar: "قادمة", en: "Upcoming", tone: "todo" as const }
              : { ar: "جارية", en: "Running", tone: "progress" as const };
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
                <span className="font-medium">{s.name}</span>
                <Pill tone={state.tone}>{tr(state.ar, state.en)}</Pill>
                <span className="text-sm text-muted">
                  {day(s.start)} – {day(s.end)}
                </span>
                <span className="ms-auto flex gap-1">
                  <IconButton
                    label={tr(`عدّل ${s.name}`, `Edit ${s.name}`)}
                    className="size-8"
                    onClick={() => {
                      setEditing(s);
                      setForm({ name: s.name, start: s.start, end: s.end });
                    }}
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </IconButton>
                  <IconButton label={tr(`احذف ${s.name}`, `Remove ${s.name}`)} className="size-8 text-danger hover:bg-danger-soft" onClick={() => setRemoving(s)}>
                    <Trash2 size={15} aria-hidden="true" />
                  </IconButton>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={tr(`حذف ${removing?.name ?? ""}`, `Remove ${removing?.name ?? ""}`)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button
              className="bg-danger hover:bg-danger"
              disabled={remover.busy}
              onClick={async () => {
                if (removing && (await remover.save(() => projectsApi.deleteSprint(removing.id), tr("حُذفت الدورة.", "Sprint removed.")))) setRemoving(null);
              }}
            >
              {tr("احذف", "Remove")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {tr("تُحذف الدورة فقط إذا لم تكن فيها مهام. يبقى الحذف في سجل المشروع.", "A sprint can be removed only when it has no tasks. The removal stays in the project's history.")}
          </p>
          <FormError text={remover.formError} />
        </div>
      </Dialog>
    </div>
  );
}
