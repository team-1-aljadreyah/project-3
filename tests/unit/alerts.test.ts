import { describe, expect, it } from "vitest";
import type { Conversation } from "@/features/chat";
import type { Notification } from "@/features/notifications";
import {
  BATCH_FROM,
  chimeFor,
  DEFAULT_DEVICE_PREFS,
  newAlerts,
  notificationTag,
  parseDevicePrefs,
  preview,
  seenNow,
  unreadChats,
  unreadSentence,
} from "@/features/notifications/alerts";

const SARA = 5;
const AHMED = 2;

const note = (id: number, more: Partial<Notification> = {}): Notification => ({
  id,
  user_id: SARA,
  kind: "task_assigned",
  actor_id: AHMED,
  data: {},
  at: "2026-11-22T10:00:00Z",
  read: false,
  ...more,
});

const chat = (key: string, lastId: number, author: number, unread: number, more: Partial<Conversation> = {}): Conversation => ({
  key,
  kind: key.startsWith("d-") ? "direct" : "project",
  title: "منصة الحجز الإلكتروني",
  member_ids: [AHMED, SARA],
  unread,
  last_message: { id: lastId, chat: key, author_id: author, body: "مرحباً", mentions: [], created_at: `2026-11-22T10:${String(lastId).padStart(2, "0")}:00Z`, files: [] },
  ...more,
});

const ctx = { me: SARA, viewing: null, prefs: {}, device: DEFAULT_DEVICE_PREFS };

describe("is it new, and should it alert", () => {
  const before = seenNow(null, [note(1)], [chat("p-1", 6, AHMED, 2), chat("d-1", 4, AHMED, 1)]);

  it("never alerts on the first look (opening or reloading the app)", () => {
    expect(newAlerts(null, [note(1), note(2)], [chat("p-1", 9, AHMED, 3)], ctx)).toEqual([]);
  });

  it("a new notification from someone else alerts", () => {
    const alerts = newAlerts(before, [note(2), note(1)], null, ctx);
    expect(alerts.map((a) => a.id)).toEqual(["n:2"]);
  });

  it("a new message from someone else alerts, once per chat with the unread count", () => {
    const alerts = newAlerts(before, null, [chat("p-1", 8, AHMED, 4), chat("d-1", 4, AHMED, 1)], ctx);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: "chat", id: "c:p-1:8", tag: "chat-p-1", count: 4 });
  });

  it("a brand-new chat (a new private chat) alerts too", () => {
    expect(newAlerts(before, null, [chat("d-9", 12, AHMED, 1)], ctx).map((a) => a.id)).toEqual(["c:d-9:12"]);
  });

  it("nothing I did myself: my own message, a notification I caused", () => {
    expect(newAlerts(before, null, [chat("p-1", 8, SARA, 0)], ctx)).toEqual([]);
    expect(newAlerts(before, [note(2, { actor_id: SARA })], null, ctx)).toEqual([]);
  });

  it("nothing for the chat I'm looking at, nor its mention", () => {
    const now = [chat("p-1", 8, AHMED, 1)];
    expect(newAlerts(before, [note(2, { kind: "chat_mention", chat_key: "p-1" })], now, { ...ctx, viewing: "p-1" })).toEqual([]);
  });

  it("a read notification, or one already seen, doesn't alert", () => {
    expect(newAlerts(before, [note(2, { read: true }), note(1)], null, ctx)).toEqual([]);
  });

  it("a kind the person turned off makes no alert; a required kind always does", () => {
    expect(newAlerts(before, [note(2, { kind: "task_comment" })], null, { ...ctx, prefs: { task_comment: false } })).toEqual([]);
    // task_assigned is required: turning it off (an old saved choice) changes nothing.
    expect(newAlerts(before, [note(2)], null, { ...ctx, prefs: { task_assigned: false } })).toHaveLength(1);
  });

  it("chat alerts off: no alert for messages (the bell still lists them)", () => {
    expect(newAlerts(before, null, [chat("p-1", 8, AHMED, 4)], { ...ctx, device: { ...DEFAULT_DEVICE_PREFS, chat: false } })).toEqual([]);
  });

  it("a mention in a chat that alerts anyway is not alerted twice", () => {
    const alerts = newAlerts(before, [note(2, { kind: "chat_mention", chat_key: "p-1" })], [chat("p-1", 8, AHMED, 1)], ctx);
    expect(alerts.map((a) => a.id)).toEqual(["c:p-1:8"]);
  });

  it(`${BATCH_FROM} or more at once become one "N new notifications"`, () => {
    const many = [2, 3, 4, 5].map((id) => note(id));
    expect(newAlerts(before, many, null, ctx)).toEqual([{ type: "batch", id: "b:5", tag: "n-batch", count: 4 }]);
  });

  it("what was seen only grows, and a list that failed to load keeps the old", () => {
    const next = seenNow(before, null, [chat("p-1", 8, AHMED, 1)]);
    expect(next.notif).toBe(1);
    expect(next.chats["p-1"]).toBe(8);
  });
});

