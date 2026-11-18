// The data shapes of projects and sprints, shared by the real API, the fake one and the pages.
import type { Priority, StatusTone, TaskStatus } from "@/shared/api/types";

export type ProjectState = "planned" | "active" | "paused" | "done";

/** A stage of a project. Optional (the brief): a project with no phases has `phases: []`. */
export interface Phase {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  code: string;
  name: string;
  name_en?: string;
  description: string;
  pm_id: number;
  member_ids: number[];
  start: string;
  /** The expected end day. */
  end: string;
  state: ProjectState;
  priority: Priority;
  /** Some projects work in sprints, some don't (the brief): the board shows the sprint only when true. */
  uses_sprints: boolean;
  /** The statuses of this project, in board order. */
  statuses: TaskStatus[];
  /** The project's phases, in order. Empty when the project doesn't use phases. */
  phases: Phase[];
}

/** A project in a list, with its counts (worked out by the server). */
export interface ProjectSummary extends Project {
  tasks_total: number;
  tasks_done: number;
  tasks_late: number;
  tasks_blocked: number;
}

export interface Sprint {
  id: number;
  project_id: number;
  name: string;
  start: string;
  end: string;
  /** Where the plan says the sprint should be today, 0–1 (for "64% done of 70% planned"). */
  planned_ratio: number;
}

/** A new project. The server makes the code (PRJ-…) and starts it with the seven base statuses. */
export interface ProjectInput {
  name: string;
  name_en?: string;
  description: string;
  pm_id: number;
  member_ids: number[];
  start: string;
  end: string;
  priority: Priority;
  uses_sprints: boolean;
}

/** Changes to a project. `note` says why (kept in the project's history, for example why the plan changed). */
export type ProjectPatch = Partial<ProjectInput & { state: ProjectState }> & { note?: string };

/** A status in the statuses editor. A new one has no `key` yet: the server makes it. */
export interface StatusInput {
  key?: string;
  name: string;
  name_en: string;
  tone: StatusTone;
}

/** A phase in the phases editor. A new one has no `id` yet. */
export interface PhaseInput {
  id?: number;
  name: string;
}

export interface SprintInput {
  name: string;
  start: string;
  end: string;
}

/** One line of a project's history. Nobody can edit or hide it (the brief). */
export type ProjectEventKind =
  | "created"
  | "details"
  | "dates"
  | "state"
  | "pm"
  | "member_added"
  | "member_removed"
  | "statuses"
  | "phases"
  | "sprint_added"
  | "sprint_changed"
  | "sprint_removed";

export interface ProjectEvent {
  id: number;
  project_id: number;
  actor_id: number;
  kind: ProjectEventKind;
  /** Old and new values as text: days, states, user ids, names. */
  from?: string;
  to?: string;
  /** The reason given for the change, if any. */
  note?: string;
  at: string;
}
