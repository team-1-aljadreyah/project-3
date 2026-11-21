// The counting behind the top of the admin page: how many lines the audit log got on each day (the last 7 days and the
// 7 before them), how many accounts and teams there were at the end of each day, and the accounts that changed last.
// Pure functions (no React, no network), so they are easy to test (tests/unit/admin.test.ts).
import type { Team } from "@/shared/api/types";
import { today } from "@/shared/lib/utils";
import { isLocked } from "./rules";
import type { AdminUser, AuditAction, AuditEntry } from "./types";

/** How many of the newest audit lines, and of the last changed accounts, the page shows. */
export const LATEST_LINES = 5;
export const RECENT_ACCOUNTS = 7;

/** The day (YYYY-MM-DD, in local time) a moment falls on. */
export const dayOf = (iso: string) => today(0, new Date(iso));

/** Seven days in a row, oldest first, that end `back` days before `end`: weekDays("2026-11-19") is 13 to 19 November. */
export function weekDays(end: string, back = 0): string[] {
  const last = new Date(end + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => today(i - 6 - back, last));
}

/** How many audit lines fall on each of `days` (in the same order). */
export function perDay(audit: AuditEntry[], days: string[]): number[] {
  const counts = new Map<string, number>();
  for (const e of audit) {
    const day = dayOf(e.at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return days.map((d) => counts.get(d) ?? 0);
}

/** A change as a share of what was before: 0.5 is "up by half". null when there was nothing before (no honest percent). */
export const changeRatio = (now: number, before: number) => (before > 0 ? (now - before) / before : null);

/**
 * How many there were at the end of each day, counted back from how many there are now: every audit line written after
 * that day is undone. `step` says what a line did to the number: +1 (one more), -1 (one fewer) or 0 (nothing).
 */
export function levels(now: number, days: string[], audit: AuditEntry[], step: (e: AuditEntry) => number): number[] {
  return days.map((day) => Math.max(0, now - audit.reduce((sum, e) => (dayOf(e.at) > day ? sum + step(e) : sum), 0)));
}

// What an audit line did to the number of accounts, of active accounts and of teams. No account or team is ever
// deleted, and a new account starts active (docs/backend.md, section 14).
const accountStep = (e: AuditEntry) => (e.action === "user_created" ? 1 : 0);
const activeStep = (e: AuditEntry) => (e.action === "user_created" || e.action === "user_restarted" ? 1 : e.action === "user_stopped" ? -1 : 0);
const teamStep = (e: AuditEntry) => (e.action === "team_created" ? 1 : 0);

export interface RecentAccount {
  user: AdminUser;
  /** When the audit log last wrote a line about this account. None when it has no line. */
  at?: string;
}

/**
 * The accounts, the last changed first: by the newest audit line about each one (added, changed, stopped, restarted,
 * unlocked, locked). Accounts the log says nothing about come after them, the newest account (the highest id) first.
 */
export function recentAccounts(users: AdminUser[], audit: AuditEntry[], limit = RECENT_ACCOUNTS): RecentAccount[] {
  const last = new Map<number, string>();
  for (const e of audit) {
    if (e.target.type !== "user" || e.target.id === undefined) continue;
    const seen = last.get(e.target.id);
    if (!seen || Date.parse(e.at) > Date.parse(seen)) last.set(e.target.id, e.at);
  }
  const time = (at?: string) => (at ? Date.parse(at) : 0);
  return users
    .map((user) => ({ user, at: last.get(user.id) }))
    .sort((a, b) => time(b.at) - time(a.at) || b.user.id - a.user.id)
    .slice(0, limit);
}

/** Everything the top of the admin page shows (components/admin-overview.tsx). */
export interface Overview {
  /** The last 7 days (today is the last one), and the 7 days before them. */
  week: string[];
  weekBefore: string[];
  /** The audit lines of each of those days. */
  perDay: number[];
  perDayBefore: number[];
  /** The audit lines of the last 7 days against the 7 before. `ratio` is null when the days before had none. */
  lines: { week: number; before: number; ratio: number | null };
  /** `added`: new in the last 7 days. `trend`: how many there were at the end of each of the last 7 days. */
  accounts: { total: number; added: number; trend: number[] };
  active: { total: number; stopped: number; locked: number; trend: number[] };
  teams: { total: number; added: number; trend: number[] };
  /** The newest audit lines. */
  latest: AuditEntry[];
  /** The accounts that changed last. */
  people: RecentAccount[];
}

/** Counts it all from the users, the teams and the audit log as the server sends it (newest first). */
export function adminOverview(users: AdminUser[], teams: Team[], audit: AuditEntry[], now = new Date()): Overview {
  const end = today(0, now);
  const week = weekDays(end);
  const weekBefore = weekDays(end, 7);
  // The days need only the last two weeks of the log; the newest lines and the accounts use all of it.
  const recent = audit.filter((e) => dayOf(e.at) >= weekBefore[0]);
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
  const added = (action: AuditAction) => sum(perDay(recent.filter((e) => e.action === action), week));
  const counts = perDay(recent, week);
  const countsBefore = perDay(recent, weekBefore);
  const active = users.filter((u) => u.active).length;
  return {
    week,
    weekBefore,
    perDay: counts,
    perDayBefore: countsBefore,
    lines: { week: sum(counts), before: sum(countsBefore), ratio: changeRatio(sum(counts), sum(countsBefore)) },
    accounts: { total: users.length, added: added("user_created"), trend: levels(users.length, week, recent, accountStep) },
    active: {
      total: active,
      stopped: users.length - active,
      locked: users.filter((u) => isLocked(u, now.toISOString())).length,
      trend: levels(active, week, recent, activeStep),
    },
    teams: { total: teams.length, added: added("team_created"), trend: levels(teams.length, week, recent, teamStep) },
    latest: audit.slice(0, LATEST_LINES),
    people: recentAccounts(users, audit),
  };
}
