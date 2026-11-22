import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { authApi } from "@/features/auth";
import { chatApi } from "@/features/chat";
import { useUser } from "@/shared/lib/session";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { notificationsApi } from "../api";
import type { Notification } from "../types";
import { unreadChats } from "../alerts";
import { NotificationItem } from "./notification-item";
import { UnreadChats } from "./unread-chats";

/**
 * The bell in the top bar: the number of unread notifications and of chats with unread messages, and in a small panel
 * the unread chats (a reminder each, until the chat is opened) above the latest notifications.
 * It refreshes by itself when anything changes (useLoad listens), in this tab or another. The chats may fail (the chat
 * switched off): the bell then shows the notifications alone.
 */
export function NotificationBell() {
  const { tr, num } = useFmt();
  const me = useUser().id;
  const load = useLoad(() => Promise.all([notificationsApi.notifications(), authApi.users(), chatApi.conversations().catch(() => [])]));
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const list = load.data?.[0] ?? [];
  const people = new Map((load.data?.[1] ?? []).map((u) => [u.id, u]));
  const chats = unreadChats(load.data?.[2] ?? []);
  const unreadNotes = list.filter((n) => !n.read).length;
  const unread = unreadNotes + chats.length;

  // Closes on a click outside it, and on Escape (focus goes back to the bell).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        box.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openOne = (n: Notification) => {
    setOpen(false);
    if (!n.read) notificationsApi.markRead(n.id);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread ? tr(`الإشعارات: ${unread} غير مقروءة`, `Notifications: ${unread} unread`) : tr("الإشعارات", "Notifications")}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-chip hover:text-text"
      >
        <Bell size={19} aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="num absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
            {unread > 99 ? "99+" : num(unread)}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={tr("آخر الإشعارات", "Latest notifications")}
          // On a phone the panel spans the screen under the top bar (from the bell it would run off the edge);
          // on wider screens it hangs from the bell.
          className="fixed inset-x-3 top-[calc(5rem+env(safe-area-inset-top))] z-40 flex flex-col rounded-xl border border-line bg-card shadow-lg sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="font-semibold">{tr("الإشعارات", "Notifications")}</h2>
            {unreadNotes > 0 && (
              <button type="button" onClick={() => notificationsApi.markAllRead()} className="text-[13px] font-medium text-accent hover:underline">
                {tr("تحديد الكل كمقروء", "Mark all read")}
              </button>
            )}
          </div>
          <div className="flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto p-1.5">
            <UnreadChats convs={chats} people={people} me={me} onOpen={() => setOpen(false)} headingId={`${panelId}-chats`} />
            {chats.length > 0 && list.length > 0 && (
              <h3 className="px-3 pt-2.5 pb-1 text-xs font-semibold text-muted">{tr("آخر الإشعارات", "Latest notifications")}</h3>
            )}
            {list.length === 0 && chats.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">{tr("لا توجد إشعارات.", "No notifications.")}</p>
            ) : (
              list.slice(0, 8).map((n) => <NotificationItem key={n.id} n={n} people={people} onOpen={openOne} />)
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="border-t border-line px-4 py-3 text-center text-sm font-medium text-accent hover:bg-chip">
            {tr("عرض كل الإشعارات والتفضيلات", "All notifications and settings")}
          </Link>
        </div>
      )}
    </div>
  );
}
