import type { Priority, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Field, Input, PRIORITY, Select, Textarea } from "@/shared/ui";
import { PROJECT_STATE } from "../project-state";
import { PROJECT_LIMITS as L } from "../rules";
import type { ProjectState } from "../types";
import type { ProjectValues } from "./project-values";

/**
 * The project's main fields. `managers` fills the project-manager list; when `canPickPm` is false the field is
 * shown read-only (only the CEO hands a project to another manager). `withState` adds the state (edit only).
 */
export function ProjectFields({
  v,
  set,
  errors,
  managers,
  canPickPm,
  withState,
}: {
  v: ProjectValues;
  set: <K extends keyof ProjectValues>(k: K, value: ProjectValues[K]) => void;
  errors: Record<string, string>;
  managers: User[];
  canPickPm: boolean;
  withState?: boolean;
}) {
  const { tr, lang } = useFmt();
  const nameOf = (u: User) => (lang === "en" && u.name_en ? u.name_en : u.name);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={tr("اسم المشروع", "Project name")} htmlFor="project-name" error={errors.name}>
          <Input id="project-name" maxLength={L.name} value={v.name} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={tr("الاسم بالإنجليزية (اختياري)", "English name (optional)")} htmlFor="project-name-en" error={errors.name_en}>
          <Input id="project-name-en" dir="ltr" maxLength={L.name} value={v.name_en} onChange={(e) => set("name_en", e.target.value)} />
        </Field>
      </div>

      <Field label={tr("الوصف والأهداف", "Description and goals")} htmlFor="project-description" error={errors.description}>
        <Textarea
          id="project-description"
          maxLength={L.description}
          value={v.description}
          invalid={!!errors.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={tr("مدير القسم", "Department manager")}
          htmlFor="project-pm"
          error={errors.pm_id}
          hint={canPickPm ? undefined : tr("يغيّره المدير التنفيذي فقط.", "Only the CEO can change it.")}
        >
          <Select id="project-pm" value={v.pm_id} disabled={!canPickPm} invalid={!!errors.pm_id} onChange={(e) => set("pm_id", e.target.value)}>
            <option value="" disabled>
              {tr("اختر…", "Choose…")}
            </option>
            {managers.map((u) => (
              <option key={u.id} value={u.id}>
                {nameOf(u)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={tr("الأولوية", "Priority")} htmlFor="project-priority">
          <Select id="project-priority" value={v.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
            {(Object.keys(PRIORITY) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {tr(PRIORITY[p].ar, PRIORITY[p].en)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={tr("تاريخ البدء", "Start")} htmlFor="project-start" error={errors.start}>
          <Input id="project-start" type="date" value={v.start} invalid={!!errors.start} onChange={(e) => set("start", e.target.value)} />
        </Field>

        <Field label={tr("التاريخ المتوقع للإنجاز", "Expected end")} htmlFor="project-end" error={errors.end}>
          <Input id="project-end" type="date" value={v.end} min={v.start || undefined} invalid={!!errors.end} onChange={(e) => set("end", e.target.value)} />
        </Field>

        {withState && (
          <Field label={tr("حالة المشروع", "Project state")} htmlFor="project-state" error={errors.state}>
            <Select id="project-state" value={v.state} onChange={(e) => set("state", e.target.value as ProjectState)}>
              {(Object.keys(PROJECT_STATE) as ProjectState[]).map((s) => (
                <option key={s} value={s}>
                  {tr(PROJECT_STATE[s].ar, PROJECT_STATE[s].en)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-3 hover:bg-card-2">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={v.uses_sprints} onChange={(e) => set("uses_sprints", e.target.checked)} />
        <span className="flex flex-col gap-0.5 text-sm font-medium">
          {tr("يعمل بالدورات التطويرية (Sprints)", "Works in sprints")}
          <span className="text-[13px] font-normal text-muted">
            {tr("اختياري: للمشاريع التي تُنجز على دورات قصيرة.", "Optional: for projects done in short cycles.")}
          </span>
        </span>
      </label>
    </div>
  );
}
