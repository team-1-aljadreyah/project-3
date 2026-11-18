"use client";

import { StatusPill } from "@/components/ui";
import type { Project, Task, User } from "@/lib/api/types";
import { useFmt } from "@/lib/i18n";
import { groupByStatus, isDone, lateDays } from "@/lib/tasks";
import { TaskCard } from "./task-card";

/**
 * The Kanban board: one column per status of THIS project (never a fixed list, the brief lets projects add
 * their own). Many columns scroll sideways inside the board, so the page itself never scrolls sideways.
 */
export function Kanban({ project, tasks, users, today }: { project: Project; tasks: Task[]; users: User[]; today: string }) {
  const { tr } = useFmt();
  const columns = groupByStatus(project, tasks);
  const byId = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:-mx-7 sm:px-7">
      <div className="flex min-w-max gap-3">
        {columns.map(({ status, tasks: list }) => (
          <section key={status.key} aria-label={tr(`عمود ${status.name}`, `${status.name_en} column`)} className="flex w-[260px] shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <h2>
                <StatusPill status={status} className="px-3 py-1 text-[13px] font-semibold" />
              </h2>
              <span className="num text-xs font-semibold text-muted">{list.length}</span>
            </div>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-faint">{tr("لا توجد مهام", "No tasks")}</p>
            ) : (
              list.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  tone={status.tone}
                  assignee={task.assignee_id ? byId.get(task.assignee_id) : undefined}
                  late={isDone(project, task) ? 0 : lateDays(project, task, today)}
                  today={today}
                />
              ))
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
