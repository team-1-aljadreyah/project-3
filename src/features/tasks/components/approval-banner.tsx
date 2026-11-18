import { useState } from "react";
import { Button, errorText, useToast } from "@/shared/ui";
import { ApiError } from "@/shared/api";
import type { User } from "@/shared/api/types";
import { tasksApi } from "../api";
import type { Task } from "../types";
import { useFmt } from "@/shared/lib/i18n";
import { ReasonDialog } from "./reason-dialog";

/**
 * A completion request waiting on the task, or the last one that was sent back. Someone who may approve sees
 * "اعتمد" and "أرجعها" (sending back needs a note, so the assignee knows what to fix).
 */
export function ApprovalBanner({ task, people, canDecide, onDone }: { task: Task; people: Map<number, User>; canDecide: boolean; onDone: () => void }) {
  const { tr, lang, ago } = useFmt();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const a = task.approval;
  if (!a || a.state === "approved") return null;

  const nameOf = (id?: number) => {
    const u = id ? people.get(id) : undefined;
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };

  const decide = async (approve: boolean, note?: string): Promise<string | void> => {
    setBusy(true);
    try {
      await tasksApi.decideCompletion(task.id, { approve, note });
      toast(approve ? tr("اعتُمد إكمال المهمة.", "Approved as done.") : tr("أُرجعت المهمة مع ملاحظتك.", "Sent back with your note."));
      onDone();
    } catch (e) {
      const message = e instanceof ApiError && e.errors?.note ? e.errors.note : errorText(e, tr);
      if (note !== undefined) return message;
      toast(message, "danger");
    } finally {
      setBusy(false);
    }
  };

  if (a.state === "rejected") {
    return (
      <div className="rounded-xl border border-line bg-card px-4 py-3 text-sm">
        <p>
          <b>{tr("أُرجعت المهمة:", "Sent back:")}</b> {tr(`لم يعتمد ${nameOf(a.decided_by)} إكمالها`, `${nameOf(a.decided_by)} did not approve it`)}{" "}
          <span className="text-muted">({ago(a.decided_at)})</span>
        </p>
        {a.note && <p className="mt-1 text-muted">«{a.note}»</p>}
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-ink">
      <p>
        <b>{tr("بانتظار اعتماد الإكمال:", "Waiting for approval:")}</b>{" "}
        {tr(`طلب ${nameOf(a.requested_by)} اعتماد إكمال المهمة`, `${nameOf(a.requested_by)} asked to approve it as done`)}{" "}
        <span className="opacity-80">({ago(a.requested_at)})</span>
      </p>
      {canDecide && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setSendingBack(true)}>
            {tr("أرجعها مع ملاحظة", "Send back")}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => decide(true)}>
            {tr("اعتمد الإكمال", "Approve")}
          </Button>
        </div>
      )}
      <ReasonDialog
        open={sendingBack}
        title={tr(`إرجاع ${task.code}`, `Send back ${task.code}`)}
        label={tr("ما الذي يحتاج إلى إصلاح؟", "What needs fixing?")}
        hint={tr("تعود المهمة إلى الحالة التي طُلب منها الاعتماد، ويرى المسؤول ملاحظتك.", "The task goes back to where it was, and the assignee sees your note.")}
        submitLabel={tr("أرجعها", "Send back")}
        onClose={() => setSendingBack(false)}
        onSubmit={(note) => decide(false, note)}
      />
    </div>
  );
}
