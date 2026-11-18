// The data shapes shared by the real API (http.ts), the fake one (mock/) and every page.
// Dates are ISO 8601; days are "YYYY-MM-DD".

/** The six jobs in the client's brief. HR may be added later. */
export type Role = "ceo" | "pm" | "monitor" | "lead" | "employee" | "admin";

export interface User {
  id: number;
  name: string;
  name_en?: string;
  email: string;
  phone?: string;
  role: Role;
  /** Job title shown under the name, e.g. "مطورة واجهات". */
  title: string;
  team_id?: number;
  active: boolean;
}

export interface Session {
  token: string;
  user: User;
}

/**
 * The colour family of a status. Projects may add their own statuses (the brief), so the board never
 * hard-codes the seven: each status says which family it belongs to, and the family picks the colour.
 */
export type StatusTone = "new" | "todo" | "progress" | "review" | "testing" | "done" | "blocked";

export interface TaskStatus {
  key: string;
  name: string;
  name_en: string;
  tone: StatusTone;
}

export type Priority = "high" | "medium" | "low";

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

export interface Task {
  id: number;
  /** A short code people can say and search: "TSK-104". */
  code: string;
  project_id: number;
  phase_id?: number;
  sprint_id?: number;
  title: string;
  description: string;
  assignee_id?: number;
  start?: string;
  due?: string;
  priority: Priority;
  /** One of the project's status keys. */
  status: string;
  /** Required when the status is in the "blocked" family (the brief). */
  blocked_reason?: string;
  subtasks_done: number;
  subtasks_total: number;
  updated_at: string;
}
