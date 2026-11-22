// The demo server's notifications: who gets one when something happens, and the reminders for due dates.
// The real server must do the same (docs/backend.md, section 7). Only the demo build loads this file.
import type { Notification, NotificationData } from "@/features/notifications";
import type { Project } from "@/features/projects";
import type { Task } from "@/features/tasks";
import { REQUIRED_NOTIFICATIONS, type NotificationKind } from "@/shared/api/notification-kinds";
import type { Role } from "@/shared/api/types";
import { birthdayReminder } from "@/shared/lib/birthday";
import { daysBetween, today } from "@/shared/lib/utils";
import { getDb } from "./db";
import { nowIso } from "./helpers";
import { jobGets } from "./site";

/**
 * Does this person want this kind? Required kinds always. The rest: only if the CEO's table sends this kind to their
 * job (the advanced settings; every job by default), and they didn't turn it off themselves.
 */
export function wants(userId: number, kind: NotificationKind) {
  if (REQUIRED_NOTIFICATIONS.has(kind)) return true;
  const db = getDb();
  const role = db.users.find((u) => u.id === userId)?.role;
  if (role && !jobGets(role, kind)) return false;
  return db.notification_prefs[userId]?.[kind] !== false;
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
    // How many days before the due day the reminder starts: the admin's setting (1 by default).
    const kind: NotificationKind | null = left < 0 ? "task_overdue" : left <= db.settings.due_soon_days ? "task_due_soon" : null;
    if (!kind) continue;
    const sent = db.notifications.some((n: Notification) => n.user_id === userId && n.kind === kind && n.task_id === task.id && n.data.due === task.due);
    if (!sent) notify([userId], kind, { project_id: project.id, task_id: task.id, data: { ...aboutTask(task, project), due: task.due } });
  }
}

/** Who is told about birthdays: the monitoring officers (the client) and the CEO (the CEO rule). */
export const BIRTHDAY_ROLES: Role[] = ["monitor", "ceo"];

/**
 * Birthday reminders (docs/backend.md section 20): a week before ("birthday_soon") and on the day ("birthday_today"),
 * about every active person with a birth date, to the monitoring officers and the CEO (the CEO's notification table
 * and each person's own choices can turn them off). Never about yourself. Once per person, year and kind: the
 * birthday's day that year is kept in `due`, so opening the list again sends nothing new. A real server runs this
 * each morning (Asia/Baghdad); the demo runs it when someone opens their notifications.
 */
export function remindBirthdays(userId: number) {
  const db = getDb();
  const me = db.users.find((u) => u.id === userId);
  if (!me?.active || !BIRTHDAY_ROLES.includes(me.role)) return;
  const day = today();
  for (const person of db.users) {
    if (!person.active || !person.birth_date || person.id === userId) continue;
    const due = birthdayReminder(person.birth_date, day);
    if (!due) continue;
    const sent = db.notifications.some((n) => n.user_id === userId && n.kind === due.kind && n.data.person_id === person.id && n.data.due === due.date);
    if (!sent) notify([userId], due.kind, { data: { person_id: person.id, person_name: person.name, person_name_en: person.name_en, due: due.date } });
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
