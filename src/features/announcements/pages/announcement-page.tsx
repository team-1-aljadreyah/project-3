import { Pin, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/features/auth";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { useRouteParam } from "@/shared/lib/route-param";
import { Avatar, Button, Dialog, ErrorBox, LoadingBlock, Pill, Skeleton, errorText, useToast } from "@/shared/ui";
import { announcementsApi } from "../api";
import { canManageAnnouncement } from "../rules";
import type { Announcement } from "../types";

/** One announcement. Opening it marks it seen. Its author and the management also see who has and hasn't seen it. */
export function AnnouncementPage() {
  const id = Number(useRouteParam("announcements"));
  const load = useLoad(() => Promise.all([announcementsApi.announcement(id), authApi.users()]), [id]);

  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-40" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} backHref="/announcements" onRetry={load.reload} />;
  const [a, users] = load.state.data;
  return <AnnouncementView a={a} users={users} />;
}

function AnnouncementView({ a, users }: { a: Announcement; users: User[] }) {
  const { tr, lang, dateTime, num } = useFmt();
  const user = useUser();
  const toast = useToast();
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  usePageTitle(a.title);
  const people = new Map(users.map((u) => [u.id, u]));
  const author = people.get(a.author_id);
  const nameOf = (u?: User) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-");

  // Opening the announcement is "seeing" it (once; the server ignores a second time).
  useEffect(() => {
    if (!a.seen) announcementsApi.markSeen(a.id);
  }, [a.id, a.seen]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted">
        <Link href="/announcements" className="hover:text-text hover:underline">
          {tr("الإعلانات", "Announcements")}
        </Link>
      </nav>

      <article className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5">
        <div className="flex flex-col gap-2">
          {a.important && (
            <span>
              <Pill tone="progress">
                <Pin size={12} aria-hidden="true" />
                {tr("مهم", "Important")}
              </Pill>
            </span>
          )}
          {/* dir="auto": text people write takes its own direction, so Arabic reads right in the English site too. */}
          <h1 dir="auto" className="text-2xl leading-snug font-semibold">
            {a.title}
          </h1>
          <p className="flex items-center gap-2 text-sm text-muted">
            {author && <Avatar user={author} size="sm" />}
            {nameOf(author)} · <time dateTime={a.created_at}>{dateTime(a.created_at)}</time>
          </p>
        </div>
        {a.body && (
          <p dir="auto" className="leading-relaxed whitespace-pre-wrap">
            {a.body}
          </p>
        )}
        {canManageAnnouncement(user, a) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-sm text-muted">{tr(`شاهده ${num(a.seen_count)} من ${num(a.audience_count)}`, `Seen by ${a.seen_count} of ${a.audience_count}`)}</span>
            <Button variant="secondary" size="sm" onClick={() => setRemoving(true)} className="text-danger">
              <Trash2 size={14} aria-hidden="true" />
              {tr("احذف الإعلان", "Remove")}
            </Button>
          </div>
        )}
      </article>

      {canManageAnnouncement(user, a) && <Reads id={a.id} people={people} />}

      <Dialog
        open={removing}
        onClose={() => setRemoving(false)}
        title={tr("حذف الإعلان", "Remove the announcement")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(false)}>
              {tr("إلغاء", "Cancel")}
            </Button>
            <Button
              className="bg-danger hover:bg-danger"
              onClick={async () => {
                try {
                  await announcementsApi.remove(a.id);
                  toast(tr("حُذف الإعلان.", "Announcement removed."));
                  router.replace("/announcements");
                } catch (e) {
                  toast(errorText(e, tr), "danger");
                  setRemoving(false);
                }
              }}
            >
              {tr("احذف", "Remove")}
            </Button>
          </>
        }
      >
        <p className="text-sm">{tr("يختفي الإعلان عند الجميع. لتصحيح خطأ، احذفه وانشر إعلاناً جديداً.", "It disappears for everyone. To fix a mistake, remove it and post a new one.")}</p>
      </Dialog>
    </div>
  );
}

/** Who has seen it (with when) and who hasn't yet: the brief asks for both lists. */
function Reads({ id, people }: { id: number; people: Map<number, User> }) {
  const { tr, lang, ago } = useFmt();
  const load = useLoad(() => announcementsApi.reads(id), [id]);
  const nameOf = (u?: User) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-");
  if (!load.data) return load.state.status === "error" ? <ErrorBox error={load.state.error} onRetry={load.reload} /> : <Skeleton className="h-40 rounded-xl" />;
  const { seen, not_seen } = load.data;

  const box = (title: string, rows: { id: number; note?: string }[], empty: string) => (
    <section aria-label={title} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
      <h2 className="font-semibold">
        {title} <span className="num text-sm font-normal text-muted">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-faint">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const u = people.get(r.id);
            return (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                {u && <Avatar user={u} size="sm" />}
                <span className="flex-1">{nameOf(u)}</span>
                {r.note && <span className="text-xs text-faint">{r.note}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {box(tr("شاهدوه", "Seen"), seen.map((s) => ({ id: s.user_id, note: ago(s.at) })), tr("لم يشاهده أحد بعد.", "Nobody yet."))}
      {box(tr("لم يشاهدوه بعد", "Not seen yet"), not_seen.map((u) => ({ id: u })), tr("شاهده الجميع.", "Everyone has seen it."))}
    </div>
  );
}
