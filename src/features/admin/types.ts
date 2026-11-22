// The data shapes of the administration (users, teams, settings, data health) and of the audit log.
import type { Role, User } from "@/shared/api/types";

/** A user as the admin sees them: with the sign-in lock (the brief: "a user who can't sign in for a while"). */
export interface AdminUser extends User {
  /** Wrong passwords in a row since the last good sign-in. */
  failed_logins: number;
  /** Until when the account is locked after too many wrong passwords. */
  locked_until?: string;
  last_login_at?: string;
  /** When the account was made (the never-signed-in check counts from it). Older servers may not send it. */
  created_at?: string;
}

export interface UserInput {
  name: string;
  name_en?: string;
  email: string;
  phone?: string;
  role: Role;
  /** A job the CEO made (its key): `role` then becomes the job it starts like. null = none. */
  custom_role?: string | null;
  title: string;
  /** null = no team. */
  team_id?: number | null;
  /**
   * "YYYY-MM-DD", or null to clear it. Optional, but the form asks for it (the birthday reminders need it): a real
   * day, not in the future, age 16–80 (birthDateProblem in shared/lib/birthday.ts; docs/backend.md section 20).
   */
  birth_date?: string | null;
}

/** Changes to a user. `active: false` stops the account (never deleted: their history stays). `unlock` ends a lock. */
export type UserPatch = Partial<UserInput> & { active?: boolean; unlock?: boolean };

export interface TeamInput {
  name: string;
  name_en?: string;
  /** A team leader (role "lead"); they join the team. null = none. */
  lead_id?: number | null;
}

/** The platform's settings: each one changes what the platform does. */
export interface Settings {
  /** "Due soon" reminders start this many days before the due day (1–7). */
  due_soon_days: number;
  /** Wrong passwords in a row before the account locks (3–10). */
  lock_after: number;
  /** How long the lock lasts, in minutes (5–120). */
  lock_minutes: number;
}

/** Data health (the brief, admin): the size of the data. Backups are run by DevOps (BRIEF question 14). */
export interface DataHealth {
  users_active: number;
  users_stopped: number;
  users_locked: number;
  projects: number;
  tasks: number;
  files: number;
  files_bytes: number;
  audit_entries: number;
  /** The storage used by each kind of file (docs/backend.md section 14). Optional: older servers don't send it. */
  storage?: StorageUse;
  /** How much the server may store in all, in bytes (the "storage over 80%" check). */
  storage_quota_bytes?: number;
  /** The last backup as the server reports it (DevOps runs it). */
  backup?: BackupState;
  /** The server's own version, when it says it. */
  server_version?: string;
}

/** Storage by kind, in bytes, with how many files of each. */
export interface StorageUse {
  attachments_bytes: number;
  attachments: number;
  pictures_bytes: number;
  pictures: number;
  /** Voice messages in chat (0 until the server keeps them). */
  voice_bytes: number;
  voice: number;
  /** The audit log's table, roughly. */
  audit_bytes: number;
}

export interface BackupState {
  /** When the last backup ended. None: there has been none. */
  at?: string;
  status: "ok" | "failed" | "running" | "unknown";
  size_bytes?: number;
  /** Where it went or what failed, in the server's words (shown as written). */
  note?: string;
}

/** One sign-in session (a token the server gave at sign-in) that is still in use. */
export interface AdminSession {
  id: string;
  user_id: number;
  /** Where the sign-in came from, and the browser's User-Agent (cut to 300), as the server saw them. */
  ip?: string;
  user_agent?: string;
  started_at: string;
  /** The last request made with it. */
  last_seen_at: string;
  /** The session making this request (the admin's own): it can't be ended from the list. */
  current?: boolean;
}

/** `GET /admin/security/summary`: failed sign-ins of the last days, locked accounts, accounts never used. */
export interface SecuritySummary {
  /** How many days back the failed sign-ins are counted (7). */
  days: number;
  failed_total: number;
  /** By account, the most first. `user_id` when the email is an account's; `label` is what was typed (cut). */
  by_account: { user_id?: number; label: string; count: number; last_at: string; ips: string[] }[];
  /** By address, the most first; `accounts` = how many different accounts were tried from it. */
  by_ip: { ip: string; count: number; last_at: string; accounts: number }[];
  /** Accounts locked now. */
  locked: { user_id: number; locked_until: string; failed: number }[];
  /** Active accounts that have never signed in, the oldest first. */
  never_signed_in: { user_id: number; created_at?: string }[];
  /** The lock rules in force (they are changed in the settings). */
  lock_after: number;
  lock_minutes: number;
}

