// The data shapes of notifications, shared by the real API, the demo backend and the pages.
import type { NotificationKind } from "@/shared/api/notification-kinds";

export type { NotificationKind };

/**
 * One notification for one person. `data` holds a short copy of what it is about, taken when it was made
 * (the task's code and title, the project's name, the new status…), so the text stays right even if the task changes.
 */
export interface Notification {
  id: number;
  user_id: number;
  kind: NotificationKind;
  /** Who caused it (none for reminders such as "due tomorrow"). */
  actor_id?: number;
  project_id?: number;
  task_id?: number;
  announcement_id?: number;
  data: NotificationData;
  at: string;
  read: boolean;
}

export interface NotificationData {
  task_code?: string;
  task_title?: string;
  project_name?: string;
  project_name_en?: string;
  /** A status name (task_status), in both languages. */
  status?: string;
  status_en?: string;
  /** A day (due dates). */
  due?: string;
  /** approval_decided: "approved" or "rejected". */
  decision?: "approved" | "rejected";
  /** A reason or note (a sent-back approval, a changed plan). */
  note?: string;
  /** project_pm: the new manager's id. */
  pm_id?: string;
  /** announcement: its title. */
  title?: string;
}

/** Which notifications a person wants. A missing kind means "on". Required kinds are always on. */
export type NotificationPrefs = Partial<Record<NotificationKind, boolean>>;
