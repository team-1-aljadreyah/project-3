// Who may run the platform and read the audit log, and the checks on users, teams and settings. Pure functions used by
// the pages (to show only what a person may do) and by the demo backend (to refuse the rest); docs/backend.md
// section 14 lists them for the real server.
import type { Role, User } from "@/shared/api/types";
import type { Settings } from "./types";

/** Every job, in the order the role picker shows them (their names are in shared/lib/access.ts, ROLES). */
export const ROLE_KEYS: Role[] = ["ceo", "pm", "monitor", "lead", "employee", "admin"];

/** Users, teams, settings, data health: the system admin (the brief). */
export const canAdminister = (user: Pick<User, "role">) => user.role === "admin";

/** The audit log: the admin and the CEO. Read only; nobody can change or remove a line (the brief). */
export const canSeeAudit = (user: Pick<User, "role">) => user.role === "admin" || user.role === "ceo";

export const ADMIN_LIMITS = { name: 120, title: 80, teamName: 80 };

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** The limits of each setting. */
export const SETTING_RANGE: Record<keyof Settings, [number, number]> = {
  due_soon_days: [1, 7],
  lock_after: [3, 10],
  lock_minutes: [5, 120],
};

export const DEFAULT_SETTINGS: Settings = { due_soon_days: 1, lock_after: 5, lock_minutes: 15 };

/** The first setting that is out of range, or null. */
export function settingsProblem(s: Settings): keyof Settings | null {
  for (const key of Object.keys(SETTING_RANGE) as (keyof Settings)[]) {
    const [min, max] = SETTING_RANGE[key];
    if (!Number.isInteger(s[key]) || s[key] < min || s[key] > max) return key;
  }
  return null;
}

/** Is the account locked now? */
export const isLocked = (u: { locked_until?: string }, now: string) => !!u.locked_until && u.locked_until > now;
