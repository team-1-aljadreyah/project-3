// Who may run the platform and read the audit log, and the checks on users, teams and settings. Pure functions used by
// the pages (to show only what a person may do) and by the demo backend (to refuse the rest); docs/backend.md
// section 14 lists them for the real server.
import type { Role, User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import type { Settings } from "./types";

/** Every job, in the order the role picker shows them (their names are in shared/lib/access.ts, ROLES). */
export const ROLE_KEYS: Role[] = ["ceo", "pm", "monitor", "lead", "employee", "admin"];

/** Users, teams, settings, data health: the system admin (the brief). */
export const canAdminister = (user: Pick<User, "role">) => isCeo(user) || user.role === "admin";

/**
 * Adding accounts and seeing the list of them: the admin, the CEO, and the monitor (the client, 24 November 2026: "add
 * the user panel to the monitor so she can add new users"). Changing, stopping or unlocking an account stays the admin's.
 */
export const canAddUsers = (user: Pick<User, "role">) => canAdminister(user) || user.role === "monitor";

/** The jobs a person may give a new account: all of them for the admin and the CEO; the monitor every job but those two. */
export const rolesToGive = (user: Pick<User, "role">): Role[] => (canAdminister(user) ? ROLE_KEYS : ROLE_KEYS.filter((r) => r !== "ceo" && r !== "admin"));

/** The audit log: the admin and the CEO. Read only; nobody can change or remove a line (the brief). */
export const canSeeAudit = (user: Pick<User, "role">) => isCeo(user) || user.role === "admin";

/**
 * Sign-in sessions (who is signed in, from where, on what device) and ending them: the admin and the CEO. Sessions are
 * personal data like the audit log's addresses (docs/backend.md section 14).
 */
export const canManageSessions = (user: Pick<User, "role">) => isCeo(user) || user.role === "admin";

/** How many related lines `GET /audit/:id` sends (the same person that day; the same subject). */
export const RELATED_LIMIT = 20;

export const ADMIN_LIMITS ={ name: 120, title: 80, teamName: 80 };

/** What the admin reads when a birth date is refused (the check itself: birthDateProblem in shared/lib/birthday.ts). */
export const BIRTH_DATE_ERRORS = {
  date: { ar: "اكتب تاريخ ميلاد صحيحاً.", en: "Enter a real birth date." },
  future: { ar: "تاريخ الميلاد لا يكون في المستقبل.", en: "A birth date can't be in the future." },
  young: { ar: "العمر أقل من 16 سنة: راجع السنة.", en: "That makes them younger than 16: check the year." },
  old: { ar: "العمر أكثر من 80 سنة: راجع السنة.", en: "That makes them older than 80: check the year." },
} as const;

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
