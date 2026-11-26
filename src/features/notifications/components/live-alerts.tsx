import { useEffect } from "react";
import { authApi } from "@/features/auth";
import { chatApi, chatTitle } from "@/features/chat";
import type { User } from "@/shared/api/types";
import { BRAND } from "@/shared/lib/brand";
import { currentLocale } from "@/shared/lib/boot";
import { makeFmt } from "@/shared/lib/format";
import { dataChanged, onDataChange } from "@/shared/lib/live";
import { useUser } from "@/shared/lib/session";
import { claimAlerts, notificationPermission, playChime, showSystemNotification, type SystemNotice } from "@/shared/pwa";
import { notificationsApi } from "../api";
import { chimeFor, newAlerts, preview, seenNow, type Alert, type Seen } from "../alerts";
import { readDevicePrefs } from "../device-prefs";
import { syncPush } from "../push-sync";
import type { NotificationPrefs } from "../types";
import { notificationLink, notificationText } from "../words";

/** How often the open app asks the server for news (the server's live updates can replace this later). */
const POLL_MS = 30_000;

// Which chat the person is looking at, shared by the tabs: a tab in the background doesn't alert for the chat that
// another tab shows. Each tab writes it while it is looked at, and clears it when it stops being looked at.
const VIEWING = "p3.viewing";
const tabId = Math.random().toString(36).slice(2);

function lookedAt() {
  return document.visibilityState === "visible" && document.hasFocus();
}

function chatHere() {
  return /^\/chat\/([^/?#]+)/.exec(window.location.pathname)?.[1] ?? null;
}

function writeViewing(chat: string | null) {
  try {
    localStorage.setItem(VIEWING, JSON.stringify({ tab: tabId, chat, at: Date.now() }));
  } catch {}
}

/** The chat open in front of the person: this tab's, or another tab's that was looked at a moment ago. */
function viewingChat(): string | null {
  if (lookedAt()) {
    const here = chatHere();
    writeViewing(here);
    return here;
  }
  try {
    const v = JSON.parse(localStorage.getItem(VIEWING) ?? "null") as { tab: string; chat: string | null; at: number } | null;
    return v && v.tab !== tabId && Date.now() - v.at < POLL_MS * 1.5 ? v.chat : null;
  } catch {
    return null;
  }
}

/** What the system notification says for one alert, in the person's language. */
function noticeFor(a: Alert, people: Map<number, User>, me: number, silent: boolean): SystemNotice {
  const lang = currentLocale();
  const fmt = makeFmt(lang);
  const { tr } = fmt;
  const nameOf = (u?: User) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : tr("أحدهم", "Someone"));
  const brand = tr(BRAND.ar, BRAND.en);
  if (a.type === "chat") {
    const last = a.chat.last_message!;
    const sender = people.get(last.author_id);
    const where = a.chat.kind === "direct" ? "" : ` · ${chatTitle(a.chat, people, me, lang)}`;
    return {
      title: `${nameOf(sender)}${where}${a.count > 1 ? ` (${fmt.num(a.count)})` : ""}`,
      body: last.body.trim() ? preview(last.body) : tr("أرسل ملفاً", "Sent a file"),
      icon: sender?.avatar_url,
      tag: a.tag,
      url: `/chat/${a.chat.key}`,
      silent,
      lang,
    };
  }
  if (a.type === "notification") {
    const actor = a.n.actor_id ? people.get(a.n.actor_id) : undefined;
    return {
      title: actor ? nameOf(actor) : brand,
      body: notificationText(a.n, fmt, people),
      icon: actor?.avatar_url,
      tag: a.tag,
      url: notificationLink(a.n),
      silent,
      lang,
    };
  }
  return {
    title: brand,
    body: tr(`إشعارات جديدة: ${fmt.num(a.count)}`, `You have ${fmt.num(a.count)} new notifications`),
    tag: a.tag,
    url: "/notifications",
    silent,
    lang,
  };
}

/**
 * While the platform is open (any signed-in page): a new notification, or a new chat message from someone else, plays
 * a short chime and shows a system notification (if the person allowed them), like a messaging app. Nothing alerts
 * when the app opens or reloads (the first look only learns what is there), for what the person did, for the chat they
 * are looking at, or for a kind they turned off. With several tabs open, one tab alerts (src/shared/pwa/claim.ts).
 * News arrives when anything changes in this browser (live.ts) and every 30 seconds from the server. Draws nothing.
 */
export function LiveAlerts() {
  const me = useUser().id;

  useEffect(() => {
    let alive = true;
    let seen: Seen | null = null;
    let busy = false;
    let again = false;

    const look = async (fromServer: boolean) => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      try {
        const [list, convs] = await Promise.all([notificationsApi.notifications().catch(() => null), chatApi.conversations().catch(() => null)]);
        if (!alive) return;
        const before = seen;
        seen = seenNow(before, list, convs);
        const device = readDevicePrefs(me);
        const ctx = { me, viewing: viewingChat(), device };
        if (!newAlerts(before, list, convs, { ...ctx, prefs: {} }).length) return;
        // Something new from the server: every open screen (the bell, the chat list) shows it too.
        if (fromServer) dataChanged();
        // The kinds the person turned off make no sound (asked only when something is new).
        const prefs: NotificationPrefs = await notificationsApi.prefs().catch(() => ({}));
        const alerts = newAlerts(before, list, convs, { ...ctx, prefs });
        const won = new Set(await claimAlerts(alerts.map((a) => a.id), !lookedAt()));
        const mine = alerts.filter((a) => won.has(a.id));
        if (!alive || !mine.length) return;
        const chime = chimeFor(mine, device);
        const rang = chime ? playChime(chime) : false;
        if (!device.system || notificationPermission() !== "granted") return;
        const people = new Map((await authApi.users().catch(() => [] as User[])).map((u) => [u.id, u]));
        // The system's own sound only when the app's chime didn't ring and the person wants sound.
        for (const a of mine) await showSystemNotification(noticeFor(a, people, me, rang || !device.sound));
      } finally {
        busy = false;
        if (again && alive) {
          again = false;
          void look(false);
        }
      }
    };

    void look(false);
    const stop = onDataChange(() => void look(false));
    const timer = setInterval(() => void look(true), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void look(true);
      else if (!lookedAt()) clearMine();
    };
    // Not looked at any more (another window, another app): another tab may alert for this chat again.
    const clearMine = () => {
      try {
        const v = JSON.parse(localStorage.getItem(VIEWING) ?? "null") as { tab: string } | null;
        if (v?.tab === tabId) writeViewing(null);
      } catch {}
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("blur", clearMine);

    // Push while the app is closed, when the backend sends it and the person allowed it (else nothing happens).
    if (readDevicePrefs(me).system && notificationPermission() === "granted") void syncPush(me, true);

    return () => {
      alive = false;
      stop();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("blur", clearMine);
    };
  }, [me]);

  return null;
}
