import { useState } from "react";
import { authApi } from "@/features/auth";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { notificationsApi } from "../api";
import { NotificationItem } from "../components/notification-item";
import { PrefsForm } from "../components/prefs-form";
import type { Notification, NotificationPrefs } from "../types";

/** All of this person's notifications (all or unread only), and their notification preferences. */
export function NotificationsPage() {
  const { tr } = useFmt();
  usePageTitle(tr("الإشعارات", "Notifications"));
  const load = useLoad(() => Promise.all([notificationsApi.notifications(), authApi.users(), notificationsApi.prefs()]));

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

      {load.data && <NotificationsView list={load.data[0]} users={load.data[1]} prefs={load.data[2]} />}
    </div>
  );
}

/** The list (all or unread only) and the preferences, once everything has loaded. */
function NotificationsView({ list, users, prefs }: { list: Notification[]; users: User[]; prefs: NotificationPrefs }) {
  const { tr } = useFmt();
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
