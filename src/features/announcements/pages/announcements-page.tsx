import { Megaphone, Pin, Plus } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/features/auth";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useMay } from "@/shared/lib/site";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, Empty, ErrorBox, LoadingBlock, Pill, Skeleton } from "@/shared/ui";
import { announcementsApi } from "../api";
import { NewAnnouncementDialog } from "../components/new-announcement-dialog";
import { canManageAnnouncement, canPostAnnouncements } from "../rules";

/** The company's announcements: important ones pinned first, then the newest. Unseen ones are marked "new". */
export function AnnouncementsPage() {
  const { tr, lang, ago, num } = useFmt();
  usePageTitle(tr("الإعلانات", "Announcements"));
  const user = useUser();
  // A custom role (advanced settings) may have "post an announcement" switched off.
  const may = useMay();
  const load = useLoad(() => Promise.all([announcementsApi.announcements(), authApi.users()]));
  const [posting, setPosting] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{tr("الإعلانات", "Announcements")}</h1>
        {canPostAnnouncements(user) && may(user, "post_announcement") && (
          <Button pill onClick={() => setPosting(true)}>
            <Plus size={16} aria-hidden="true" />
            {tr("إعلان جديد", "New announcement")}
          </Button>
        )}
      </div>

      {load.state.status === "loading" && (
        <LoadingBlock className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}

      {load.data &&
        (load.data[0].length === 0 ? (
          <Empty title={tr("لا توجد إعلانات بعد", "No announcements yet")} body={tr("تظهر هنا إعلانات الإدارة لكل الشركة.", "The management's announcements to everyone show here.")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {load.data[0].map((a) => {
              const author = load.data?.[1].find((u) => u.id === a.author_id);
              return (
                <li key={a.id}>
                  {/* The whole card opens the announcement (click anywhere). */}
                  <Link
                    href={`/announcements/${a.id}`}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-accent",
                      a.important ? "border-accent/40" : "border-line",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      {a.important && (
                        <Pill tone="progress">
                          <Pin size={12} aria-hidden="true" />
                          {tr("مهم", "Important")}
                        </Pill>
                      )}
                      {!a.seen && <Pill tone="blocked">{tr("جديد", "New")}</Pill>}
                      <span dir="auto" className={cn("text-base", a.seen ? "font-medium" : "font-semibold")}>
                        {a.title}
                      </span>
                    </span>
                    {a.body && (
                      <span dir="auto" className="line-clamp-2 text-sm text-muted">
                        {a.body}
                      </span>
                    )}
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                      <span className="flex items-center gap-1">
                        <Megaphone size={12} aria-hidden="true" />
                        {author ? (lang === "en" && author.name_en ? author.name_en : author.name) : "-"} · {ago(a.created_at)}
                      </span>
                      {canManageAnnouncement(user, a) && (
                        <span>{tr(`شاهده ${num(a.seen_count)} من ${num(a.audience_count)}`, `Seen by ${a.seen_count} of ${a.audience_count}`)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}

      <NewAnnouncementDialog open={posting} onClose={() => setPosting(false)} />
    </div>
  );
}
