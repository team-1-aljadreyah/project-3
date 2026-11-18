"use client";

import { Avatar, PriorityPill, ProgressBar, TONE_CLASS } from "@/components/ui";
import type { StatusTone, Task, User } from "@/lib/api/types";
import { useFmt } from "@/lib/i18n";
import { cn, daysBetween } from "@/lib/utils";

/**
 * One task on the board (board D): code and priority, the title, the reason when it is blocked,
 * sub-tasks done in the column's colour, and who has it with the due day (red when late).
 */
export function TaskCard({ task, tone, assignee, late, today }: { task: Task; tone: StatusTone; assignee?: User; late: number; today: string }) {
  const { tr, lang, due, day } = useFmt();
  const ratio = task.subtasks_total ? task.subtasks_done / task.subtasks_total : 0;
  const dueIn = task.due ? daysBetween(today, task.due) : undefined;

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-line bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted" dir="ltr">
          {task.code}
        </span>
        <PriorityPill priority={task.priority} />
      </div>

      <h3 className="text-sm leading-relaxed font-medium">{task.title}</h3>

      {task.blocked_reason && (
        <p className="rounded-md bg-danger-soft px-2 py-1.5 text-xs leading-relaxed text-danger">
          <b>{tr("سبب التوقف:", "Blocked:")}</b> {task.blocked_reason}
        </p>
      )}

      {task.subtasks_total > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <ProgressBar
            value={ratio}
            label={tr("المهام الفرعية المنجزة", "Sub-tasks done")}
            className="h-1 flex-1"
            barClassName={TONE_CLASS[tone].bar}
          />
          <span className="num">
            {task.subtasks_done}/{task.subtasks_total}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-line pt-2 text-xs">
        {assignee ? (
          <span className="flex min-w-0 items-center gap-1.5 text-muted">
            <Avatar user={assignee} size="sm" />
            <span className="truncate">{lang === "en" && assignee.name_en ? assignee.name_en : assignee.name}</span>
          </span>
        ) : (
          <span className="text-faint">{tr("غير مُسندة", "Unassigned")}</span>
        )}
        {task.due && (
          <span className={cn("shrink-0 font-medium", late > 0 ? "text-danger" : "text-muted")} title={day(task.due)}>
            {late > 0 || (dueIn !== undefined && dueIn <= 1) ? due(dueIn ?? 0) : day(task.due)}
          </span>
        )}
      </div>
    </article>
  );
}
