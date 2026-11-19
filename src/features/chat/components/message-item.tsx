import { FileText, Reply } from "lucide-react";
import { isImage } from "@/features/attachments";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Avatar } from "@/shared/ui";
import { splitMentions } from "../rules";
import type { Message } from "../types";

/**
 * One message: who wrote it and when, the message it answers (a click jumps to it), the text with @mentions in colour,
 * and its images and files. "رد" starts an answer to it.
 */
export function MessageItem({
  m,
  replied,
  people,
  mine,
  onReply,
}: {
  m: Message;
  replied?: Message;
  people: Map<number, User>;
  mine: boolean;
  onReply: (m: Message) => void;
}) {
  const { tr, lang, dateTime } = useFmt();
  const nameOf = (id: number) => {
    const u = people.get(id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };
  const author = people.get(m.author_id);
  // Mentions are written with the Arabic name (as they were typed), so both names are looked for.
  const mentionNames = m.mentions.flatMap((id) => [people.get(id)?.name ?? "", people.get(id)?.name_en ?? ""]);

  return (
    <li id={`msg-${m.id}`} className="group flex gap-2.5 rounded-lg px-2 py-1.5 target:bg-accent-soft hover:bg-card-2">
      {author && <Avatar user={author} size="sm" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <b className={cn("font-semibold", mine && "text-accent")}>{nameOf(m.author_id)}</b>
          <time dateTime={m.created_at} className="text-xs text-faint">
            {dateTime(m.created_at)}
          </time>
        </p>
        {replied && (
          <a href={`#msg-${replied.id}`} className="flex max-w-full items-center gap-1.5 truncate rounded-md border-s-2 border-accent bg-chip px-2 py-1 text-xs text-muted hover:text-text">
            <Reply size={12} aria-hidden="true" className="shrink-0 rtl:-scale-x-100" />
            <span className="truncate">
              <b className="font-medium">{nameOf(replied.author_id)}:</b> <bdi>{replied.body || tr("ملف", "A file")}</bdi>
            </span>
          </a>
        )}
        {m.body && (
          <p dir="auto" className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {splitMentions(m.body, mentionNames).map((part, i) =>
              typeof part === "string" ? (
                part
              ) : (
                <span key={i} className="rounded bg-accent-soft px-0.5 font-medium text-accent-ink">
                  @{part.mention}
                </span>
              ),
            )}
          </p>
        )}
        {m.files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {m.files.map((f) => (
              <li key={f.id}>
                <a href={f.url} download={f.name} className="flex items-center gap-2 rounded-lg border border-line bg-card p-1.5 pe-3 text-xs hover:border-accent">
                  {isImage(f.mime) ? (
                    // A user's file (a data: link in the demo, a short-lived link later): next/image can't optimise those.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="size-14 rounded-md object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-md bg-chip text-muted">
                      <FileText size={16} />
                    </span>
                  )}
                  <span dir="auto" className="max-w-40 truncate">
                    {f.name}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => onReply(m)}
        aria-label={tr(`ردّ على رسالة ${nameOf(m.author_id)}`, `Reply to ${nameOf(m.author_id)}`)}
        className="flex h-7 shrink-0 items-center gap-1 self-start rounded-md px-2 text-xs text-muted opacity-60 group-hover:opacity-100 hover:bg-chip hover:text-text focus-visible:opacity-100"
      >
        <Reply size={13} aria-hidden="true" className="rtl:-scale-x-100" />
        {tr("رد", "Reply")}
      </button>
    </li>
  );
}
