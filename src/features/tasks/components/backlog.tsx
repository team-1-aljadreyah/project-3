import Link from "next/link";
import { useState } from "react";
import { canManageProject, isClosed, isDone, type Project, type Sprint } from "@/features/projects";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Avatar, Empty, errorText, PriorityPill, Select, StatusPill, useToast } from "@/shared/ui";
import { tasksApi } from "../api";
import { statusOf } from "../rules";
import type { Task } from "../types";

/**
 * The backlog: the project's tasks that are in no sprint yet, the most important first. Each whole row opens its task;
 * the project's managers can put a task into an open sprint from the row.
 */
export function Backlog({
  project,
  sprints,
  tasks,
  users,
  user,
  reload,
}: {
  project: Project;
  sprints: Sprint[];
  tasks: Task[];
  users: User[];
  user: User;
  reload: () => void;
}) {
  const { tr, lang, day } = useFmt();
  const toast = useToast();
  const [busy, setBusy] = useState<number>();
  const people = new Map(users.map((u) => [u.id, u]));
  const open = sprints.filter((s) => !isClosed(s)).sort((a, b) => a.start.localeCompare(b.start));
  const canPlan = canManageProject(user, project);
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const list = tasks
    .filter((t) => !t.sprint_id && !isDone(project, t))
    .sort((a, b) => rank[a.priority] - rank[b.priority] || (a.due ?? "9").localeCompare(b.due ?? "9"));

  const plan = async (task: Task, sprintId: number) => {
    setBusy(task.id);
    try {
      await tasksApi.updateTask(task.id, { sprint_id: sprintId });
      toast(tr(`أُضيفت ${task.code} إلى «${open.find((s) => s.id === sprintId)?.name}».`, `${task.code} added to "${open.find((s) => s.id === sprintId)?.name}".`));
      reload();
    } catch (e) {
      toast(errorText(e, tr), "danger");
    } finally {
      setBusy(undefined);
    }
  };

  if (list.length === 0) {
    return <Empty title={tr("قائمة الانتظار فارغة", "The backlog is empty")} body={tr("كل المهام غير المنجزة موجودة في دورات.", "Every unfinished task is in a sprint.")} />;
  }

  return (
    <ul aria-label={tr("قائمة الانتظار", "Backlog")} className="flex flex-col gap-2">
      {list.map((t) => {
        const status = statusOf(project, t.status);
        const assignee = t.assignee_id ? people.get(t.assignee_id) : undefined;
        return (
          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-2 sm:flex-nowrap">
            {/* The whole row opens the task (click anywhere); the sprint picker sits apart. */}
            <Link href={`/tasks/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-chip">
              <span dir="ltr" className="num shrink-0 text-xs text-muted">
                {t.code}
              </span>
              <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium">
                {t.title}
              </span>
              {status && <StatusPill status={status} className="max-sm:hidden" />}
              <PriorityPill priority={t.priority} />
              {t.due && <span className="shrink-0 text-xs text-muted max-sm:hidden">{day(t.due)}</span>}
              {assignee && (
                <span aria-label={lang === "en" && assignee.name_en ? assignee.name_en : assignee.name}>
                  <Avatar user={assignee} size="sm" />
                </span>
              )}
            </Link>
            {canPlan && open.length > 0 && (
              <Select
                aria-label={tr(`أضف ${t.code} إلى دورة`, `Add ${t.code} to a sprint`)}
                value=""
                disabled={busy === t.id}
                onChange={(e) => e.target.value && plan(t, Number(e.target.value))}
                className="h-9 w-full sm:w-44"
              >
                <option value="">{tr("أضف إلى دورة…", "Add to a sprint…")}</option>
                {open.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </li>
        );
      })}
    </ul>
  );
}
