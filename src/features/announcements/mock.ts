// The demo backend for announcements, with the rules the real server must keep (docs/backend.md, section 9).
// Only the demo build loads it (see ./api.ts).
import { audit } from "@/mock/audit";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import { requireFeature } from "@/mock/site";
import type { AnnouncementsApi } from "./api";
import { ANNOUNCEMENT_LIMITS as L, canManageAnnouncement, canPostAnnouncements } from "./rules";
import type { Announcement } from "./types";

type Stored = Omit<Announcement, "seen" | "seen_count" | "audience_count">;

/** An announcement is for every active person in the company (the brief: "لجميع موظفي الشركة"). */
const audience = () => getDb().users.filter((u) => u.active).map((u) => u.id);

/** The announcement as one person sees it: with "have I seen it" and the counts. */
function view(a: Stored, userId: number): Announcement {
  const people = new Set(audience());
  const reads = getDb().announcement_reads.filter((r) => r.announcement_id === a.id && people.has(r.user_id));
  return { ...a, seen: reads.some((r) => r.user_id === userId), seen_count: reads.length, audience_count: people.size };
}

function find(id: number) {
  const a = getDb().announcements.find((x) => x.id === id);
  if (!a) return fail(404, "NOT_FOUND", "لم يُعثر على الإعلان.", "Announcement not found.");
  return a;
}

export const announcementsMock: AnnouncementsApi = {
  async announcements() {
    const user = currentUser();
    // Important ones first, then the newest.
    const list = [...getDb().announcements].sort((a, b) => Number(b.important) - Number(a.important) || b.created_at.localeCompare(a.created_at));
    return wait(list.map((a) => view(a, user.id)));
  },

  async announcement(id) {
    const user = currentUser();
    return wait(view(find(id), user.id));
  },

  async create(input) {
    const user = currentUser();
    requireFeature(user, "announcements");
    if (!canPostAnnouncements(user)) return fail(403, "FORBIDDEN", "ينشر الإعلانات المدير التنفيذي ومسؤول النظام ومسؤول المتابعة.", "Announcements are posted by the CEO, the system admin and the monitoring officer.");
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title) invalid("title", "اكتب عنوان الإعلان.", "Enter the announcement's title.");
    if (title.length > L.title) invalid("title", "العنوان أطول من المسموح.", "The title is too long.");
    if (body.length > L.body) invalid("body", "النص أطول من المسموح.", "The text is too long.");
    const db = getDb();
    const a: Stored = { id: ++db.seq.announcement, title, body, important: !!input.important, author_id: user.id, created_at: nowIso() };
    db.announcements.push(a);
    // The author has seen their own announcement.
    db.announcement_reads.push({ announcement_id: a.id, user_id: user.id, at: a.created_at });
    // The brief: everyone is told when a new announcement is posted.
    notify(audience(), "announcement", { actor_id: user.id, announcement_id: a.id, data: { title } });
    commit();
    return wait(view(a, user.id));
  },

  async remove(id) {
    const user = currentUser();
    const a = find(id);
    if (!canManageAnnouncement(user, a)) return fail(403, "FORBIDDEN", "لا يحق لك حذف هذا الإعلان.", "You can't remove this announcement.");
    const db = getDb();
    db.announcements = db.announcements.filter((x) => x.id !== id);
    audit(user.id, "announcement_deleted", { type: "announcement", id, label: a.title });
    db.announcement_reads = db.announcement_reads.filter((r) => r.announcement_id !== id);
    commit();
    return wait(undefined);
  },

  async markSeen(id) {
    const user = currentUser();
    find(id);
    const db = getDb();
    // Seen once is enough: opening it again changes nothing (and saves nothing).
    if (!db.announcement_reads.some((r) => r.announcement_id === id && r.user_id === user.id)) {
      db.announcement_reads.push({ announcement_id: id, user_id: user.id, at: nowIso() });
      commit({ own: true });
    }
    return wait(undefined);
  },

  async reads(id) {
    const user = currentUser();
    const a = find(id);
    if (!canManageAnnouncement(user, a)) return fail(403, "FORBIDDEN", "قائمة المشاهدة لكاتب الإعلان والإدارة فقط.", "Only the author and the management see who read it.");
    const people = audience();
    const seen = getDb()
      .announcement_reads.filter((r) => r.announcement_id === id && people.includes(r.user_id))
      .map(({ user_id, at }) => ({ user_id, at }))
      .sort((x, y) => x.at.localeCompare(y.at));
    return wait({ seen, not_seen: people.filter((p) => !seen.some((s) => s.user_id === p)) });
  },
};
