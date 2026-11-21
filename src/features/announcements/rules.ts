// Who may post announcements and see who read them, and the limits the form and the server share.
// Not decided by the client yet (written as assumptions in docs/backend.md, changed here only):
// - who posts: the CEO, the system admin and the monitoring officer (the client, 21 November 2026);
// - the seen / not-seen lists: the author, the CEO and the system admin.
import type { User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import type { Announcement } from "./types";

export function canPostAnnouncements(user: Pick<User, "role">) {
  return isCeo(user) || user.role === "admin" || user.role === "monitor";
}

/** See who has and hasn't seen it, and remove it. */
export function canManageAnnouncement(user: Pick<User, "id" | "role">, a: Pick<Announcement, "author_id">) {
  return isCeo(user) || a.author_id === user.id || user.role === "admin";
}

export const ANNOUNCEMENT_LIMITS = { title: 160, body: 5000 };
