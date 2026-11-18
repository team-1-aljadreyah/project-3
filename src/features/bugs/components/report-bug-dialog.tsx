import { useState } from "react";
import { useNavigate } from "react-router";
import type { ProjectSummary } from "@/features/projects";
import { tasksApi } from "@/features/tasks";
import { ApiError } from "@/shared/api";
import type { Priority, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { Button, Dialog, Field, Input, PRIORITY, Select, Textarea, errorText, useToast } from "@/shared/ui";
import { bugsApi } from "../api";
import { SEVERITY } from "../labels";
import { BUG_LIMITS as L, canManageBugs, SEVERITY_ORDER } from "../rules";
import type { Severity } from "../types";

/**
 * Report a bug: its project, what happened, how bad it is, and (optionally) the task it belongs to. The managers can
 * also choose the developer and the expected fix day at once. Files are added on the bug's page after it is saved.
 */
export function ReportBugDialog({ open, onClose, projects, user, people }: { open: boolean; onClose: () => void; projects: ProjectSummary[]; user: User; people: User[] }) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [priority, setPriority] = useState<Priority>("medium");
  const [taskId, setTaskId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const project = projects.find((p) => p.id === projectId);
  const manager = !!project && canManageBugs(user, project);
  // The chosen project's tasks, for "which task is this about".
  const tasks = useLoad(() => (projectId ? tasksApi.tasks(projectId) : Promise.resolve([])), [projectId]);
  const nameOf = (u: User) => (lang === "en" && u.name_en ? u.name_en : u.name);

  // Each time the window opens, it starts empty.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setDescription("");
      setSeverity("medium");
      setPriority("medium");
      setTaskId("");
      setAssignee("");
      setDue("");
      setErrors({});
      setFormError(undefined);
    }
  }

  const save = async () => {
    if (!title.trim()) return setErrors({ title: tr("اكتب عنوان المشكلة.", "Enter the bug's title.") });
    setBusy(true);
    setErrors({});
    setFormError(undefined);
    try {
      const bug = await bugsApi.report(projectId, {
        title,
        description,
        severity,
        priority,
        task_id: taskId ? Number(taskId) : undefined,
        assignee_id: manager && assignee ? Number(assignee) : undefined,
        due: manager && due ? due : undefined,
      });
      toast(tr(`سُجّلت المشكلة ${bug.code}.`, `${bug.code} reported.`));
      onClose();
      navigate(`/bugs/${bug.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else setFormError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tr("تسجيل مشكلة برمجية", "Report a bug")}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy || !projectId}>
            {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("سجّل المشكلة", "Report")}
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
        <Field label={tr("المشروع", "Project")} htmlFor="bug-project">
          <Select
            id="bug-project"
            value={projectId}
            onChange={(e) => {
              setProjectId(Number(e.target.value));
              setTaskId("");
              setAssignee("");
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {lang === "en" && p.name_en ? p.name_en : p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr("العنوان", "Title")} htmlFor="bug-title" error={errors.title}>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a dialog moves focus into itself when it opens (WAI-ARIA dialog pattern) */}
          <Input id="bug-title" autoFocus maxLength={L.title} value={title} invalid={!!errors.title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={tr("ماذا حدث، وكيف نكرره؟", "What happened, and how to repeat it?")} htmlFor="bug-description" error={errors.description}>
          <Textarea id="bug-description" maxLength={L.description} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tr("درجة الخطورة", "Severity")} htmlFor="bug-severity" error={errors.severity}>
            <Select id="bug-severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {tr(SEVERITY[s].ar, SEVERITY[s].en)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tr("أولوية المعالجة", "Priority")} htmlFor="bug-priority">
            <Select id="bug-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {tr(PRIORITY[p].ar, PRIORITY[p].en)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tr("المهمة المرتبطة (اختياري)", "Related task (optional)")} htmlFor="bug-task" error={errors.task_id}>
            <Select id="bug-task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">{tr("بلا مهمة", "No task")}</option>
              {(tasks.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.title}
                </option>
              ))}
            </Select>
          </Field>
          {manager && project && (
            <>
              <Field label={tr("المطور المسؤول", "Developer")} htmlFor="bug-assignee" error={errors.assignee_id}>
                <Select id="bug-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">{tr("لاحقاً", "Later")}</option>
                  {people
                    .filter((u) => project.member_ids.includes(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {nameOf(u)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={tr("التاريخ المتوقع للإصلاح", "Expected fix day")} htmlFor="bug-due" error={errors.due}>
                <Input id="bug-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <p className="text-[13px] text-muted">{tr("الصور والملفات تُرفق من صفحة المشكلة بعد حفظها.", "Add screenshots and files on the bug's page after saving.")}</p>
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
