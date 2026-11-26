import { LogOut, Settings2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Button, Dialog, IconButton, errorText, useToast } from "@/shared/ui";
import { chatApi } from "../api";
import { canManageGroupChat } from "../rules";
import type { Conversation } from "../types";
import { GroupDialog } from "./group-dialog";

/**
 * The buttons in a group's header: "manage" (rename, members) for the person who manages it and the CEO, and "leave"
 * for every member, after a question, since they stop seeing the group.
 */
export function GroupActions({ group, people, me }: { group: Conversation; people: User[]; me: User }) {
  const { tr } = useFmt();
  const toast = useToast();
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const leave = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await chatApi.leaveGroup(group.key);
      setLeaving(false);
      toast(tr("غادرت المجموعة.", "You left the group."));
      router.push("/chat");
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {canManageGroupChat(me, group) && (
        <IconButton label={tr("إدارة المجموعة", "Manage the group")} onClick={() => setManaging(true)} className="size-9 bg-transparent">
          <Settings2 size={17} aria-hidden="true" />
        </IconButton>
      )}
      <IconButton label={tr("مغادرة المجموعة", "Leave the group")} onClick={() => setLeaving(true)} className="size-9 bg-transparent text-muted hover:text-danger">
        <LogOut size={17} aria-hidden="true" className="rtl:-scale-x-100" />
      </IconButton>

      <GroupDialog open={managing} onClose={() => setManaging(false)} people={people} me={me.id} group={group} />
      <Dialog
        open={leaving}
        onClose={() => setLeaving(false)}
        title={tr("مغادرة المجموعة؟", "Leave the group?")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLeaving(false)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button onClick={leave} disabled={busy} className="bg-danger hover:bg-danger">
              {busy ? tr("جارٍ المغادرة…", "Leaving…") : tr("غادر", "Leave")}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {tr("لن ترى رسائل هذه المجموعة بعد الآن، ولا يعيدك إليها إلا من يديرها.", "You will no longer see this group's messages. Only the person who manages it can add you back.")}
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
