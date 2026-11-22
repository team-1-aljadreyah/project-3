import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { chatTitle, type Conversation } from "@/features/chat";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { Avatar } from "@/shared/ui";
import { preview, unreadChats, unreadSentence } from "../alerts";

/**
 * The reminders for chats with messages the person hasn't read: one row per chat, newest first, with the last sender's
 * picture and a short preview; the whole row opens the chat. Worked out from each chat's unread count (GET /chats), not
 * stored: opening the chat removes its row at once, and it can never be out of date.
 */
export function UnreadChats({ convs, people, me, onOpen, headingId }: { convs: Conversation[]; people: Map<number, User>; me: number; onOpen?: () => void; headingId: string }) {
  const fmt = useFmt();
  const { tr, lang } = fmt;
  const list = unreadChats(convs);
  if (!list.length) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-0.5">
      <h3 id={headingId} className="flex items-center gap-1.5 px-3 pt-1.5 pb-1 text-xs font-semibold text-muted">
        <MessageCircle size={13} aria-hidden="true" />
        {tr("رسائل لم تقرأها", "Unread messages")}
      </h3>
      {list.map((c) => {
        const last = c.last_message;
        const sender = last ? people.get(last.author_id) : undefined;
        const senderName = sender ? (lang === "en" && sender.name_en ? sender.name_en : sender.name) : "";
        return (
          <Link
            key={c.key}
            href={`/chat/${c.key}`}
            onClick={onOpen}
            className="flex items-start gap-3 rounded-lg bg-accent-soft/50 px-3 py-2.5 transition-colors hover:bg-chip"
          >
            {sender ? (
              <Avatar user={sender} size="sm" />
            ) : (
              <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chip text-muted">
                <MessageCircle size={14} />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">{unreadSentence(c.unread, chatTitle(c, people, me, lang), c.kind === "direct", lang)}</span>
              {last && (
                <span className="truncate text-[13px] text-muted">
                  {c.kind !== "direct" && senderName && <span className="font-medium text-text">{senderName}: </span>}
                  <bdi>{last.body.trim() ? preview(last.body, 80) : tr("ملف مرفق", "A file")}</bdi>
                </span>
              )}
              {last && (
                <time dateTime={last.created_at} className="text-xs text-faint">
                  {fmt.ago(last.created_at)}
                </time>
              )}
            </span>
            <span aria-hidden="true" className="num mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">
              {fmt.num(c.unread)}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
