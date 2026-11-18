import { useState } from "react";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { today } from "@/shared/lib/utils";
import { Button, Field, Input } from "@/shared/ui";
import { projectsApi } from "../../api";
import { useSave } from "../../hooks/use-save";
import { canChangePm, PROJECT_LIMITS as L } from "../../rules";
import type { Project, ProjectPatch } from "../../types";
import { FormError } from "../form-error";
import { ProjectFields } from "../project-fields";
import { valuesOf, type ProjectValues } from "../project-values";

/** The project's main fields. A change to the plan (dates) or the state asks why; the reason goes into the history. */
export function DetailsTab({ project, user, people }: { project: Project; user: User; people: User[] }) {
  const { tr } = useFmt();
  const [v, setV] = useState<ProjectValues>(() => valuesOf(project));
  const [note, setNote] = useState("");
  const { busy, errors, formError, save } = useSave();
  const set = <K extends keyof ProjectValues>(k: K, value: ProjectValues[K]) => setV((old) => ({ ...old, [k]: value }));

  const planChanged = v.start !== project.start || v.end !== project.end;
  const stateChanged = v.state !== project.state;
  const started = project.start <= today();

  const submit = () => {
    const patch: ProjectPatch = {
      name: v.name,
      name_en: v.name_en,
      description: v.description,
      pm_id: Number(v.pm_id),
      start: v.start,
      end: v.end,
      priority: v.priority,
      uses_sprints: v.uses_sprints,
      state: v.state,
      note: planChanged || stateChanged ? note : undefined,
    };
    save(() => projectsApi.updateProject(project.id, patch), tr("حُفظت بيانات المشروع.", "Project saved."));
  };

  return (
    <form
      noValidate
      className="flex max-w-3xl flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <ProjectFields
        v={v}
        set={set}
        errors={errors}
        managers={people.filter((u) => u.role === "pm" && u.active)}
        canPickPm={canChangePm(user)}
        withState
      />
      {(planChanged || stateChanged) && (
        <Field
          label={
            planChanged && started
              ? tr("سبب تغيير الخطة بعد بدء التنفيذ", "Why the plan changed after work started")
              : tr("سبب التغيير (اختياري)", "Reason for the change (optional)")
          }
          htmlFor="project-note"
          error={errors.note}
          hint={tr("يُحفظ في سجل المشروع، ويراه الفريق.", "It is kept in the project's history for the team.")}
        >
          <Input id="project-note" maxLength={L.note} value={note} invalid={!!errors.note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      )}
      <FormError text={formError} />
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ البيانات", "Save details")}
        </Button>
      </div>
    </form>
  );
}
