// A project's sprints: which one the board shows, whether it can end, and its numbers (the brief: "a sprint's planned,
// done and left tasks"). Pure functions, tested in tests/unit/sprints.test.ts. The server keeps the same rules.
import type { Task } from "@/features/tasks";
import { isDone } from "./counts";
import type { Project, Sprint } from "./types";

export const isClosed = (s: Pick<Sprint, "closed_at">) => !!s.closed_at;

/**
 * The sprint the Scrum board opens on: the open one running today; else the open one that ended but wasn't closed
 * yet (it needs ending); else the next open one; else the last one that was closed. None when there are no sprints.
 */
export function currentSprint(sprints: Sprint[], today: string): Sprint | undefined {
  const sorted = [...sprints].sort((a, b) => a.start.localeCompare(b.start));
  const open = sorted.filter((s) => !isClosed(s));
  return (
    open.find((s) => s.start <= today && today <= s.end) ??
    open.filter((s) => s.end < today).at(-1) ??
    open.find((s) => s.start > today) ??
    sorted.filter(isClosed).at(-1)
  );
}

/** A sprint can be ended once it has started, and only once. (It may end early: the team decides.) */
export const canCloseSprint = (s: Sprint, today: string) => !isClosed(s) && s.start <= today;

/** The open sprints the unfinished tasks of `from` may move to (never itself, never a closed one), soonest first. */
export const moveTargets = (sprints: Sprint[], from: Sprint) =>
  sprints.filter((s) => s.id !== from.id && !isClosed(s)).sort((a, b) => a.start.localeCompare(b.start));

export interface SprintNumbers {
  planned: number;
  done: number;
  left: number;
  /** Done / planned, 0–1. */
  ratio: number;
}

/** Planned, done and left. A closed sprint gives its kept result; an open one counts its tasks now. */
export function sprintNumbers(project: Pick<Project, "statuses">, sprint: Sprint, tasks: Pick<Task, "sprint_id" | "status">[]): SprintNumbers {
  if (sprint.result) {
    const { planned, done } = sprint.result;
    return { planned, done, left: planned - done, ratio: planned ? done / planned : 0 };
  }
  const mine = tasks.filter((t) => t.sprint_id === sprint.id);
  const done = mine.filter((t) => isDone(project, t)).length;
  return { planned: mine.length, done, left: mine.length - done, ratio: mine.length ? done / mine.length : 0 };
}