describe("grouping", () => {
  it("one tag per chat, shared by a mention in it; one per other notification", () => {
    expect(notificationTag(note(7, { kind: "chat_mention", chat_key: "g-2" }))).toBe("chat-g-2");
    expect(notificationTag(note(7))).toBe("n-7");
  });
});

describe("sounds and settings", () => {
  const msg = newAlerts(seenNow(null, [], [chat("p-1", 1, AHMED, 0)]), [], [chat("p-1", 2, AHMED, 1)], ctx);
  const both = [...msg, ...newAlerts(seenNow(null, [], []), [note(9)], [], ctx)];

  it("the message chime for messages, the notification chime when a notification is among them", () => {
    expect(chimeFor(msg, DEFAULT_DEVICE_PREFS)).toBe("chat");
    expect(chimeFor(both, DEFAULT_DEVICE_PREFS)).toBe("notification");
  });

  it("respects sound off, and each chime off", () => {
    expect(chimeFor(msg, { ...DEFAULT_DEVICE_PREFS, sound: false })).toBeNull();
    expect(chimeFor(msg, { ...DEFAULT_DEVICE_PREFS, chatSound: false })).toBeNull();
    expect(chimeFor(both, { ...DEFAULT_DEVICE_PREFS, notifSound: false })).toBe("chat");
  });

  it("reads saved settings, with the defaults for anything missing or broken", () => {
    expect(parseDevicePrefs(null)).toEqual(DEFAULT_DEVICE_PREFS);
    expect(parseDevicePrefs('{"sound":false,"chat":"yes"}')).toEqual({ ...DEFAULT_DEVICE_PREFS, sound: false });
    expect(parseDevicePrefs("not json")).toEqual(DEFAULT_DEVICE_PREFS);
  });

  it("a message's preview is its first 100 letters", () => {
    expect(preview("a".repeat(150))).toBe(`${"a".repeat(100)}…`);
    expect(preview("  سطر\nثانٍ  ")).toBe("سطر ثانٍ");
  });
});

describe("unread chat reminders", () => {
  it("lists the chats with unread messages, newest first", () => {
    const list = unreadChats([chat("p-1", 3, AHMED, 2), chat("t-1", 1, AHMED, 0), chat("d-1", 9, AHMED, 1)]);
    expect(list.map((c) => c.key)).toEqual(["d-1", "p-1"]);
  });

  it("says how many, in correct Arabic and in English", () => {
    expect(unreadSentence(1, "منصة الحجز", false, "ar")).toBe("رسالة لم تقرأها في محادثة «منصة الحجز»");
    expect(unreadSentence(2, "أحمد كريم", true, "ar")).toBe("رسالتان لم تقرأهما من أحمد كريم");
    expect(unreadSentence(3, "منصة الحجز", false, "ar")).toBe("3 رسائل لم تقرأها في محادثة «منصة الحجز»");
    expect(unreadSentence(12, "منصة الحجز", false, "ar")).toBe("12 رسالة لم تقرأها في محادثة «منصة الحجز»");
    expect(unreadSentence(3, "Booking", false, "en")).toBe("3 unread messages in “Booking”");
    expect(unreadSentence(1, "Ahmed Kareem", true, "en")).toBe("1 unread message from Ahmed Kareem");
  });
});
