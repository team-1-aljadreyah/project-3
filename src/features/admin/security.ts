// Sign-in sessions and failed sign-ins, as pure functions (no React, no network), so they are easy to test
// (tests/unit/admin-console.test.ts). The demo backend uses them; docs/backend.md section 14 lists the same rules for
// the real server.
import type { AdminSession, AdminUser, AuditEntry, SecuritySummary, Settings } from "./types";

/** A session nobody has used for this many days has ended by itself (the token expires). */
export const SESSION_IDLE_DAYS = 30;

/** Failed sign-ins are counted over this many days. */
export const FAILED_DAYS = 7;

/** An account that has never signed in is worth a look when it is older than this many days. */
export const NEVER_SIGNED_IN_DAYS = 7;

const DAY = 86_400_000;

/** A session record as the server keeps it: ended ones stay (the history), with when, by whom and why. */
export type SessionRecord = AdminSession & { ended_at?: string; ended_by?: number; end_reason?: "signed_out" | "admin" | "everywhere" | "stopped" };

/** Is the session still in use: not ended, and used in the last SESSION_IDLE_DAYS days. */
export function isActiveSession(s: Pick<SessionRecord, "ended_at" | "last_seen_at">, now: Date) {
  return !s.ended_at && now.getTime() - Date.parse(s.last_seen_at) < SESSION_IDLE_DAYS * DAY;
}

/**
 * Why this session can't be ended from the admin's list, or null when it can: it has ended already, or it is the
 * admin's own session (the one making the request; signing out is in the account menu).
 */
export function endSessionProblem(s: Pick<SessionRecord, "id" | "ended_at" | "last_seen_at">, currentSessionId: string | undefined, now: Date): "ended" | "current" | null {
  if (!isActiveSession(s, now)) return "ended";
  if (currentSessionId && s.id === currentSessionId) return "current";
  return null;
}

/** What "sign out everywhere" ends for a person: every active session of theirs, except the one making the request. */
export function sessionsToEnd<T extends Pick<SessionRecord, "id" | "user_id" | "ended_at" | "last_seen_at">>(sessions: T[], userId: number, currentSessionId: string | undefined, now: Date): T[] {
  return sessions.filter((s) => s.user_id === userId && endSessionProblem(s, currentSessionId, now) === null);
}

/** The sessions the list shows: the active ones, the last used first. */
export function activeSessions<T extends SessionRecord>(sessions: T[], now: Date): T[] {
  return sessions.filter((s) => isActiveSession(s, now)).sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
}

/** Is the account locked now? */
const lockedNow = (u: Pick<AdminUser, "locked_until">, now: Date) => !!u.locked_until && Date.parse(u.locked_until) > now.getTime();

/**
 * Active accounts that have never signed in. `olderThanDays`: only those made at least that many days ago (an account
 * without a date counts as old). The oldest first.
 */
export function neverSignedIn<T extends Pick<AdminUser, "id" | "active" | "last_login_at" | "created_at">>(users: T[], now: Date, olderThanDays = 0): T[] {
  const edge = now.getTime() - olderThanDays * DAY;
  return users
    .filter((u) => u.active && !u.last_login_at && (!u.created_at || Date.parse(u.created_at) <= edge))
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id - b.id);
}

/**
 * The security page's numbers: the failed sign-ins of the last `days` days by account and by address (the most first;
 * an unknown email is counted by what was typed), the accounts locked now, and the accounts never used.
 */
export function securitySummary(audit: AuditEntry[], users: AdminUser[], settings: Pick<Settings, "lock_after" | "lock_minutes">, now: Date, days = FAILED_DAYS): SecuritySummary {
  const from = now.getTime() - days * DAY;
  const failed = audit.filter((e) => e.action === "login_failed" && Date.parse(e.at) >= from && Date.parse(e.at) <= now.getTime());
  const later = (a: string, b: string) => (Date.parse(a) > Date.parse(b) ? a : b);

  const accounts = new Map<string, SecuritySummary["by_account"][number]>();
  const ips = new Map<string, { ip: string; count: number; last_at: string; who: Set<string> }>();
  for (const e of failed) {
    const key = e.target.id !== undefined ? `#${e.target.id}` : e.target.label.toLowerCase();
    const a = accounts.get(key) ?? { ...(e.target.id !== undefined ? { user_id: e.target.id } : {}), label: e.target.label, count: 0, last_at: e.at, ips: [] };
    a.count++;
    a.last_at = later(a.last_at, e.at);
    if (e.ip && !a.ips.includes(e.ip)) a.ips.push(e.ip);
    accounts.set(key, a);
    const ip = e.ip ?? "-";
    const b = ips.get(ip) ?? { ip, count: 0, last_at: e.at, who: new Set<string>() };
    b.count++;
    b.last_at = later(b.last_at, e.at);
    b.who.add(key);
    ips.set(ip, b);
  }
  const most = <T extends { count: number; last_at: string }>(a: T, b: T) => b.count - a.count || b.last_at.localeCompare(a.last_at);

  return {
    days,
    failed_total: failed.length,
    by_account: [...accounts.values()].sort(most),
    by_ip: [...ips.values()].map(({ who, ...rest }) => ({ ...rest, accounts: who.size })).sort(most),
    locked: users
      .filter((u) => lockedNow(u, now))
      .map((u) => ({ user_id: u.id, locked_until: u.locked_until!, failed: u.failed_logins }))
      .sort((a, b) => a.locked_until.localeCompare(b.locked_until)),
    never_signed_in: neverSignedIn(users, now).map((u) => (u.created_at ? { user_id: u.id, created_at: u.created_at } : { user_id: u.id })),
    lock_after: settings.lock_after,
    lock_minutes: settings.lock_minutes,
  };
}
