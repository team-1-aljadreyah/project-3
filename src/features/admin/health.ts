// System health: what needs the admin's attention, and the storage by kind, as pure functions (no React, no network),
// so they are easy to test (tests/unit/admin-console.test.ts). Each item links to the page that fixes it.
import type { Team } from "@/shared/api/types";
import { NEVER_SIGNED_IN_DAYS, neverSignedIn } from "./security";
import type { AdminUser, DataHealth } from "./types";

/** Storage over this share of the quota needs attention. */
export const STORAGE_WARN = 0.8;

/** A backup older than this many hours (or a failed one) needs attention. */
export const BACKUP_STALE_HOURS = 48;

export type AttentionKey = "locked" | "never" | "no_leader" | "no_team" | "storage" | "backup";

export interface Attention {
  key: AttentionKey;
  /** How many (accounts, teams), or the share of storage used for "storage". */
  count: number;
  /** The page (and the part of it) that fixes it. */
  href: string;
  /** "high": fix it today (red); "normal": worth a look. */
  level: "high" | "normal";
}

/** The jobs that belong to a team (the CEO, the PMs, monitoring and the admin work across teams). */
export const TEAM_JOBS = ["lead", "employee"] as const;

/** Has a job that belongs in a team, and is in none. */
export const needsTeam = (u: Pick<AdminUser, "role" | "active" | "team_id">) => u.active && (TEAM_JOBS as readonly string[]).includes(u.role) && !u.team_id;

/**
 * The short "needs attention" list (the admin overview and the health page), the urgent first: locked accounts,
 * storage over 80%, a failed or old backup; then accounts that never signed in and are older than 7 days, teams with
 * no leader, and people of a team job in no team. Nothing to fix: an empty list.
 */
export function needsAttention(input: { users: AdminUser[]; teams: Team[]; health?: DataHealth; now: Date }): Attention[] {
  const { users, teams, health, now } = input;
  const out: Attention[] = [];
  const locked = users.filter((u) => !!u.locked_until && Date.parse(u.locked_until) > now.getTime()).length;
  if (locked) out.push({ key: "locked", count: locked, href: "/admin/security#locked", level: "high" });
  const used = storageUsed(health);
  const quota = health?.storage_quota_bytes;
  if (quota && used / quota > STORAGE_WARN) out.push({ key: "storage", count: used / quota, href: "/admin/health#storage", level: "high" });
  const backup = health?.backup;
  if (backup && (backup.status === "failed" || (backup.status === "ok" && (!backup.at || now.getTime() - Date.parse(backup.at) > BACKUP_STALE_HOURS * 3_600_000)))) {
    out.push({ key: "backup", count: 1, href: "/admin/health#backup", level: "high" });
  }
  const never = neverSignedIn(users, now, NEVER_SIGNED_IN_DAYS).length;
  if (never) out.push({ key: "never", count: never, href: "/admin/security#never", level: "normal" });
  // A leader whose account was stopped leads nobody.
  const noLeader = teams.filter((t) => !users.some((u) => u.id === t.lead_id && u.active)).length;
  if (noLeader) out.push({ key: "no_leader", count: noLeader, href: "/admin/structure#no-leader", level: "normal" });
  const noTeam = users.filter(needsTeam).length;
  if (noTeam) out.push({ key: "no_team", count: noTeam, href: "/admin/structure#no-team", level: "normal" });
  return out;
}

/** Everything stored, in bytes: the parts when the server sends them, else the files' total. */
export function storageUsed(health?: DataHealth) {
  if (!health) return 0;
  const s = health.storage;
  return s ? s.attachments_bytes + s.pictures_bytes + s.voice_bytes + s.audit_bytes : health.files_bytes;
}

/** The storage parts in the order the bar draws them, with their share of the quota (or of the total, with no quota). */
export function storageParts(health: DataHealth) {
  const s = health.storage ?? { attachments_bytes: health.files_bytes, attachments: health.files, pictures_bytes: 0, pictures: 0, voice_bytes: 0, voice: 0, audit_bytes: 0 };
  const whole = health.storage_quota_bytes || storageUsed(health) || 1;
  return [
    { key: "attachments" as const, bytes: s.attachments_bytes, files: s.attachments },
    { key: "pictures" as const, bytes: s.pictures_bytes, files: s.pictures },
    { key: "voice" as const, bytes: s.voice_bytes, files: s.voice },
    { key: "audit" as const, bytes: s.audit_bytes, files: undefined },
  ].map((p) => ({ ...p, share: p.bytes / whole }));
}

/** Bytes in words: "0 B", "12.4 KB", "3.1 MB", "1.2 GB" (one decimal from KB up). */
export function bytesText(n: number) {
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
