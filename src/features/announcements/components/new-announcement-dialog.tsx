import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, Field, Input, Textarea, errorText, useToast } from "@/shared/ui";
import { announcementsApi } from "../api";
import { ANNOUNCEMENT_LIMITS as L } from "../rules";

/** Post an announcement to the whole company. Everyone gets a notification; the new announcement opens after. */
export function NewAnnouncementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tr } = useFmt();
  const toast = useToast();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Each time the window opens, it starts empty.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setBody("");
      setImportant(false);
      setErrors({});
      setFormError(undefined);
    }
  }

  const post = async () => {
    if (!title.trim()) return setErrors({ title: tr("اكتب عنوان الإعلان.", "Enter the announcement's title.") });
    setBusy(true);
    setErrors({});
    setFormError(undefined);
    try {
      const a = await announcementsApi.create({ title, body, important });
      toast(tr("نُشر الإعلان وأُبلغ الجميع.", "Posted. Everyone has been notified."));
      onClose();
      router.push(`/announcements/${a.id}`);
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
      title={tr("إعلان جديد", "New announcement")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={post} disabled={busy}>
            {busy ? tr("جارٍ النشر…", "Posting…") : tr("انشر لكل الشركة", "Post to everyone")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          post();
        }}
      >
        <Field label={tr("العنوان", "Title")} htmlFor="announcement-title" error={errors.title}>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a dialog moves focus into itself when it opens (WAI-ARIA dialog pattern) */}
          <Input id="announcement-title" autoFocus maxLength={L.title} value={title} invalid={!!errors.title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={tr("النص", "Text")} htmlFor="announcement-body" error={errors.body}>
          <Textarea id="announcement-body" className="min-h-36" maxLength={L.body} value={body} invalid={!!errors.body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-3 hover:bg-card-2">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={important} onChange={(e) => setImportant(e.target.checked)} />
          <span className="flex flex-col gap-0.5 text-sm font-medium">
            {tr("إعلان مهم", "Important")}
            <span className="text-[13px] font-normal text-muted">{tr("يُثبَّت أعلى القائمة ويظهر في لوحة التحكم.", "Pinned at the top, and shown on the CEO dashboard.")}</span>
          </span>
        </label>
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
