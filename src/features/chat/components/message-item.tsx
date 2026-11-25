import { FileText, Reply } from "lucide-react";
import { stableUrl } from "@/shared/lib/stable-url";
import { useState } from "react";
import { ImageViewer, isImage } from "@/features/attachments";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Avatar, PersonName } from "@/shared/ui";
import { splitMentions } from "../rules";
import type { Message } from "../types";
import { messageSummary } from "../voice";
import { VoiceNote } from "./voice-note";

/**
 * One message: who wrote it and when, the message it answers (a click jumps to it), the text with @mentions in colour,
 * its voice recording (a player), and its images and files. "رد" starts an answer to it.
 */
export function MessageItem({
  m,
  replied,
  people,
  mine,
  me,
  onReply,
  onJump,
  flash,
}: {
  m: Message;
  replied?: Message;
  people: Map<number, User>;
  mine: boolean;
  /** The person reading, for the "not listened yet" mark of voice messages from others. */
  me: number;
  /** Show another message of this chat (a reply's original), loading older ones when needed. */
  onJump?: (id: number) => void;
  /** Lit for a moment after a jump to it. */
  flash?: boolean;
  /** Missing while the message is still on its way: it can be answered once the server has it. */
  onReply?: (m: Message) => void;
}) {
  const { tr, lang, dateTime } = useFmt();
  const nameOf = (id: number) => {
    const u = people.get(id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };
  const author = people.get(m.author_id);
  // Mentions are written with the Arabic name (as they were typed), so both names are looked for.
  const mentionNames = m.mentions.flatMap((id) => [people.get(id)?.name ?? "", people.get(id)?.name_en ?? ""]);
  const voices = m.files.filter((f) => f.voice);
  const files = m.files.filter((f) => !f.voice && !isImage(f.mime));
  // Pictures show as a preview and open in the viewer (not a download).
  const pictures = m.files.filter((f) => !f.voice && isImage(f.mime));
  const [viewing, setViewing] = useState<number | null>(null);

  return (
    <li id={`msg-${m.id}`} className={cn("group flex gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-700 target:bg-accent-soft hover:bg-card-2", flash && "bg-accent-soft")}>
      {author && <Avatar user={author} size="sm" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <b className={cn("font-semibold", mine && "text-accent")}>{author ? <PersonName person={author} /> : nameOf(m.author_id)}</b>
          <time dateTime={m.created_at} className="text-xs text-faint">
            {dateTime(m.created_at)}
          </time>
        </p>
        {/* The quote of the message this one answers: pressing it shows that message (older ones load first). Only the
            list scrolls, not the page. */}
        {m.reply_to && (
          <button
            type="button"
            onClick={() => onJump?.(m.reply_to!)}
            className="flex max-w-full items-center gap-1.5 truncate rounded-md border-s-2 border-accent bg-chip px-2 py-1 text-start text-xs text-muted hover:text-text"
          >
            <Reply size={12} aria-hidden="true" className="shrink-0 rtl:-scale-x-100" />
            <span className="truncate">
              {replied ? (
                <>
                  <b className="font-medium">{nameOf(replied.author_id)}:</b> <bdi>{messageSummary(replied, tr)}</bdi>
                </>
              ) : (
                tr("ردّ على رسالة أقدم، اضغط لعرضها", "A reply to an older message: press to show it")
              )}
            </span>
          </button>
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
        {voices.map((f) => (
          <VoiceNote
            key={f.id}
            id={f.id}
            src={stableUrl(f.url)}
            duration={f.voice!.duration_s}
            peaks={f.voice!.peaks}
            tone={mine ? "mine" : "theirs"}
            heardBy={mine ? undefined : me}
            download={{ name: f.name, size: f.size }}
          />
        ))}
        {pictures.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={tr("صور", "Pictures")}>
            {pictures.map((f, i) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setViewing(i)}
                  aria-label={tr(`اعرض الصورة ${f.name}`, `View the picture ${f.name}`)}
                  className="group block overflow-hidden rounded-xl border border-line bg-card-2 transition-colors hover:border-accent"
                >
                  {/* A user's file (a data: link in the demo, a short-lived link later): next/image can't optimise those. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stableUrl(f.url)}
                    alt=""
                    loading="lazy"
                    className={cn("block object-cover transition-transform duration-300 group-hover:scale-[1.02]", pictures.length === 1 ? "max-h-72 w-auto max-w-[min(18rem,70vw)]" : "size-32")}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
        <ImageViewer
          images={pictures.map((f) => ({ id: f.id, url: stableUrl(f.url), name: f.name, size: f.size, caption: `${author ? (lang === "en" && author.name_en ? author.name_en : author.name) : nameOf(m.author_id)} · ${dateTime(m.created_at)}` }))}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f) => (
              <li key={f.id}>
                <a href={stableUrl(f.url)} download={f.name} className="flex items-center gap-2 rounded-lg border border-line bg-card p-1.5 pe-3 text-xs hover:border-accent">
                  <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-md bg-chip text-muted">
                    <FileText size={16} />
                  </span>
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
        onClick={() => onReply?.(m)}
        // Kept in place while the message is on its way, so nothing moves when it arrives.
        disabled={!onReply}
        aria-label={tr(`ردّ على رسالة ${nameOf(m.author_id)}`, `Reply to ${nameOf(m.author_id)}`)}
        className={cn("flex h-7 shrink-0 items-center gap-1 self-start rounded-md px-2 text-xs text-muted hover:bg-chip hover:text-text focus-visible:opacity-100", !onReply && "invisible")}
      >
        <Reply size={13} aria-hidden="true" className="rtl:-scale-x-100" />
        {tr("رد", "Reply")}
      </button>
    </li>
  );
}
