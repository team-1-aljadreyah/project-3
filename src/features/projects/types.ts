// The data shapes of projects and sprints, shared by the real API, the fake one and the pages.
import type { Priority, TaskStatus } from "@/shared/api/types";

export type ProjectState = "planned" | "active" | "paused" | "done";

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
