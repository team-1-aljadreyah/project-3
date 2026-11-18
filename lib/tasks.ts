// Task rules used by the pages: grouping by status, lateness, project counts. Pure functions (no React, no
// network), so they are tested in tests/unit/tasks.test.ts. The server works out the same counts for lists.
import type { Project, Task, TaskStatus } from "./api/types";
import { daysBetween } from "./utils";

/** The seven statuses every project starts with (the brief). A project may add its own. */
export const DEFAULT_STATUSES: TaskStatus[] = [
  { key: "new", name: "جديدة", name_en: "New", tone: "new" },
  { key: "todo", name: "قيد الانتظار", name_en: "To do", tone: "todo" },
  { key: "in_progress", name: "قيد التنفيذ", name_en: "In progress", tone: "progress" },
  { key: "in_review", name: "قيد المراجعة", name_en: "In review", tone: "review" },
  { key: "testing", name: "قيد الاختبار", name_en: "Testing", tone: "testing" },
  { key: "completed", name: "مكتملة", name_en: "Completed", tone: "done" },
  { key: "blocked", name: "متوقفة", name_en: "Blocked", tone: "blocked" },
];

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
