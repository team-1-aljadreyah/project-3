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
  bug_id?: number;
  /** A chat's key ("p-3"), for chat mentions. */
  chat_key?: string;
  /** A team (team_rated: the team that was rated). */
  team_id?: number;
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
  /** bugs: the code and title, and the new status. */
  bug_code?: string;
  bug_title?: string;
  bug_status?: string;
  /** note_answered: the kind of note ("request" opens the Requests page). */
  note_kind?: string;
  /** team_rated: the team's name in both languages; team_rated and person_rated: the score ("1"–"5"). The reason is in `note`. */
  team_name?: string;
  team_name_en?: string;
  score?: string;
  /** birthday_soon, birthday_today: whose birthday, and their name then (`due` = the birthday's day that year). */
  person_id?: number;
  person_name?: string;
  person_name_en?: string;
  /** note_sent: whose queue it lands in: "monitor" (a request waiting for the monitoring officer) or "received" (a note sent to me); none: the CEO's inbox. */
  queue?: "monitor" | "received";
}

/** Which notifications a person wants. A missing kind means "on". Required kinds are always on. */
export type NotificationPrefs = Partial<Record<NotificationKind, boolean>>;
