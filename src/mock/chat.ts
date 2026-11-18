// Who belongs to which chat, for the demo server. The chat backend and the attachments backend (files sent in a chat)
// both need it, so it lives here in the demo layer. Keys are "p-3" (project), "t-1" (team), "d-7" (private), as in
// src/features/chat/rules.ts.
import { getDb } from "./db";

/** The people of a chat, or null when the chat doesn't exist. Read each time, so a change of members applies at once. */
export function chatMembers(key: string): number[] | null {
  const m = /^([ptd])-(\d+)$/.exec(key);
  if (!m) return null;
  const db = getDb();
  const id = Number(m[2]);
  if (m[1] === "p") {
    const project = db.projects.find((p) => p.id === id);
    return project ? [...new Set([project.pm_id, ...project.member_ids])] : null;
  }
  if (m[1] === "t") {
    if (!db.teams.some((t) => t.id === id)) return null;
    return db.users.filter((u) => u.active && u.team_id === id).map((u) => u.id);
  }
  return db.directs.find((d) => d.id === id)?.member_ids ?? null;
}
