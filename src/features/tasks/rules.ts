// Who may do what with tasks, and what a status change means. Pure functions: the pages use them to show only
// what a person may do, the demo backend uses the SAME functions to refuse the rest (and the real backend must
// keep the same rules, see docs/backend.md). Tested in tests/unit/task-rules.test.ts.
//
// Not yet decided by the client (BRIEF.md question 5, who approves completion): for now the project's PM, a team
// leader in the project, and the CEO. Kept in `canApprove` only, so changing it later is one line.
import type { Project } from "@/features/projects";
import type { TaskStatus, User } from "@/shared/api/types";
import { canTakePart, isMember } from "@/shared/lib/access";
import type { Task } from "./types";

type P = Pick<Project, "pm_id" | "member_ids" | "statuses">;

/** Create tasks, edit any task, change any task's status: the project's PM and its team leaders. */
export function canManageTasks(user: User, project: P) {
  return project.pm_id === user.id || (user.role === "lead" && isMember(user, project));
}

/** Approve (or send back) a task marked done. */
export function canApprove(user: User, project: P) {
  return user.role === "ceo" || canManageTasks(user, project);
}

/** Move a task: the managers, or the person the task is assigned to. */
export function canMoveTask(user: User, project: P, task: Pick<Task, "assignee_id">) {
  return canManageTasks(user, project) || (task.assignee_id === user.id && isMember(user, project));
}

/** Comment: everyone who can see the project, except the system admin (accounts, not project work). */
export function canComment(user: User, project: P) {
  return canTakePart(user, project);
}

export function statusOf(project: Pick<Project, "statuses">, key: string): TaskStatus | undefined {
  return project.statuses.find((s) => s.key === key);
}

/**
 * What happens when `user` moves `task` to `to`:
 * - "forbidden": they may not move this task;
 * - "same": it is already there;
 * - "unknown": the project has no such status;
 * - "needs_reason": a blocked status without a reason (ask for one first);
 * - "request_approval": a done status by someone who may not approve: the task stays, a request is made;
 * - "move": the status changes.
 */
export type MovePlan = "forbidden" | "same" | "unknown" | "needs_reason" | "request_approval" | "move";

export function planMove(user: User, project: P, task: Pick<Task, "status" | "assignee_id" | "approval">, to: string, reason?: string): MovePlan {
  if (!canMoveTask(user, project, task)) return "forbidden";
  const target = statusOf(project, to);
  if (!target) return "unknown";
  if (task.status === to) return "same";
  if (target.tone === "blocked" && !reason?.trim()) return "needs_reason";
  if (target.tone === "done" && !canApprove(user, project)) {
    return task.approval?.state === "pending" && task.approval.to === to ? "same" : "request_approval";
  }
  return "move";
}

/** Limits that the form and the server share. */
export const LIMITS = {
  title: 160,
  description: 5000,
  comment: 2000,
  reason: 300,
};
