// The data shapes of the bug tracker, shared by the real API, the demo backend and the pages.
import type { Priority } from "@/shared/api/types";

/** How bad the problem is for users (the brief: "درجة الخطورة"). Priority says how soon to fix it. */
export type Severity = "critical" | "high" | "medium" | "low";

/**
 * Where a bug is in its life (the brief): reported → assigned → fixing → testing → closed, and back to the developer
 * ("reopened") when the test shows it isn't fixed, or when a closed bug comes back.
 */
export type BugStatus = "reported" | "assigned" | "fixing" | "testing" | "reopened" | "closed";

export interface Bug {
  id: number;
  /** A short code people can say: "BUG-12". */
  code: string;
  project_id: number;
  phase_id?: number;
  task_id?: number;
  title: string;
  description: string;
  severity: Severity;
  priority: Priority;
  status: BugStatus;
  reported_by: number;
  /** The developer who fixes it. */
  assignee_id?: number;
  /** The expected fix day. */
  due?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface BugInput {
  title: string;
  description: string;
  severity: Severity;
  priority: Priority;
  phase_id?: number;
  task_id?: number;
  assignee_id?: number;
  due?: string;
}

/** Fields the managers can change. `null` clears the developer, the day, the phase or the task. */
export type BugPatch = Partial<Pick<Bug, "title" | "description" | "severity" | "priority">> & {
  assignee_id?: number | null;
  due?: string | null;
  phase_id?: number | null;
  task_id?: number | null;
};

/** One line of a bug's history. Nobody can edit or hide it (the brief: "سجل كامل للتحديثات والإجراءات"). */
export type BugEventKind = "created" | "status" | "assignee" | "severity" | "priority" | "due" | "edited" | "attachment_added" | "attachment_removed";

export interface BugEvent {
  id: number;
  bug_id: number;
  actor_id: number;
  kind: BugEventKind;
  from?: string;
  to?: string;
  /** Why it was sent back (reopened). */
  note?: string;
  at: string;
}
