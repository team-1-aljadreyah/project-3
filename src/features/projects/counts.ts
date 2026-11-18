// A project's counts: its tasks grouped by status, lateness, done / total. Pure functions (no React, no
// network), so they are tested in tests/unit/tasks.test.ts. The server works out the same counts for lists.
// They live in projects (not tasks) because the projects list needs them too, and tasks already imports projects.
import type { Task } from "@/features/tasks";
import type { TaskStatus } from "@/shared/api/types";
import { daysBetween } from "@/shared/lib/utils";
import type { Project } from "./types";

/** Status keys of one family in a project, e.g. every "done" status. */
export function keysOfTone(project: Pick<Project, "statuses">, tone: TaskStatus["tone"]) {
  return new Set(project.statuses.filter((s) => s.tone === tone).map((s) => s.key));
}

export function isDone(project: Pick<Project, "statuses">, task: Pick<Task, "status">) {
  return keysOfTone(project, "done").has(task.status);
}

/** Days past the due day (0 = not late). A done task, or one with no due day, is never late. */
export function lateDays(project: Pick<Project, "statuses">, task: Pick<Task, "status" | "due">, today: string) {
  if (!task.due || isDone(project, task)) return 0;
  return Math.max(0, daysBetween(task.due, today));
}

/** The board's columns: one per project status, in the project's order, with its tasks. */
export function groupByStatus(project: Pick<Project, "statuses">, tasks: Task[]) {
  const known = new Set(project.statuses.map((s) => s.key));
  return project.statuses.map((status) => ({
    status,
    // A task whose status was removed from the project shows in the first column, never lost.
    tasks: tasks.filter((t) => t.status === status.key || (status === project.statuses[0] && !known.has(t.status))),
  }));
}

export interface ProjectCounts {
  total: number;
  done: number;
  late: number;
  blocked: number;
  inReview: number;
  /** Done / total, 0–1 (0 for an empty project). */
  ratio: number;
}

export function countTasks(project: Pick<Project, "statuses">, tasks: Task[], today: string): ProjectCounts {
  const done = keysOfTone(project, "done");
  const blocked = keysOfTone(project, "blocked");
  const review = keysOfTone(project, "review");
  const total = tasks.length;
  const doneN = tasks.filter((t) => done.has(t.status)).length;
  return {
    total,
    done: doneN,
    late: tasks.filter((t) => lateDays(project, t, today) > 0).length,
    blocked: tasks.filter((t) => blocked.has(t.status)).length,
    inReview: tasks.filter((t) => review.has(t.status)).length,
    ratio: total ? doneN / total : 0,
  };
}

/** Where a sprint's plan should be on a day, 0–1, if work is spread evenly across its days. */
export function plannedRatio(start: string, end: string, today: string) {
  const length = daysBetween(start, end);
  if (length <= 0) return 1;
  return Math.min(1, Math.max(0, daysBetween(start, today) / length));
}
