// The demo backend for notifications. Only the demo build loads it (see ./api.ts).
// Notifications are MADE by the other demo backends when something happens (src/mock/notify.ts); this file reads them.
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, wait } from "@/mock/helpers";
import { remindDueTasks, remindLateBugs } from "@/mock/notify";
import { NOTIFICATION_KINDS, REQUIRED_NOTIFICATIONS, type NotificationKind } from "@/shared/api/notification-kinds";
import type { NotificationsApi } from "./api";

export const notificationsMock: NotificationsApi = {
  async notifications() {
    const user = currentUser();
    const db = getDb();
    const before = db.notifications.length;
    remindDueTasks(user.id);
    remindLateBugs(user.id);
    // Save only when a reminder was added, so reading the list doesn't refresh every open screen each time.
    if (db.notifications.length !== before) commit({ own: true });
    const mine = db.notifications.filter((n) => n.user_id === user.id).sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
    return wait(mine.slice(0, 100));
  },

  async markRead(id) {
    const user = currentUser();
    const n = getDb().notifications.find((x) => x.id === id);
    // Someone else's notification answers like one that doesn't exist.
    if (!n || n.user_id !== user.id) return fail(404, "NOT_FOUND", "لم يُعثر على الإشعار.", "Notification not found.");
    if (!n.read) {
      n.read = true;
      commit({ own: true });
    }
    return wait(undefined);
  },

  async markAllRead() {
    const user = currentUser();
    let changed = false;
    for (const n of getDb().notifications) {
      if (n.user_id === user.id && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) commit({ own: true });
    return wait(undefined);
  },

  async prefs() {
    const user = currentUser();
    return wait(getDb().notification_prefs[user.id] ?? {});
  },

  async savePrefs(prefs) {
    const user = currentUser();
    for (const [kind, on] of Object.entries(prefs)) {
      if (!NOTIFICATION_KINDS.includes(kind as NotificationKind)) invalid("prefs", "نوع إشعار غير معروف.", "Unknown notification kind.");
      if (typeof on !== "boolean") invalid("prefs", "قيمة غير صحيحة.", "Invalid value.");
      if (!on && REQUIRED_NOTIFICATIONS.has(kind as NotificationKind)) {
        invalid("prefs", "هذا الإشعار إلزامي ولا يمكن إيقافه.", "This notification is required and can't be turned off.");
      }
    }
    const db = getDb();
    db.notification_prefs[user.id] = { ...prefs };
    commit({ own: true });
    return wait(db.notification_prefs[user.id]);
  },
};
