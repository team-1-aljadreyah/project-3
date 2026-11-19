import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import { Avatar, PriorityPill, ProgressBar, TONE_CLASS } from "@/shared/ui";
import type { StatusTone, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn, daysBetween } from "@/shared/lib/utils";
import type { Task } from "../types";

interface CardProps {
  task: Task;
  tone: StatusTone;
  assignee?: User;
  late: number;
  today: string;
}

/**
 * What a task card shows (board D): code and priority, the title, a waiting approval, the reason when it is
 * blocked, sub-tasks in the column's colour, and who has it with the due day (red when late).
 */
export function TaskCardBody({ task, tone, assignee, late, today }: CardProps) {
  const { tr, lang, due, day } = useFmt();
  const ratio = task.subtasks_total ? task.subtasks_done / task.subtasks_total : 0;
  const dueIn = task.due ? daysBetween(today, task.due) : undefined;

  return (
    <>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted" dir="ltr">
          {task.code}
        </span>
        <PriorityPill priority={task.priority} />
      </div>

      <h3 className="text-sm leading-relaxed font-medium">{task.title}</h3>

      {task.approval?.state === "pending" && (
        <p className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-ink">{tr("بانتظار اعتماد الإكمال", "Waiting for approval")}</p>
      )}

      {task.blocked_reason && (
        <p className="rounded-md bg-danger-soft px-2 py-1.5 text-xs leading-relaxed text-danger">
          <b>{tr("سبب التوقف:", "Blocked:")}</b> {task.blocked_reason}
        </p>
      )}

      {task.subtasks_total > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <ProgressBar value={ratio} label={tr("المهام الفرعية المنجزة", "Sub-tasks done")} className="h-1 flex-1" barClassName={TONE_CLASS[tone].bar} />
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
    </>
  );
}

export const cardClass = "flex flex-col gap-2 rounded-xl border border-line bg-card px-3 py-2.5";

/**
 * A card on the board: the whole card opens the task (click anywhere), and it can be dragged to another column
 * when this person may move it (a short drag with the mouse, a long press on a phone, Space with the keyboard).
 */
export function TaskCard({ canDrag, justDragged, ...props }: CardProps & { canDrag: boolean; justDragged: () => boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.task.id, disabled: !canDrag });
  // dnd-kit gives the card role="button"; it stays a link (it opens the task), so that role is left out.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { role, ...dragAttributes } = attributes;

  return (
    <Link
      ref={setNodeRef}
      href={`/tasks/${props.task.id}`}
      {...(canDrag ? { ...dragAttributes, ...listeners } : {})}
      // A drop right on the card it started from would also count as a click: ignore that one.
      onClick={(e) => {
        if (justDragged()) e.preventDefault();
      }}
      className={cn(cardClass, "touch-manipulation transition-[border-color,opacity] hover:border-accent", isDragging && "opacity-40")}
    >
      <TaskCardBody {...props} />
    </Link>
  );
}
