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
  | "project_plan";

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
]);
