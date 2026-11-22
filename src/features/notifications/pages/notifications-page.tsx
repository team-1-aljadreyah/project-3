import { useState } from "react";
import { authApi } from "@/features/auth";
import { chatApi, type Conversation } from "@/features/chat";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useLoad } from "@/shared/lib/use-load";
import { useUser } from "@/shared/lib/session";
import { cn } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { notificationsApi } from "../api";
import { DeviceAlerts } from "../components/device-alerts";
import { NotificationItem } from "../components/notification-item";
import { PrefsForm } from "../components/prefs-form";
import { UnreadChats } from "../components/unread-chats";
import type { Notification, NotificationPrefs } from "../types";

/**
 * All of this person's notifications (all or unread only) under the chats they haven't read, the alerts on this device
 * (sound, system notifications), and their notification preferences.
 */
export function NotificationsPage() {
  const { tr } = useFmt();
  usePageTitle(tr("الإشعارات", "Notifications"));
  const load = useLoad(() =>
    Promise.all([notificationsApi.notifications(), authApi.users(), notificationsApi.prefs(), chatApi.conversations().catch(() => [] as Conversation[])]),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{tr("الإشعارات", "Notifications")}</h1>

      {load.state.status === "loading" && (
        <LoadingBlock className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}

      {load.data && <NotificationsView list={load.data[0]} users={load.data[1]} prefs={load.data[2]} convs={load.data[3]} />}
    </div>
  );
}

/** The list (all or unread only) and the preferences, once everything has loaded. */
function NotificationsView({ list, users, prefs, convs }: { list: Notification[]; users: User[]; prefs: NotificationPrefs; convs: Conversation[] }) {
  const { tr } = useFmt();
  const me = useUser().id;
  const [only, setOnly] = useState<"all" | "unread">("all");
  const people = new Map(users.map((u) => [u.id, u]));
  const unread = list.filter((n) => !n.read).length;
  const shown = only === "unread" ? list.filter((n) => !n.read) : list;
  const open = (n: Notification) => {
    if (!n.read) notificationsApi.markRead(n.id);
  };

  return (
    <>
      <section aria-labelledby="list-title" className="flex flex-col gap-3">
        <h2 id="list-title" className="sr-only">
          {tr("القائمة", "The list")}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label={tr("عرض", "Show")} className="flex gap-1 rounded-full bg-chip p-1">
            {(["all", "unread"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={only === k}
                onClick={() => setOnly(k)}
                className={cn("rounded-full px-3.5 py-1.5 text-sm", only === k ? "bg-card font-semibold shadow-card" : "text-muted hover:text-text")}
              >
                {k === "all" ? tr(`الكل (${list.length})`, `All (${list.length})`) : tr(`غير المقروءة (${unread})`, `Unread (${unread})`)}
              </button>
            ))}
          </div>
          {unread > 0 && (
            <Button variant="secondary" size="sm" onClick={() => notificationsApi.markAllRead()}>
              {tr("تحديد الكل كمقروء", "Mark all read")}
            </Button>
          )}
        </div>
        {convs.some((c) => c.unread > 0) && (
          <div className="rounded-xl border border-line bg-card p-1.5">
            <UnreadChats convs={convs} people={people} me={me} headingId="unread-chats-title" />
          </div>
        )}
        {shown.length === 0 ? (
          <Empty
            title={only === "unread" ? tr("لا توجد إشعارات غير مقروءة", "Nothing unread") : tr("لا توجد إشعارات بعد", "No notifications yet")}
            body={tr("تصلك هنا أخبار مهامك ومشاريعك.", "News about your tasks and projects comes here.")}
          />
        ) : (
          <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-card p-1.5">
            {shown.map((n) => (
              <NotificationItem key={n.id} n={n} people={people} onOpen={open} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="device-title" className="flex flex-col gap-3">
        <div>
          <h2 id="device-title" className="text-lg font-semibold">
            {tr("التنبيهات على هذا الجهاز", "Alerts on this device")}
          </h2>
          <p className="text-sm text-muted">{tr("صوت وإشعار على شاشة جهازك عند وصول رسالة أو إشعار جديد.", "A sound and a notification on your screen when a new message or notification arrives.")}</p>
        </div>
        <DeviceAlerts />
      </section>

      <section aria-labelledby="prefs-title" className="flex flex-col gap-3">
        <div>
          <h2 id="prefs-title" className="text-lg font-semibold">
            {tr("تفضيلات الإشعارات", "Notification preferences")}
          </h2>
          <p className="text-sm text-muted">{tr("أوقف الإشعارات غير الإلزامية التي لا تحتاجها.", "Turn off the optional notifications you don't need.")}</p>
        </div>
        <PrefsForm key={JSON.stringify(prefs)} saved={prefs} />
      </section>
    </>
  );
}
