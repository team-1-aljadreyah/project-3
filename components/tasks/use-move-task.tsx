"use client";

import { useState } from "react";
import { errorText, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Project, Task, User } from "@/lib/api/types";
import { useFmt } from "@/lib/i18n";
import { planMove, statusOf } from "@/lib/task-rules";
import { ReasonDialog } from "./reason-dialog";

/**
 * Moving a task to another status, the same way from the board (drag and drop) and from the task page:
 * - a blocked status first asks for the reason (the brief);
 * - a done status from someone who may not approve sends an approval request, and says so;
 * - anything refused shows the server's message.
 * Returns `move(task, to)` and the reason window to put on the page.
 */
export function useMoveTask(user: User, project: Project, onSettled?: () => void) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const [asking, setAsking] = useState<{ task: Task; to: string } | null>(null);

  const name = (key: string) => {
    const s = statusOf(project, key);
    return s ? (lang === "en" ? s.name_en : s.name) : key;
  };

  /** Sends the move. Returns an error message, or nothing when it worked. */
  const send = async (task: Task, to: string, reason?: string): Promise<string | void> => {
    try {
      const res = await api.moveTask(task.id, { status: to, blocked_reason: reason });
      toast(
        res.outcome === "approval_requested"
          ? tr("أُرسل طلب اعتماد الإكمال إلى مدير المشروع.", "Sent to the project manager for approval.")
          : tr(`نُقلت ${task.code} إلى «${name(to)}».`, `${task.code} moved to "${name(to)}".`),
        res.outcome === "approval_requested" ? "info" : "success",
      );
    } catch (e) {
      const message = e instanceof ApiError && e.errors?.blocked_reason ? e.errors.blocked_reason : errorText(e, tr);
      if (reason) return message;
      toast(message, "danger");
    } finally {
      onSettled?.();
    }
  };

  const move = (task: Task, to: string) => {
    const plan = planMove(user, project, task, to);
    if (plan === "same" || plan === "unknown") return;
    if (plan === "forbidden") {
      toast(tr("لا يحق لك تغيير حالة هذه المهمة.", "You can't change this task's status."), "danger");
      return;
    }
    if (plan === "needs_reason") {
      setAsking({ task, to });
      return;
    }
    send(task, to);
  };

  const dialog = (
    <ReasonDialog
      open={!!asking}
      title={tr(`إيقاف ${asking?.task.code ?? ""}`, `Block ${asking?.task.code ?? ""}`)}
      label={tr("لماذا توقفت المهمة؟", "Why is the task blocked?")}
      hint={tr("يراه الفريق ومدير المشروع، ويبقى في سجل المهمة.", "The team and the project manager see it, and it stays in the task's history.")}
      submitLabel={tr("أوقف المهمة", "Block the task")}
      onClose={() => {
        setAsking(null);
        onSettled?.();
      }}
      onSubmit={(reason) => send(asking!.task, asking!.to, reason)}
    />
  );

  return { move, dialog };
}
