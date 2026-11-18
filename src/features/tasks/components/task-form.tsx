import { useState } from "react";
import { Button, Dialog, Field, Input, PRIORITY, Select, Textarea, errorText, useToast } from "@/shared/ui";
import type { Project, Sprint } from "@/features/projects";
import { ApiError } from "@/shared/api";
import type { Priority, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { tasksApi } from "../api";
import { LIMITS } from "../rules";
import type { Task, TaskPatch } from "../types";
import { today } from "@/shared/lib/utils";

interface Values {
  title: string;
  description: string;
  assignee_id: string;
  priority: Priority;
  start: string;
  due: string;
  due_note: string;
  sprint_id: string;
  phase_id: string;
  status: string;
}

const fromTask = (t: Task | undefined, project: Project, sprint?: Sprint): Values => ({
  title: t?.title ?? "",
  description: t?.description ?? "",
  assignee_id: t?.assignee_id ? String(t.assignee_id) : "",
  priority: t?.priority ?? "medium",
  start: t?.start ?? "",
  due: t?.due ?? "",
  due_note: "",
  sprint_id: t ? (t.sprint_id ? String(t.sprint_id) : "") : sprint ? String(sprint.id) : "",
  phase_id: t?.phase_id ? String(t.phase_id) : "",
  status: t?.status ?? project.statuses[0].key,
});

/**
 * Add a task, or edit one (`task` given). Errors from the server show under their field.
 * Changing the due day of an existing task asks for an optional reason (it goes into the history).
 */
export function TaskForm({
  open,
  onClose,
  onSaved,
  project,
  members,
  sprints,
  task,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (task: Task) => void;
  project: Project;
  members: User[];
  sprints: Sprint[];
  task?: Task;
}) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const day = today();
  // A new task goes into the sprint running today, if there is one.
  const current = sprints.find((s) => s.start <= day && day <= s.end);
  const [v, setV] = useState<Values>(() => fromTask(task, project, current));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(k: K, value: Values[K]) => setV((old) => ({ ...old, [k]: value }));
  const dueChanged = !!task && v.due !== (task.due ?? "");

  // Each time the window opens, it starts from the task (or empty), not from what was typed last time.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setV(fromTask(task, project, current));
      setErrors({});
      setFormError(undefined);
    }
  }

  const save = async () => {
    const title = v.title.trim();
    if (!title) {
      setErrors({ title: tr("اكتب عنوان المهمة.", "Enter the task's title.") });
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(undefined);
    try {
      let saved: Task;
      if (task) {
        const patch: TaskPatch = {
          title,
          description: v.description,
          assignee_id: v.assignee_id ? Number(v.assignee_id) : null,
          priority: v.priority,
          start: v.start,
          due: v.due,
          due_note: dueChanged ? v.due_note : undefined,
          sprint_id: v.sprint_id ? Number(v.sprint_id) : undefined,
          phase_id: project.phases.length ? (v.phase_id ? Number(v.phase_id) : null) : undefined,
        };
        saved = await tasksApi.updateTask(task.id, patch);
      } else {
        saved = await tasksApi.createTask(project.id, {
          title,
          description: v.description,
          assignee_id: v.assignee_id ? Number(v.assignee_id) : undefined,
          priority: v.priority,
          start: v.start || undefined,
          due: v.due || undefined,
          sprint_id: v.sprint_id ? Number(v.sprint_id) : undefined,
          phase_id: v.phase_id ? Number(v.phase_id) : undefined,
          status: v.status,
        });
      }
      toast(task ? tr("حُفظت التعديلات.", "Changes saved.") : tr(`أُضيفت المهمة ${saved.code}.`, `Task ${saved.code} added.`));
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else setFormError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  // Statuses a new task may start in: not blocked (needs a reason) and not done (needs approval).
  const startStatuses = project.statuses.filter((s) => s.tone !== "blocked" && s.tone !== "done");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? tr(`تعديل ${task.code}`, `Edit ${task.code}`) : tr("مهمة جديدة", "New task")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? tr("جارٍ الحفظ…", "Saving…") : task ? tr("احفظ", "Save") : tr("أضف المهمة", "Add task")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label={tr("العنوان", "Title")} htmlFor="task-title" error={errors.title}>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a dialog moves focus into itself when it opens (WAI-ARIA dialog pattern) */}
          <Input id="task-title" autoFocus maxLength={LIMITS.title} value={v.title} invalid={!!errors.title} onChange={(e) => set("title", e.target.value)} />
        </Field>

        <Field label={tr("الوصف والمطلوب", "Description")} htmlFor="task-description" error={errors.description}>
          <Textarea
            id="task-description"
            maxLength={LIMITS.description}
            value={v.description}
            invalid={!!errors.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tr("المسؤول عنها", "Assignee")} htmlFor="task-assignee" error={errors.assignee_id}>
            <Select id="task-assignee" value={v.assignee_id} invalid={!!errors.assignee_id} onChange={(e) => set("assignee_id", e.target.value)}>
              <option value="">{tr("غير مُسندة", "Unassigned")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {lang === "en" && m.name_en ? m.name_en : m.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={tr("الأولوية", "Priority")} htmlFor="task-priority">
            <Select id="task-priority" value={v.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {tr(PRIORITY[p].ar, PRIORITY[p].en)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={tr("تاريخ البدء", "Start")} htmlFor="task-start" error={errors.start}>
            <Input id="task-start" type="date" value={v.start} invalid={!!errors.start} onChange={(e) => set("start", e.target.value)} />
          </Field>

          <Field label={tr("موعد التسليم", "Due")} htmlFor="task-due" error={errors.due}>
            <Input id="task-due" type="date" value={v.due} min={v.start || undefined} invalid={!!errors.due} onChange={(e) => set("due", e.target.value)} />
          </Field>

          {project.phases.length > 0 && (
            <Field label={tr("المرحلة", "Phase")} htmlFor="task-phase" error={errors.phase_id}>
              <Select id="task-phase" value={v.phase_id} invalid={!!errors.phase_id} onChange={(e) => set("phase_id", e.target.value)}>
                <option value="">{tr("بلا مرحلة", "No phase")}</option>
                {project.phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {project.uses_sprints && sprints.length > 0 && (
            <Field label={tr("الدورة", "Sprint")} htmlFor="task-sprint" error={errors.sprint_id}>
              <Select id="task-sprint" value={v.sprint_id} onChange={(e) => set("sprint_id", e.target.value)}>
                <option value="">{tr("خارج الدورات", "No sprint")}</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {!task && (
            <Field label={tr("تبدأ في عمود", "Starts in")} htmlFor="task-status" error={errors.status}>
              <Select id="task-status" value={v.status} onChange={(e) => set("status", e.target.value)}>
                {startStatuses.map((s) => (
                  <option key={s.key} value={s.key}>
                    {lang === "en" ? s.name_en : s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {dueChanged && (
          <Field
            label={tr("سبب تغيير موعد التسليم (اختياري)", "Why the due date changed (optional)")}
            htmlFor="task-due-note"
            hint={tr("يُحفظ في سجل المهمة.", "It is kept in the task's history.")}
          >
            <Input id="task-due-note" maxLength={LIMITS.reason} value={v.due_note} onChange={(e) => set("due_note", e.target.value)} />
          </Field>
        )}

        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        {/* Enter in a field saves the form. */}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
