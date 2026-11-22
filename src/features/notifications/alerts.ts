// The rules of the alerts (a sound and a system notification when something new arrives while the platform is open),
// and of the unread-chat reminders in the bell. Pure functions, no React and no browser, so they are easy to test
// (tests/unit/alerts.test.ts). components/live-alerts.tsx runs them.
import type { Conversation } from "@/features/chat";
import { REQUIRED_NOTIFICATIONS } from "@/shared/api/notification-kinds";
import type { Lang } from "@/shared/lib/i18n";
import type { Notification, NotificationPrefs } from "./types";

/** This device's alert settings (kept in this browser, for this person). */
export interface DevicePrefs {
  /** System notifications (the phone's or computer's own), when the browser allows them. */
  system: boolean;
  /** Any sound at all. */
  sound: boolean;
  /** The soft chime for chat messages. */
  chatSound: boolean;
  /** The clearer chime for notifications. */
  notifSound: boolean;
  /** Alerts for new chat messages (the bell still lists the unread chats when this is off). */
  chat: boolean;
}

export const DEFAULT_DEVICE_PREFS: DevicePrefs = { system: true, sound: true, chatSound: true, notifSound: true, chat: true };

/** The saved settings, with the defaults for anything missing or broken. */
export function parseDevicePrefs(raw: string | null): DevicePrefs {
  try {
    const saved = raw ? (JSON.parse(raw) as Partial<Record<keyof DevicePrefs, unknown>>) : {};
    const out = { ...DEFAULT_DEVICE_PREFS };
    for (const k of Object.keys(out) as (keyof DevicePrefs)[]) if (typeof saved[k] === "boolean") out[k] = saved[k] as boolean;
    return out;
  } catch {
    return { ...DEFAULT_DEVICE_PREFS };
  }
}

/** What this tab has already seen: the newest notification, and each chat's newest message. */
export interface Seen {
  notif: number;
  chats: Record<string, number>;
}

/** What is seen now. A list that failed to load (null) keeps what was seen before. */
export function seenNow(prev: Seen | null, list: Notification[] | null, convs: Conversation[] | null): Seen {
  return {
    notif: list ? Math.max(prev?.notif ?? 0, ...list.map((n) => n.id)) : (prev?.notif ?? 0),
    chats: convs ? Object.fromEntries(convs.map((c) => [c.key, Math.max(prev?.chats[c.key] ?? 0, c.last_message?.id ?? 0)])) : (prev?.chats ?? {}),
  };
}

export type Alert =
  | { type: "chat"; id: string; tag: string; chat: Conversation; count: number }
  | { type: "notification"; id: string; tag: string; n: Notification }
  | { type: "batch"; id: string; tag: string; count: number };

/** One system notification per chat: a new message replaces the chat's last one (a busy chat never stacks). */
export const chatTag = (key: string) => `chat-${key}`;

/** A mention in a chat shares the chat's tag; any other notification has its own. */
export const notificationTag = (n: Notification) => (n.kind === "chat_mention" && n.chat_key ? chatTag(n.chat_key) : `n-${n.id}`);

/** More new notifications than this at once become one "N new notifications". */
export const BATCH_FROM = 4;

/**
 * What to alert for, comparing what was seen before with what the server says now.
 * - The first look of each page load (`prev` null) only learns: nothing alerts on opening or reloading the app.
 * - A notification: newer than the newest seen, unread, not caused by me, and a kind I didn't turn off.
 * - A chat: its newest message is newer than seen, not mine, still unread, I am not looking at that chat right now
 *   (`viewing`), and chat alerts are on.
 */
export function newAlerts(
  prev: Seen | null,
  list: Notification[] | null,
  convs: Conversation[] | null,
  ctx: { me: number; viewing?: string | null; prefs: NotificationPrefs; device: DevicePrefs },
): Alert[] {
  if (!prev) return [];
  const chats: Alert[] = !ctx.device.chat
    ? []
    : (convs ?? [])
        .filter((c) => {
          const last = c.last_message;
          return !!last && last.id > (prev.chats[c.key] ?? 0) && last.author_id !== ctx.me && c.unread > 0 && c.key !== ctx.viewing;
        })
        .map((c): Alert => ({ type: "chat", id: `c:${c.key}:${c.last_message!.id}`, tag: chatTag(c.key), chat: c, count: c.unread }));

  const chatKeys = new Set(chats.map((a) => (a.type === "chat" ? a.chat.key : "")));
  const notes = (list ?? []).filter(
    (n) =>
      n.id > prev.notif &&
      !n.read &&
      n.actor_id !== ctx.me &&
      (REQUIRED_NOTIFICATIONS.has(n.kind) || ctx.prefs[n.kind] !== false) &&
      // A mention in a chat that already alerts (same tag), or in the chat I'm looking at: once is enough.
      !(n.kind === "chat_mention" && n.chat_key && (chatKeys.has(n.chat_key) || n.chat_key === ctx.viewing)),
  );
  const noteAlerts: Alert[] =
    notes.length >= BATCH_FROM
      ? [{ type: "batch", id: `b:${Math.max(...notes.map((n) => n.id))}`, tag: "n-batch", count: notes.length }]
      : notes.map((n): Alert => ({ type: "notification", id: `n:${n.id}`, tag: notificationTag(n), n }));
  return [...noteAlerts, ...chats];
}

/** Which chime, if any: a notification's (clearer) wins over a message's when both arrive together. */
export function chimeFor(alerts: Alert[], device: DevicePrefs): "notification" | "chat" | null {
  if (!device.sound || !alerts.length) return null;
  if (device.notifSound && alerts.some((a) => a.type !== "chat")) return "notification";
  if (device.chatSound && alerts.some((a) => a.type === "chat")) return "chat";
  return null;
}

/** A message's text for a notification: the first 100 letters. */
export function preview(body: string, max = 100) {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** The chats with messages I haven't read, newest first: the bell's reminders. */
export function unreadChats(convs: Conversation[]) {
  return convs.filter((c) => c.unread > 0).sort((a, b) => (b.last_message?.created_at ?? "").localeCompare(a.last_message?.created_at ?? ""));
}

/**
 * The reminder's sentence: «3 رسائل لم تقرأها في محادثة «منصة الحجز»», «رسالتان لم تقرأهما من أحمد كريم».
 * Arabic counts: 1 رسالة، 2 رسالتان، 3–10 رسائل، 11 and up رسالة.
 */
export function unreadSentence(count: number, title: string, direct: boolean, lang: Lang) {
  if (lang === "en") {
    const what = count === 1 ? "1 unread message" : `${count} unread messages`;
    return direct ? `${what} from ${title}` : `${what} in “${title}”`;
  }
  const what =
    count === 1 ? "رسالة لم تقرأها" : count === 2 ? "رسالتان لم تقرأهما" : count <= 10 ? `${count} رسائل لم تقرأها` : `${count} رسالة لم تقرأها`;
  return direct ? `${what} من ${title}` : `${what} في محادثة «${title}»`;
}
