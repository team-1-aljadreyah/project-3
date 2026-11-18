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
  /** The completion approval (the brief: "Completed" needs a way to approve it). */
  approval?: TaskApproval;
  subtasks_done: number;
  subtasks_total: number;
  created_by?: number;
  created_at?: string;
  updated_at: string;
}

/**
 * Someone who may not approve asked to mark the task done. The task stays where it was (`from`) until the
 * PM, the team leader or the CEO approves (→ the done status) or sends it back with a note.
 */
export interface TaskApproval {
  state: "pending" | "approved" | "rejected";
  /** The status the task was in when it was asked. */
  from: string;
  /** The done status that was asked for. */
  to: string;
  requested_by: number;
  requested_at: string;
  decided_by?: number;
  decided_at?: string;
  note?: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  author_id: number;
  body: string;
  created_at: string;
}

/** One line of a task's history. Nobody can edit or hide it (the brief). */
export type TaskEventKind =
  | "created"
  | "status"
  | "blocked"
  | "unblocked"
  | "approval_requested"
  | "approved"
  | "rejected"
  | "assignee"
  | "due"
  | "priority"
  | "title"
  | "description"
  | "comment";

export interface TaskEvent {
  id: number;
  task_id: number;
  actor_id: number;
  kind: TaskEventKind;
  /** Old and new values: status keys, user ids, days or priorities, as text. */
  from?: string;
  to?: string;
  /** A blocked reason, an approval note, or a due-date change reason. */
  note?: string;
  at: string;
}

/** A new task. */
export interface TaskInput {
  title: string;
  description?: string;
  assignee_id?: number;
  priority: Priority;
  due?: string;
  start?: string;
  sprint_id?: number;
  /** The first status of the project when left out. */
  status?: string;
}

/** Fields that can be changed on a task. `due_note` explains a changed due day (it goes into the history). */
export type TaskPatch = Partial<Pick<Task, "title" | "description" | "priority" | "due" | "start" | "sprint_id">> & {
  /** `null` takes the task off the person (unassigned). */
  assignee_id?: number | null;
  due_note?: string;
};

/** Changing a task's status. `blocked_reason` is required for a blocked-family status. */
export interface TaskMove {
  status: string;
  blocked_reason?: string;
}

/** What moving a task did: moved, or (for someone who may not approve) asked for approval. */
export interface MoveResult {
  task: Task;
  outcome: "moved" | "approval_requested";
}
