import { useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, errorText, useToast } from "@/shared/ui";
import { projectsApi } from "../api";
import { canChangePm } from "../rules";
import { MemberPicker } from "./member-picker";
import { ProjectFields } from "./project-fields";
import { valuesOf, type ProjectValues } from "./project-values";

/**
 * Create a project: its main fields and its members. It starts with the seven base statuses and no phases; the
 * project's settings page adds those. After saving, the new project's board opens.
 */
export function NewProjectDialog({ open, onClose, user, people }: { open: boolean; onClose: () => void; user: User; people: User[] }) {
  const { tr } = useFmt();
  const toast = useToast();
  const navigate = useNavigate();
  // A project manager creates projects they manage; the CEO picks the manager.
  const pickPm = canChangePm(user);
  const fresh = () => valuesOf(undefined, pickPm ? undefined : user.id);
  const [v, setV] = useState<ProjectValues>(fresh);
  const [members, setMembers] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProjectValues>(k: K, value: ProjectValues[K]) => setV((old) => ({ ...old, [k]: value }));

  // Each time the window opens, it starts empty, not with what was typed last time.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setV(fresh());
      setMembers([]);
      setErrors({});
      setFormError(undefined);
    }
  }

  const save = async () => {
    // The checks a person can fix at once, before asking the server (the server checks everything again).
    const missing: Record<string, string> = {};
    if (!v.name.trim()) missing.name = tr("اكتب اسم المشروع.", "Enter the project's name.");
    if (!v.pm_id) missing.pm_id = tr("اختر مدير المشروع.", "Choose the project manager.");
    if (!v.start) missing.start = tr("اختر تاريخ البدء.", "Choose the start date.");
    if (!v.end) missing.end = tr("اختر التاريخ المتوقع للإنجاز.", "Choose the expected end date.");
    if (Object.keys(missing).length) return setErrors(missing);

    setBusy(true);
    setErrors({});
    setFormError(undefined);
    try {
      const project = await projectsApi.createProject({
        name: v.name,
        name_en: v.name_en,
        description: v.description,
        pm_id: Number(v.pm_id),
        member_ids: members,
        start: v.start,
        end: v.end,
        priority: v.priority,
        uses_sprints: v.uses_sprints,
      });
      toast(tr(`أُنشئ المشروع ${project.code}.`, `Project ${project.code} created.`));
      onClose();
      navigate(`/projects/${project.id}`);
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
      title={tr("مشروع جديد", "New project")}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? tr("جارٍ الإنشاء…", "Creating…") : tr("أنشئ المشروع", "Create project")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <ProjectFields
          v={v}
          set={set}
          errors={errors}
          managers={people.filter((u) => u.role === "pm" && u.active)}
          canPickPm={pickPm}
        />
        <MemberPicker people={people} value={members} onChange={setMembers} locked={v.pm_id ? [Number(v.pm_id)] : []} error={errors.member_ids} />
        <p className="text-[13px] text-muted">
          {tr(
            "يبدأ المشروع بالحالات الأساسية السبع. تضاف الحالات الخاصة والمراحل والدورات من إعدادات المشروع.",
            "The project starts with the seven base statuses. Add its own statuses, phases and sprints in the project's settings.",
          )}
        </p>
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
