import { arN, W } from "@/shared/lib/count-words";
import { ArrowRight, MessageSquarePlus, MessagesSquare, Search, UsersRound } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/features/auth";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { featureOn, roleAllows, useSiteLive } from "@/shared/lib/site";
import { usePoll } from "@/shared/lib/poll";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { useRouteParam } from "@/shared/lib/route-param";
import { AvatarStack, Empty, ErrorBox, IconButton, LoadingBlock, Skeleton } from "@/shared/ui";
import { chatApi } from "../api";
import { ChatInfo } from "../components/chat-info";
import { ConversationList } from "../components/conversation-list";
import { GroupActions } from "../components/group-actions";
import { GroupDialog } from "../components/group-dialog";
import { NewDirectDialog } from "../components/new-direct-dialog";
import { Thread } from "../components/thread";
import { canCreateGroupChat, chatMatches, chatTitle } from "../rules";
import type { ChatKind, Conversation } from "../types";

/**
 * The internal chat (/chat and /chat/p-3). On a computer: the list of chats beside the open chat. On a phone: the list,
 * or the open chat with a way back to the list.
 */
export function ChatPage() {
  const { tr, lang, num } = useFmt();
  const me = useUser();
  // The CEO may switch new group chats off (advanced settings).
  const live = useSiteLive();
  const key = useRouteParam("chat");
  const load = useLoad(() => Promise.all([chatApi.conversations(), authApi.users()]));
  // The list keeps up with other people's messages while it is shown (the open chat asks more often, thread.tsx).
  usePoll(load.reload, 10_000);
  const [starting, setStarting] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const [info, setInfo] = useState(false);
  // The list's search box and kind filter: with many chats, one is found by its name, a member's name, or its kind.
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<ChatKind | "all">("all");
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
  const FILTERS: { kind: ChatKind | "all"; label: string }[] = [
    { kind: "all", label: tr("الكل", "All") },
    { kind: "group", label: tr("المجموعات", "Groups") },
    { kind: "team", label: tr("الفرق", "Teams") },
    { kind: "project", label: tr("المشاريع", "Projects") },
    { kind: "direct", label: tr("الخاصة", "Private") },
  ];
  // Only the kinds this person has chats of.
  const filters = FILTERS.filter((f) => f.kind === "all" || list?.some((c) => c.kind === f.kind));
  const shownList = list?.filter((c) => (only === "all" || c.kind === only) && chatMatches(c, search, people, me.id));
  const searching = !!search.trim() || only !== "all";
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
              {canCreateGroupChat(me) && featureOn(live, "group_chats", me.role) && roleAllows(live, me, "create_group_chat") && (
                <IconButton label={tr("مجموعة جديدة", "New group")} onClick={() => setGrouping(true)} className="bg-transparent">
                  <UsersRound size={18} aria-hidden="true" />
                </IconButton>
              )}
              <IconButton label={tr("محادثة خاصة جديدة", "New private chat")} onClick={() => setStarting(true)} className="bg-transparent">
                <MessageSquarePlus size={18} aria-hidden="true" />
              </IconButton>
            </div>
            {list && list.length > 0 && (
              <div className="flex flex-col gap-2 border-b border-line px-3 py-2.5">
                <label className="relative block">
                  <span className="sr-only">{tr("ابحث في المحادثات", "Search the chats")}</span>
                  <Search size={15} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    type="search"
                    dir="auto"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearch("");
                    }}
                    placeholder={tr("ابحث باسم مجموعة أو فريق أو شخص", "Search by group, team or person")}
                    className="h-9 w-full rounded-lg border border-line bg-card-2 ps-9 pe-3 text-sm outline-none placeholder:text-faint focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent-soft"
                  />
                </label>
                {filters.length > 2 && (
                  <div role="group" aria-label={tr("نوع المحادثة", "Kind of chat")} className="-mx-1 flex gap-1 overflow-x-auto px-1">
                    {filters.map((f) => (
                      <button
                        key={f.kind}
                        type="button"
                        aria-pressed={only === f.kind}
                        onClick={() => setOnly(f.kind)}
                        className={cn(
                          "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                          only === f.kind ? "bg-text text-card" : "text-muted hover:bg-chip hover:text-text",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!list && (
                <LoadingBlock className="flex flex-col gap-2 p-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </LoadingBlock>
              )}
              {list && list.length === 0 && <p className="p-6 text-center text-sm text-muted">{tr("لا محادثات بعد.", "No chats yet.")}</p>}
              {shownList && shownList.length > 0 && <ConversationList list={shownList} people={people} me={me.id} active={key} />}
              {list && list.length > 0 && shownList?.length === 0 && (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted">
                  <p>{tr("لا محادثة تطابق البحث.", "No chat matches the search.")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setOnly("all");
                    }}
                    className="font-medium text-accent-ink hover:underline"
                  >
                    {tr("اعرض كل المحادثات", "Show all chats")}
                  </button>
                </div>
              )}
              <p role="status" className="sr-only">
                {searching && shownList ? tr(`النتائج: ${num(shownList.length)}`, `${shownList.length} results`) : ""}
              </p>
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
                  {/* The name and the faces are one button: the chat's details and its members (and from there its
                      project, team or person). */}
                  <button
                    type="button"
                    onClick={() => setInfo(true)}
                    aria-label={tr(`معلومات المحادثة وأعضاؤها: ${title}`, `About this chat and its members: ${title}`)}
                    className="-my-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-start transition-colors hover:bg-chip/60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span dir="auto" className="truncate font-semibold">
                        {title}
                      </span>
                      <span className="text-xs text-muted">
                        {KIND[open.kind]}
                        {" · "}
                        {tr(`${arN(open.member_ids.length, W.member)}`, `${num(open.member_ids.length)} members`)}
                      </span>
                    </span>
                    <span className="max-sm:hidden">
                      <AvatarStack users={open.member_ids.flatMap((id) => people.get(id) ?? [])} max={4} />
                    </span>
                  </button>
                  {open.kind === "group" && <GroupActions group={open} people={users} me={me} />}
                </header>
                <ChatInfo open={info} onClose={() => setInfo(false)} chat={open} title={title ?? ""} kindLabel={KIND[open.kind]} people={people} me={me} />
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
