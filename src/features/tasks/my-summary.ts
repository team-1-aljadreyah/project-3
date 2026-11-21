// The numbers of the summary at the top of "My tasks": the tiles, the bars per project, the ring by status family and
// the "done" gauge. Pure functions (no React, no network), tested in tests/unit/my-summary.test.ts.
// They count the same way as the list under them (pages/my-tasks-page.tsx), so the two always agree: a task is done
// when its project says so, and a task whose project isn't in the list stays open and is never late.
import { isDone, lateDays, type Project } from "@/features/projects";
import type { StatusTone } from "@/shared/api/types";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";
import { daysBetween } from "@/shared/lib/utils";
import type { Task } from "./types";

type P = Pick<Project, "id" | "name" | "name_en" | "statuses">;

/** The status families in board order. The ring and its legend follow it. */
export const TONE_ORDER: StatusTone[] = ["new", "todo", "progress", "review", "testing", "done", "blocked"];

/** "The next 7 days" on the tiles: today and the six days after it. */
export const WEEK_DAYS = 7;

/**
 * The colour family of a task's status. A status the project no longer has counts with the project's first status,
 * like on the board (a task is never lost); a task with no project counts as new.
 */
export function toneOf(project: Pick<Project, "statuses"> | undefined, task: Pick<Task, "status">): StatusTone {
  const status = project?.statuses.find((s) => s.key === task.status) ?? project?.statuses[0];
  return status?.tone ?? "new";
}

/** A family is called by the name of its base status ("قيد المراجعة" covers every review status a project added). */
export function toneName(tone: StatusTone): { ar: string; en: string } {
  const base = DEFAULT_STATUSES.find((s) => s.tone === tone);
  return { ar: base?.name ?? tone, en: base?.name_en ?? tone };
}

export interface MyNumbers {
  total: number;
  /** Not done yet. */
  open: number;
  done: number;
  /** Done / total, 0–1 (0 when I have no tasks). */
  ratio: number;
  /** Open and due today. */
  dueToday: number;
  /** Open and due today or in the six days after it. */
  dueWeek: number;
  /** Open and past the due day. */
  late: number;
  /** The longest delay among the late ones, in days (0 when nothing is late). */
  longestLate: number;
  /** Open, and in a "review" status or with a completion that waits for approval. */
  inReview: number;
  /** Of those, the ones that wait for the completion approval. */
  awaitingApproval: number;
}

export function myNumbers(tasks: Task[], projects: P[], today: string): MyNumbers {
  const projectOf = new Map(projects.map((p) => [p.id, p]));
  const n: MyNumbers = { total: tasks.length, open: 0, done: 0, ratio: 0, dueToday: 0, dueWeek: 0, late: 0, longestLate: 0, inReview: 0, awaitingApproval: 0 };
  for (const t of tasks) {
    const p = projectOf.get(t.project_id);
    if (p && isDone(p, t)) {
      n.done++;
      continue;
    }
    n.open++;
    if (t.due) {
      const left = daysBetween(today, t.due);
      if (left === 0) n.dueToday++;
      if (left >= 0 && left < WEEK_DAYS) n.dueWeek++;
    }
    const late = p ? lateDays(p, t, today) : 0;
    if (late > 0) n.late++;
    n.longestLate = Math.max(n.longestLate, late);
    const asked = t.approval?.state === "pending";
    if (asked) n.awaitingApproval++;
    if (asked || toneOf(p, t) === "review") n.inReview++;
  }
  n.ratio = n.total ? n.done / n.total : 0;
  return n;
}

export interface ProjectBar {
  id: number;
  name: string;
  name_en?: string;
  /** My open tasks in this project. */
  open: number;
  /** The bar's length, 0–1: this count against the largest one. */
  length: number;
}

/**
 * My open tasks per project, the most first (projects with the same count keep the list's order). A project where
 * nothing of mine is open is left out, and so is a task whose project isn't in the list (there is no board to open).
 */
export function openByProject(tasks: Task[], projects: P[]): ProjectBar[] {
  const rows = projects
    .map((p) => ({ id: p.id, name: p.name, name_en: p.name_en, open: tasks.filter((t) => t.project_id === p.id && !isDone(p, t)).length }))
    .filter((r) => r.open > 0)
    .sort((a, b) => b.open - a.open);
  const most = rows[0]?.open ?? 0;
  return rows.map((r) => ({ ...r, length: r.open / most }));
}

export interface ToneSlice {
  tone: StatusTone;
  count: number;
  /** This family's part of all my tasks, 0–1. */
  share: number;
}

/** All my tasks (done ones too) by status family, in board order. Families with no task are left out. */
export function byTone(tasks: Task[], projects: P[]): ToneSlice[] {
  const projectOf = new Map(projects.map((p) => [p.id, p]));
  const counts = new Map<StatusTone, number>();
  for (const t of tasks) {
    const tone = toneOf(projectOf.get(t.project_id), t);
    counts.set(tone, (counts.get(tone) ?? 0) + 1);
  }
  return TONE_ORDER.flatMap((tone) => {
    const count = counts.get(tone);
    return count ? [{ tone, count, share: count / tasks.length }] : [];
  });
}
