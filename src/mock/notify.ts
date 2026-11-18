// The demo server's notifications: who gets one when something happens, and the reminders for due dates.
// The real server must do the same (docs/backend.md, section 7). Only the demo build loads this file.
import type { Notification, NotificationData } from "@/features/notifications";
import type { Project } from "@/features/projects";
import type { Task } from "@/features/tasks";
import { REQUIRED_NOTIFICATIONS, type NotificationKind } from "@/shared/api/notification-kinds";
import { daysBetween, today } from "@/shared/lib/utils";
import { getDb } from "./db";
import { nowIso } from "./helpers";

/** Does this person want this kind? Required kinds always; the rest unless they turned it off. */
export function wants(userId: number, kind: NotificationKind) {
  return REQUIRED_NOTIFICATIONS.has(kind) || getDb().notification_prefs[userId]?.[kind] !== false;
}

/**
 * Sends one notification to each person in `to`, except the one who did it (nobody is told about their own action)
 * and people who turned this kind off. Duplicated ids get one each.
 */
export function notify(
  to: (number | undefined)[],
  kind: NotificationKind,
  about: { actor_id?: number; project_id?: number; task_id?: number; announcement_id?: number; bug_id?: number; chat_key?: string; data: NotificationData },
) {
  const db = getDb();
  for (const userId of new Set(to)) {
    if (userId === undefined || userId === about.actor_id || !wants(userId, kind)) continue;
    db.notifications.push({ id: ++db.seq.notification, user_id: userId, kind, ...about, at: nowIso(), read: false });
  }
}

/** The words of a task, copied into its notifications. */
export const aboutTask = (task: Task, project: Project): NotificationData => ({
  task_code: task.code,
  task_title: task.title,
  project_name: project.name,
  project_name_en: project.name_en,
});

/** The words of a project, copied into its notifications. */
export const aboutProject = (project: Project): NotificationData => ({ project_name: project.name, project_name_en: project.name_en });

/**
 * Reminders that come from the calendar, not from someone's action: "due tomorrow / today" and "late". A real server
 * runs this once a day; the demo runs it when someone opens their notifications. Each reminder is sent once per task
 * and due day, so changing the due day can remind again.
 */
export function remindDueTasks(userId: number) {
  const db = getDb();
  const day = today();
  for (const task of db.tasks) {
    if (task.assignee_id !== userId || !task.due) continue;
    const project = db.projects.find((p) => p.id === task.project_id);
    if (!project || project.statuses.find((s) => s.key === task.status)?.tone === "done") continue;
    const left = daysBetween(day, task.due);
    const kind: NotificationKind | null = left < 0 ? "task_overdue" : left <= 1 ? "task_due_soon" : null;
    if (!kind) continue;
    const sent = db.notifications.some((n: Notification) => n.user_id === userId && n.kind === kind && n.task_id === task.id && n.data.due === task.due);
    if (!sent) notify([userId], kind, { project_id: project.id, task_id: task.id, data: { ...aboutTask(task, project), due: task.due } });
  }
}

/**
 * Late bugs (the expected fix day has passed and the bug isn't closed) remind their developer and the project's PM,
 * once per bug and fix day. Like the task reminders, a real server runs this once a day.
 */
export function remindLateBugs(userId: number) {
  const db = getDb();
  const day = today();
  for (const bug of db.bugs) {
    if (bug.status === "closed" || !bug.due || bug.due >= day) continue;
    const project = db.projects.find((p) => p.id === bug.project_id);
    if (!project || (bug.assignee_id !== userId && project.pm_id !== userId)) continue;
    const sent = db.notifications.some((n) => n.user_id === userId && n.kind === "bug_late" && n.bug_id === bug.id && n.data.due === bug.due);
    if (!sent) notify([userId], "bug_late", { project_id: project.id, bug_id: bug.id, data: { bug_code: bug.code, bug_title: bug.title, due: bug.due } });
  }
}