/** One row of an accounts import, as read from the CSV (every value is text; an empty cell is ""). */
export interface ImportRow {
  name: string;
  name_en: string;
  email: string;
  phone: string;
  /** The job: a key ("employee") or its name in Arabic or English. Empty = employee. */
  role: string;
  title: string;
  /** A team's name in Arabic or English. Empty = no team. */
  team: string;
}

/** Why a row can't be imported (the page says it in words). */
export type ImportProblem =
  | "name_missing"
  | "name_too_long"
  | "email_missing"
  | "email_bad"
  | "email_twice"
  | "email_taken"
  | "role_unknown"
  | "role_not_allowed"
  | "title_too_long"
  | "team_unknown";

/** The check of one row: its problems (none = it can be created) and, after a real run, the new account's id. */
export interface ImportCheck {
  /** The row's place in the list sent (1 = the first row under the column names). */
  line: number;
  /** `other_line`: for email_twice, the first line with the same email. */
  problems: { field: keyof ImportRow; problem: ImportProblem; other_line?: number }[];
  user_id?: number;
}

/** `POST /admin/users/import`: each row checked; with `dry_run: false` the valid ones are created. */
export interface ImportResult {
  dry_run: boolean;
  rows: ImportCheck[];
  created: number;
  skipped: number;
}

/** The kinds of action the audit log records. */
export type AuditAction =
  | "user_created"
  | "user_changed"
  | "user_stopped"
  | "user_restarted"
  | "user_unlocked"
  | "team_created"
  | "team_changed"
  | "settings_changed"
  | "login_failed"
  | "login_locked"
  | "project_created"
  | "project_pm_changed"
  | "sprint_closed"
  | "template_deleted"
  | "announcement_deleted"
  | "criteria_changed"
  | "criteria_approved"
  | "review_finalized"
  | "picture_removed"
  | "session_ended"
  | "sessions_ended"
  | "users_imported"
  | "rating_changed"
  | "rating_deleted";

/** The part of the platform an action is about (the audit log shows it as a small label and filters by it). */
export type AuditKind = "account" | "team" | "settings" | "signin" | "project" | "announcement" | "review";

/** One line of the audit log: who did what, to what, what changed, when, and from where. Nobody can change or remove it. */
export interface AuditEntry {
  id: number;
  /** Who did it. None for a failed sign-in (nobody is signed in yet). */
  actor_id?: number;
  action: AuditAction;
  target: { type: "user" | "team" | "settings" | "project" | "sprint" | "template" | "announcement" | "criteria" | "review" | "login" | "import"; id?: number; label: string };
  /** What data changed: field, old and new value as text. */
  changes?: { field: string; from?: string; to?: string }[];
  at: string;
  /** The client's address as the server saw it (CF-Connecting-IP behind Cloudflare; docs/backend.md section 14). */
  ip?: string;
  /** The browser's User-Agent header, cut to 300 characters. */
  user_agent?: string;
  /** The sign-in session the action was made in (short id). None for a failed sign-in. */
  session_id?: string;
  /** The request that wrote the line, to find it in the server's own logs. */
  request_id?: string;
}

/** `GET /audit/:id`: one line, with the same person's other lines that day and the other lines about the same subject. */
export interface AuditDetail extends AuditEntry {
  /** The same person's other actions on the same day, newest first (at most 20). */
  related_by_actor: AuditEntry[];
  /** The other lines about the same subject, newest first (at most 20). */
  related_by_target: AuditEntry[];
}

export interface AuditFilter {
  action?: AuditAction;
  actor_id?: number;
  from?: string;
  to?: string;
  /** Search: who (name in either language, email), the subject, the action in words, and what changed. */
  q?: string;
  /** An address: exact ("192.0.2.14") or a prefix ending with "." or "*" ("192.0.2." or "192.0.2.*"). */
  ip?: string;
  kind?: AuditKind;
}
