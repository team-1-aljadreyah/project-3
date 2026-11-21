import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, Field, Input, errorText, useToast, PeoplePicker } from "@/shared/ui";
import { chatApi } from "../api";
import { CHAT_LIMITS as L, mayJoinGroup } from "../rules";
import type { Conversation } from "../types";

/**
 * Make a group chat (a name and the people in it), or, with `group`, rename one and change its members. The person
 * who manages the group is always in it, so they are not in the list to pick from. A new group opens after.
 */
export function GroupDialog({
  open,
  onClose,
  people,
  me,
  group,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  people: User[];
  me: number;
  group?: Conversation;
  /** The new group, so the page can show it at once (before the list loads again). */
  onCreated?: (c: Conversation) => void;
}) {
  const { tr } = useFmt();
  const toast = useToast();
  const router = useRouter();
  const owner = group?.created_by ?? me;
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Each time the window opens it starts again: empty for a new group, or the group as it is now.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(group?.title ?? "");
      // Someone whose account was closed since is dropped (the server would refuse them).
      setPicked(group ? group.member_ids.filter((id) => id !== owner && people.some((u) => u.id === id && mayJoinGroup(u))) : []);
      setErrors({});
      setFormError(undefined);
    }
  }

  const save = async () => {
    // The same checks as the server, so the person sees them at once.
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = tr("اكتب اسم المجموعة.", "Enter the group's name.");
    if (picked.length < L.groupOthers) found.member_ids = tr("اختر شخصين آخرين على الأقل.", "Pick at least two other people.");
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFormError(undefined);
    try {
      if (group) {
        await chatApi.updateGroup(group.key, { name, member_ids: picked });
        toast(tr("حُفظت المجموعة.", "The group is saved."));
        onClose();
      } else {
        const c = await chatApi.createGroup({ name, member_ids: picked });
        onCreated?.(c);
        onClose();
        router.push(`/chat/${c.key}`);
      }
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
      title={group ? tr("إدارة المجموعة", "Manage the group") : tr("مجموعة جديدة", "New group")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? tr("جارٍ الحفظ…", "Saving…") : group ? tr("احفظ", "Save") : tr("أنشئ المجموعة", "Create the group")}
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
        <Field label={tr("اسم المجموعة", "Group name")} htmlFor="group-name" error={errors.name}>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a dialog moves focus into itself when it opens (WAI-ARIA dialog pattern) */}
          <Input id="group-name" autoFocus maxLength={L.groupName} value={name} invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <PeoplePicker people={people.filter((u) => u.id !== owner && mayJoinGroup(u))} value={picked} onChange={setPicked} error={errors.member_ids} />
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
