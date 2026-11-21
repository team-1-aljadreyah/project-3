import { ArrowRight, MessageSquarePlus, MessagesSquare, UsersRound } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { authApi } from "@/features/auth";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { AvatarStack, Empty, ErrorBox, IconButton, LoadingBlock, Skeleton } from "@/shared/ui";
import { chatApi } from "../api";
import { ConversationList } from "../components/conversation-list";
import { GroupActions } from "../components/group-actions";
import { GroupDialog } from "../components/group-dialog";
import { NewDirectDialog } from "../components/new-direct-dialog";
import { Thread } from "../components/thread";
import { canCreateGroupChat, chatTitle } from "../rules";
import type { ChatKind, Conversation } from "../types";

/**
 * The internal chat (/chat and /chat/p-3). On a computer: the list of chats beside the open chat. On a phone: the list,
 * or the open chat with a way back to the list.
 */
export function ChatPage() {
  const { tr, lang, num } = useFmt();
  const me = useUser();
  const { key } = useParams<{ key?: string }>();
  const load = useLoad(() => Promise.all([chatApi.conversations(), authApi.users()]));
  const [starting, setStarting] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const KIND: Record<ChatKind, string> = {
    project: tr("محادثة المشروع", "Project chat"),
    team: tr("محادثة الفريق", "Team chat"),
    direct: tr("محادثة خاصة", "Private chat"),
    group: tr("مجموعة", "Group chat"),
  };

  const list = load.data?.[0];
  const users = load.data?.[1] ?? [];
  const people = new Map(users.map((u) => [u.id, u]));
  // A group made a moment ago shows at once, before the list has loaded again with it.
  const [made, setMade] = useState<Conversation>();
  if (made && list?.some((c) => c.key === made.key)) setMade(undefined); // the list has it now
  const open = list?.find((c) => c.key === key) ?? (list && made?.key === key ? made : undefined);
  const title = open ? chatTitle(open, people, me.id, lang) : undefined;
  usePageTitle(title ?? tr("المحادثات", "Chats"));

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] min-h-[28rem] w-full max-w-6xl flex-col gap-3">
      <h1 className={cn("text-2xl font-semibold", key && "max-md:sr-only")}>{tr("المحادثات", "Chats")}</h1>

      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}

      {load.state.status !== "error" && (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-card max-md:grid-cols-1 md:grid-cols-[19rem_minmax(0,1fr)]">
          {/* The list: always on a computer; on a phone only when no chat is open. */}
          <nav aria-label={tr("قائمة المحادثات", "Chat list")} className={cn("flex min-h-0 flex-col border-line md:border-e", key && "max-md:hidden")}>
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <span className="flex-1 text-sm font-medium text-muted">{list ? tr(`${num(list.length)} محادثة`, `${num(list.length)} chats`) : " "}</span>
              {canCreateGroupChat(me) && (
                <IconButton label={tr("مجموعة جديدة", "New group")} onClick={() => setGrouping(true)} className="bg-transparent">
                  <UsersRound size={18} aria-hidden="true" />
                </IconButton>
              )}
              <IconButton label={tr("محادثة خاصة جديدة", "New private chat")} onClick={() => setStarting(true)} className="bg-transparent">
                <MessageSquarePlus size={18} aria-hidden="true" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!list && (
                <LoadingBlock className="flex flex-col gap-2 p-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </LoadingBlock>
              )}
              {list && list.length === 0 && <p className="p-6 text-center text-sm text-muted">{tr("لا محادثات بعد.", "No chats yet.")}</p>}
              {list && list.length > 0 && <ConversationList list={list} people={people} me={me.id} active={key} />}
            </div>
          </nav>

          {/* The open chat. */}
          <section aria-label={title ?? tr("المحادثة", "Chat")} className={cn("flex min-h-0 flex-col", !key && "max-md:hidden")}>
            {!key && (
              <div className="m-auto p-6">
                <Empty
                  title={tr("اختر محادثة", "Choose a chat")}
                  body={tr("محادثات مشاريعك وفريقك ومجموعاتك والمحادثات الخاصة تظهر في القائمة.", "Your projects', your team's, your groups' and your private chats are in the list.")}
                />
              </div>
            )}
            {key && list && !open && (
              <div className="m-auto p-6">
                <Empty
                  title={tr("لم يُعثر على المحادثة", "Chat not found")}
                  body={tr("قد لا تكون عضواً فيها.", "You may not be one of its members.")}
                  action={
                    <Link href="/chat" className="text-sm font-medium text-accent hover:underline">
                      {tr("كل المحادثات", "All chats")}
                    </Link>
                  }
                />
              </div>
            )}
            {open && (
              <>
                <header className="flex items-center gap-2 border-b border-line px-3 py-2">
                  <Link href="/chat" aria-label={tr("رجوع إلى المحادثات", "Back to the chats")} className="rounded-lg p-1.5 text-muted hover:bg-chip md:hidden">
                    <ArrowRight size={18} aria-hidden="true" className="ltr:-scale-x-100" />
                  </Link>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span dir="auto" className="truncate font-semibold">
                      {title}
                    </span>
                    <span className="text-xs text-muted">
                      {KIND[open.kind]}
                      {" · "}
                      {tr(`${num(open.member_ids.length)} أعضاء`, `${num(open.member_ids.length)} members`)}
                    </span>
                  </span>
                  <span className="max-sm:hidden">
                    <AvatarStack users={open.member_ids.flatMap((id) => people.get(id) ?? [])} max={4} />
                  </span>
                  {open.kind === "group" && <GroupActions group={open} people={users} me={me} />}
                </header>
                <Thread key={open.key} chatKey={open.key} people={people} members={open.member_ids.flatMap((id) => people.get(id) ?? [])} me={me} />
              </>
            )}
            {key && !list && (
              <div className="m-auto text-faint">
                <MessagesSquare size={28} aria-hidden="true" />
              </div>
            )}
          </section>
        </div>
      )}

      <NewDirectDialog open={starting} onClose={() => setStarting(false)} people={users} me={me.id} />
      <GroupDialog open={grouping} onClose={() => setGrouping(false)} people={users} me={me.id} onCreated={setMade} />
    </div>
  );
}
