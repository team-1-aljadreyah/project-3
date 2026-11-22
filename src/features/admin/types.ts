// The data shapes of the administration (users, teams, settings, data health) and of the audit log.
import type { Role, User } from "@/shared/api/types";

/** A user as the admin sees them: with the sign-in lock (the brief: "a user who can't sign in for a while"). */
export interface AdminUser extends User {
  /** Wrong passwords in a row since the last good sign-in. */
  failed_logins: number;
  /** Until when the account is locked after too many wrong passwords. */
  locked_until?: string;
  last_login_at?: string;
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
  target: { type: "user" | "team" | "settings" | "project" | "sprint" | "template" | "announcement" | "criteria" | "review" | "login"; id?: number; label: string };
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
