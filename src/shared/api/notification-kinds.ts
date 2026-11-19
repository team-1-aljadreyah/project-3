// The kinds of notification, and which ones a person can't turn off. They are here (not in the notifications
// feature) because the demo server (src/mock) makes the notifications and the feature shows them; both need this list.

export type NotificationKind =
  | "task_assigned"
  | "task_status"
  | "task_comment"
  | "task_due_changed"
  | "task_due_soon"
  | "task_overdue"
  | "approval_requested"
  | "approval_decided"
  | "project_added"
  | "project_pm"
  | "project_plan"
  | "announcement"
  | "bug_reported"
  | "bug_assigned"
  | "bug_status"
  | "bug_late"
  | "chat_mention"
  | "dependency_done"
  | "review_final"
  | "team_joined"
  | "account_locked"
  | "github_pr_merged";

export const NOTIFICATION_KINDS: NotificationKind[] = [
  "task_assigned",
  "task_status",
  "task_comment",
  "task_due_changed",
  "task_due_soon",
  "task_overdue",
  "approval_requested",
  "approval_decided",
  "project_added",
  "project_pm",
  "project_plan",
  "announcement",
  "bug_reported",
  "bug_assigned",
  "bug_status",
  "bug_late",
  "chat_mention",
  "dependency_done",
  "review_final",
  "team_joined",
  "account_locked",
  "github_pr_merged",
];

/**
 * Notifications nobody can turn off (the brief: preferences are for the ones that aren't required). Not decided by
 * the client yet: written as an assumption in docs/backend.md, and changed here only.
 */
export const REQUIRED_NOTIFICATIONS = new Set<NotificationKind>([
  "task_assigned",
  "task_overdue",
  "approval_requested",
  "approval_decided",
  "project_added",
  "announcement",
  "bug_assigned",
]);
