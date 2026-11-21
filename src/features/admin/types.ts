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
  | "picture_removed";

/** One line of the audit log: who did what, to what, what changed, and when. Nobody can change or remove it. */
export interface AuditEntry {
  id: number;
  /** Who did it. None for a failed sign-in with an unknown email. */
  actor_id?: number;
  action: AuditAction;
  target: { type: "user" | "team" | "settings" | "project" | "sprint" | "template" | "announcement" | "criteria" | "review" | "login"; id?: number; label: string };
  /** What data changed: field, old and new value as text. */
  changes?: { field: string; from?: string; to?: string }[];
  at: string;
}

export interface AuditFilter {
  action?: AuditAction;
  actor_id?: number;
  from?: string;
  to?: string;
}
