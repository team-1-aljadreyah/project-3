import { Bell } from "lucide-react";
import { Link } from "react-router";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Avatar } from "@/shared/ui";
import type { Notification } from "../types";
import { notificationDetail, notificationLink, notificationText } from "../words";

/**
 * One notification. The whole row is one link (click anywhere) to its task or project; `onOpen` runs first, to mark
 * it read. An unread one has a dot and a soft background; screen readers hear "unread" too.
 */
export function NotificationItem({ n, people, onOpen }: { n: Notification; people: Map<number, User>; onOpen: (n: Notification) => void }) {
  const fmt = useFmt();
  const { tr } = fmt;
  const actor = n.actor_id ? people.get(n.actor_id) : undefined;
  const detail = notificationDetail(n);

  return (
    <Link
      to={notificationLink(n)}
      onClick={() => onOpen(n)}
      className={cn("flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-chip", !n.read && "bg-accent-soft/50")}
    >
      {actor ? (
        <Avatar user={actor} size="sm" />
      ) : (
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chip text-muted">
          <Bell size={14} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm", !n.read && "font-semibold")}>
          {!n.read && <span className="sr-only">{tr("غير مقروء: ", "Unread: ")}</span>}
          {notificationText(n, fmt, people)}
        </span>
        {detail && (
          <span className="truncate text-[13px] text-muted">
            <bdi>{detail}</bdi>
          </span>
        )}
        <time dateTime={n.at} className="text-xs text-faint">
          {fmt.ago(n.at)}
        </time>
      </span>
      {!n.read && <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
    </Link>
  );
}
