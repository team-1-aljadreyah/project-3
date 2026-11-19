// The data shapes of tasks: comments, history, approvals and changes. Shared by the real API, the fake one and the pages.
// Dates are ISO 8601; days are "YYYY-MM-DD".
import type { Priority } from "@/shared/api/types";

export interface Task {
  id: number;
  /** A short code people can say and search: "TSK-104". */
  code: string;
  project_id: number;
  phase_id?: number;
  sprint_id?: number;
  title: string;
  description: string;
  /** The tasks (same project) this one waits for (the brief: task dependencies). It can't be done before them. */
  depends_on?: number[];
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
  | "phase"
  | "sprint"
  | "dependency_added"
  | "dependency_removed"
  | "comment"
  | "attachment_added"
  | "attachment_removed";

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
  /** One of the project's phases, when the project uses phases. */
  phase_id?: number;
  /** The first status of the project when left out. */
  status?: string;
}

/** Fields that can be changed on a task. `due_note` explains a changed due day (it goes into the history). */
export type TaskPatch = Partial<Pick<Task, "title" | "description" | "priority" | "due" | "start">> & {
  /** `null` takes the task out of its sprint (back to the backlog). */
  sprint_id?: number | null;
  /** `null` takes the task off the person (unassigned). */
  assignee_id?: number | null;
  /** `null` takes the task out of its phase. */
  phase_id?: number | null;
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
