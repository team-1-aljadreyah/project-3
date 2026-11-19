import { useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, Field, Input, Textarea } from "@/shared/ui";
import { projectsApi } from "../api";
import { useSave } from "../hooks/use-save";
import { PROJECT_LIMITS as L } from "../rules";
import type { Project } from "../types";
import { FormError } from "./form-error";

/**
 * "Save as template": the project's statuses, phases, sprint setting and task list (titles, descriptions, priorities,
 * phases) are kept under a name, so a similar project can start from it. People, dates and comments are not kept.
 */
export function SaveTemplateDialog({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const { tr } = useFmt();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState("");
  const { busy, errors, formError, save } = useSave();

  const submit = async () => {
    const ok = await save(() => projectsApi.saveTemplate(project.id, { name, description }), tr(`حُفظ القالب «${name.trim()}».`, `Template "${name.trim()}" saved.`));
    if (ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tr("حفظ المشروع كقالب", "Save the project as a template")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {tr("احفظ القالب", "Save template")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={tr("اسم القالب", "Template name")} htmlFor="template-name" error={errors.name}>
          <Input id="template-name" value={name} maxLength={L.templateName} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label={tr("وصف قصير (اختياري)", "Short description (optional)")} htmlFor="template-description">
          <Textarea id="template-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <p className="text-[13px] text-muted">
          {tr(
            "يُحفظ: الحالات، والمراحل، والعمل بالدورات، وقائمة المهام. لا يُحفظ: الأشخاص والتواريخ والتعليقات والملفات.",
            "Kept: the statuses, phases, sprint setting and task list. Not kept: people, dates, comments and files.",
          )}
        </p>
        <FormError text={formError} />
      </form>
    </Dialog>
  );
}
