import { ArrowLeft, FolderKanban, MessagesSquare, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import type { Role, User } from "@/shared/api/types";
import { personHref } from "@/shared/lib/access";
import { useFmt } from "@/shared/lib/i18n";
import { roleName } from "@/shared/lib/site";
import { Avatar, Dialog, MaybeLink } from "@/shared/ui";
import { parseKey } from "../rules";
import type { Conversation } from "../types";

// Who comes first in the list: the people who lead, then the rest.
const ORDER: Role[] = ["ceo", "pm", "monitor", "lead", "employee", "admin"];

/**
 * The chat's details, opened from its header (its name or the faces): what kind of chat it is, the way to its project,
 * team or person, and every member with their job. A member's row opens their page when the reader may see it.
 */
export function ChatInfo({ open, onClose, chat, title, kindLabel, people, me }: { open: boolean; onClose: () => void; chat: Conversation; title: string; kindLabel: string; people: Map<number, User>; me: User }) {
  const { tr, lang, num } = useFmt();
  const members = chat.member_ids
    .flatMap((id) => people.get(id) ?? [])
    .sort((a, b) => Number(b.id === me.id) - Number(a.id === me.id) || ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.name.localeCompare(b.name, "ar"));
  const id = parseKey(chat.key)?.id;
  const other = chat.kind === "direct" ? members.find((u) => u.id !== me.id) : undefined;
  const otherHref = other ? personHref(me, other) : undefined;
  const place =
    chat.kind === "project" && id
      ? { href: `/projects/${id}`, label: tr("افتح المشروع", "Open the project"), icon: FolderKanban }
      : chat.kind === "team" && id
        ? { href: `/teams/${id}`, label: tr("صفحة الفريق", "The team's page"), icon: UsersRound }
        : other && otherHref
          ? { href: otherHref, label: tr("صفحة الشخص", "Their page"), icon: UserRound }
          : null;

  return (
    <Dialog open={open} onClose={onClose} title={tr("معلومات المحادثة", "About this chat")}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
            <MessagesSquare size={22} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span dir="auto" className="truncate text-lg font-semibold">
              {title}
            </span>
            <span className="text-sm text-muted">
              {kindLabel} · {tr(`${num(members.length)} أعضاء`, `${members.length} members`)}
            </span>
          </div>
          {place && (
            <Link href={place.href} onClick={onClose} className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent-ink">
              <place.icon size={15} aria-hidden="true" />
              {place.label}
              <ArrowLeft size={14} aria-hidden="true" className="ltr:rotate-180" />
            </Link>
          )}
        </div>

        <section aria-labelledby="chat-members-title" className="flex flex-col gap-2">
          <h3 id="chat-members-title" className="text-sm font-semibold">
            {tr("الأعضاء", "Members")}
          </h3>
          <ul className="flex max-h-[50vh] flex-col overflow-y-auto rounded-xl border border-line">
            {members.map((u) => {
              const name = lang === "en" && u.name_en ? u.name_en : u.name;
              const href = personHref(me, u);
              return (
                // The whole row opens the person's page (when the reader may see it).
                <li key={u.id} className="relative flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-card-2">
                  <Avatar user={u} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 truncate text-sm font-medium">
                      <MaybeLink href={href} cover>
                        {name}
                      </MaybeLink>
                      {u.id === me.id && <span className="text-xs font-normal text-muted">{tr("(أنت)", "(you)")}</span>}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {roleName(u, lang)}
                      {u.title ? ` · ${u.title}` : ""}
                    </span>
                  </span>
                  {chat.kind === "group" && chat.created_by === u.id && <span className="shrink-0 rounded-md bg-chip px-2 py-0.5 text-xs text-muted">{tr("مدير المجموعة", "Group manager")}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
