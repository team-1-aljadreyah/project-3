import { useState } from "react";
import type { Project } from "@/features/projects";
import { ApiError } from "@/shared/api";
import type { Priority, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, Field, Input, PRIORITY, Select, errorText, useToast } from "@/shared/ui";
import { bugsApi } from "../api";
import { SEVERITY } from "../labels";
import { SEVERITY_ORDER } from "../rules";
import type { Bug, Severity } from "../types";

/** The managers change the developer, severity, priority and expected fix day. Each change goes into the history. */
export function BugEditDialog({ open, onClose, bug, project, people }: { open: boolean; onClose: () => void; bug: Bug; project: Project; people: User[] }) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const [assignee, setAssignee] = useState(bug.assignee_id ? String(bug.assignee_id) : "");
  const [severity, setSeverity] = useState<Severity>(bug.severity);
  const [priority, setPriority] = useState<Priority>(bug.priority);
  const [due, setDue] = useState(bug.due ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setErrors({});
    setFormError(undefined);
    try {
      await bugsApi.update(bug.id, { assignee_id: assignee ? Number(assignee) : null, severity, priority, due: due || null });
      toast(tr("حُفظت التعديلات.", "Changes saved."));
      onClose();
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
      title={tr(`تعديل ${bug.code}`, `Edit ${bug.code}`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ", "Save")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={tr("المطور المسؤول", "Developer")} htmlFor="edit-assignee" error={errors.assignee_id}>
          <Select id="edit-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{tr("غير مُسندة", "Unassigned")}</option>
            {people
              .filter((u) => project.member_ids.includes(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {lang === "en" && u.name_en ? u.name_en : u.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label={tr("التاريخ المتوقع للإصلاح", "Expected fix day")} htmlFor="edit-due" error={errors.due}>
          <Input id="edit-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label={tr("درجة الخطورة", "Severity")} htmlFor="edit-severity">
          <Select id="edit-severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s}>
                {tr(SEVERITY[s].ar, SEVERITY[s].en)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr("أولوية المعالجة", "Priority")} htmlFor="edit-priority">
          <Select id="edit-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(Object.keys(PRIORITY) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {tr(PRIORITY[p].ar, PRIORITY[p].en)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {formError && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}
    </Dialog>
  );
}
