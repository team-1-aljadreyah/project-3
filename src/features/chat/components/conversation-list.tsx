import { FolderKanban, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Avatar } from "@/shared/ui";
import { chatTitle } from "../rules";
import type { Conversation } from "../types";

/**
 * The person's chats, the newest first. Each whole row opens its chat (click anywhere), with the last message and
 * how many new messages wait in it.
 */
export function ConversationList({ list, people, me, active }: { list: Conversation[]; people: Map<number, User>; me: number; active?: string }) {
  const { tr, lang, ago, num } = useFmt();

  return (
    <ul className="flex flex-col gap-0.5 p-1.5">
      {list.map((c) => {
        const title = chatTitle(c, people, me, lang);
        const last = c.last_message;
        const other = c.kind === "direct" ? people.get(c.member_ids.find((id) => id !== me) ?? me) : undefined;
        const preview = last ? (last.body || tr("ملف مرفق", "A file")) : tr("لا رسائل بعد", "No messages yet");
        return (
          <li key={c.key}>
            <Link
              href={`/chat/${c.key}`}
              aria-current={c.key === active ? "page" : undefined}
              className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-card-2", c.key === active && "bg-accent-soft hover:bg-accent-soft")}
            >
              {other ? (
                // The name is already the row's text: the picture is only for the eye.
                <span aria-hidden="true">
                  <Avatar user={other} size="lg" />
                </span>
              ) : c.kind === "group" ? (
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <UsersRound size={18} />
                </span>
              ) : (
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chip text-muted">
                  {c.kind === "project" ? <FolderKanban size={18} /> : <Users size={18} />}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline gap-2">
                  <span dir="auto" className={cn("min-w-0 flex-1 truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>
                    {title}
                  </span>
                  {c.kind === "group" && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 self-center text-[11px] text-muted">
                      <UsersRound size={11} aria-hidden="true" />
                      {num(c.member_ids.length)}
                      <span className="sr-only">{tr(" أعضاء في المجموعة", " group members")}</span>
                    </span>
                  )}
                  {last && <span className="shrink-0 text-[11px] text-faint">{ago(last.created_at)}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span dir="auto" className={cn("flex-1 truncate text-xs", c.unread ? "text-text" : "text-muted")}>
                    {preview}
                  </span>
                  {c.unread > 0 && (
                    <span className="rounded-full bg-accent px-1.5 text-[11px] leading-5 font-semibold text-on-accent">
                      {num(c.unread)}
                      <span className="sr-only">{tr(" رسائل جديدة", " new messages")}</span>
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
