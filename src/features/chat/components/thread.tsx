import { ArrowDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePoll } from "@/shared/lib/poll";
import { useLoad } from "@/shared/lib/use-load";
import { ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { chatApi } from "../api";
import type { ChatKey, Message } from "../types";
import { canWriteInDirect } from "../rules";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";

/** How many messages a chat opens with. */
export const PAGE = 30;
/** How many older ones come in each time you scroll to the top (the client, 22 November 2026: "10 by 10"). */
export const OLDER = 10;
const POLL_MS = 3000;
/** Pages to load at most when a reply points to an older message (30 × 20 = the 600 messages before the shown ones). */
const MAX_JUMP_PAGES = 20;

/**
 * What the box to write tells the list while a message is on its way, so it shows at once as sent (the client,
 * 25 November 2026: "when I send, show it already sent, without waiting").
 */
export interface Outbox {
  /** Show this message now (its id is a temporary negative number). */
  add(m: Message): void;
  /** The server has it: the real one takes the shown one's place, without moving (`temp` null: it wasn't shown early). */
  done(temp: number | null, real: Message): void;
  /** It wasn't sent: take it away (the box gets the text back, with the error); `reply` is what it answered. */
  drop(temp: number, reply?: Message): void;
}

/** Older pages and the newest one together, each message once, oldest first. */
function merge(older: Message[], latest: Message[]) {
  const byId = new Map<number, Message>();
  for (const m of older) byId.set(m.id, m);
  for (const m of latest) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * One chat's messages, the oldest at the top and the box to write at the bottom.
 * - It opens with the newest messages only; scrolling to the top loads the older ones, a page at a time, and the
 *   message you were reading stays where it was.
 * - Other people's messages appear by themselves: the chat asks the server for the newest page every few seconds while
 *   it is shown.
 * - A new message brings the list to the bottom when you are already there (or wrote it); while you read older ones it
 *   waits under a "new messages" button.
 * - Only this list scrolls, never the page around it (sending a message used to move the whole page).
 * - Opening the chat (and every new message while it is open) marks it as read.
 */
export function Thread({ chatKey, people, members, me }: { chatKey: ChatKey; people: Map<number, User>; members: User[]; me: User }) {
  const { tr, lang } = useFmt();
  const load = useLoad(() => chatApi.messages(chatKey, { limit: PAGE }), [chatKey]);
  usePoll(load.reload, POLL_MS);
  const [older, setOlder] = useState<Message[]>([]);
  const [noOlder, setNoOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<Message>();
  const [flash, setFlash] = useState<number | null>(null);
  // Sent from here: shown at once (pending), then the server's copy until the next refresh brings it (sent).
  const [pending, setPending] = useState<Message[]>([]);
  const [sent, setSent] = useState<Message[]>([]);
  // A sent message keeps the key it was shown with, so it isn't drawn again when the real one arrives.
  const [shownAs, setShownAs] = useState<Record<number, number>>({});
  const outbox: Outbox = {
    add: (m) => setPending((list) => [...list, m]),
    done: (temp, real) => {
      if (temp !== null) setShownAs((keys) => ({ ...keys, [real.id]: temp }));
      setSent((list) => [...list.filter((m) => m.id !== real.id), real]);
      if (temp !== null) setPending((list) => list.filter((m) => m.id !== temp));
    },
    drop: (temp, reply) => {
      setPending((list) => list.filter((m) => m.id !== temp));
      if (reply) setReplyTo(reply);
    },
  };
  const latest = load.data;
  // The server's newest page wins over our own copy of a sent message (it may have its files by then). Both lists keep
  // each message's chat, so another chat opened meanwhile never shows them.
  const here = (m: Message) => m.chat === chatKey;
  const messages = latest ? [...merge(older, [...sent.filter(here), ...latest]), ...pending.filter(here)] : undefined;
  const loaded = messages !== undefined;
  const hasOlder = !!latest && !noOlder && (older.length > 0 || latest.length >= PAGE);
  const lastId = messages?.at(-1)?.id;
  const lastMine = messages?.at(-1)?.author_id === me.id;
  const hasList = !!messages?.length;

  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);
  const shownFor = useRef<string | null>(null);
  const seenLast = useRef<number | undefined>(undefined);
  // Where the reader was before older messages were added on top: put back after they are drawn.
  const keepPlace = useRef<{ height: number; top: number } | null>(null);
  const [unseen, setUnseen] = useState(0);

  const scrollToBottom = (smooth = false) => {
    const el = box.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setUnseen(0);
  };

  // Another chat, or a new message: go to the bottom (when you are there, or it is yours) and mark it read.
  useEffect(() => {
    if (!loaded) return;
    const fresh = shownFor.current !== chatKey;
    const before = seenLast.current;
    shownFor.current = chatKey;
    seenLast.current = lastId;
    if (fresh || atBottom.current || lastMine) {
      const el = box.current;
      if (el) el.scrollTop = el.scrollHeight;
      atBottom.current = true;
      setUnseen(0);
    } else if (lastId !== before) {
      setUnseen((n) => n + 1);
    }
    chatApi.markRead(chatKey).catch(() => {});
  }, [chatKey, lastId, loaded, lastMine]);

  // Pictures and voice messages get their height a moment later: stay at the bottom if that is where you were.
  useEffect(() => {
    const el = box.current;
    const ol = list.current;
    if (!el || !ol || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => {
      if (atBottom.current && !keepPlace.current) el.scrollTop = el.scrollHeight;
    });
    watch.observe(ol);
    return () => watch.disconnect();
    // The list exists once there is a first message.
  }, [hasList]);

  // Older messages were added above: keep the one you were reading in the same place.
  useLayoutEffect(() => {
    const el = box.current;
    const place = keepPlace.current;
    if (!el || !place) return;
    el.scrollTop = el.scrollHeight - place.height + place.top;
    keepPlace.current = null;
  }, [older]);

  /** One more page of older messages. Resolves with what came (an empty list when there are no more). */
  const loadOlder = async (): Promise<Message[]> => {
    const first = messages?.[0];
    if (!first || loadingOlder) return [];
    setLoadingOlder(true);
    try {
      const page = await chatApi.messages(chatKey, { before: first.id, limit: OLDER });
      if (page.length < OLDER) setNoOlder(true);
      if (page.length) {
        const el = box.current;
        if (el) keepPlace.current = { height: el.scrollHeight, top: el.scrollTop };
        setOlder((o) => [...page, ...o]);
      }
      return page;
    } catch {
      return [];
    } finally {
      setLoadingOlder(false);
    }
  };

  /** Show a message (a reply's original): load older pages until it is there, then bring it into view and light it. */
  const jumpTo = async (id: number) => {
    let have = messages?.some((m) => m.id === id);
    let oldest = messages?.[0]?.id;
    for (let i = 0; !have && oldest && i < MAX_JUMP_PAGES; i++) {
      const page = await chatApi.messages(chatKey, { before: oldest, limit: PAGE }).catch(() => [] as Message[]);
      if (!page.length) break;
      if (page.length < PAGE) setNoOlder(true);
      setOlder((o) => [...page, ...o]);
      oldest = page[0].id;
      have = page.some((m) => m.id === id);
    }
    if (!have) return;
    setFlash(id);
    // After the older messages are drawn: scroll only the list, so the page itself never moves.
    requestAnimationFrame(() => {
      const el = box.current;
      const target = el?.querySelector<HTMLElement>(`#msg-${id}`);
      if (!el || !target) return;
      atBottom.current = false;
      el.scrollTo({ top: target.offsetTop - el.clientHeight / 3, behavior: "smooth" });
    });
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 2200);
  };

  const byId = new Map(messages?.map((m) => [m.id, m]));
  // A private chat with the CEO: you answer only once the CEO has written there (otherwise you send a request). Older
  // pages not loaded yet count as written: the other person can't write before the CEO, so any message means the CEO did.
  const other = members.find((u) => u.id !== me.id);
  const readOnly = !!other && members.length === 2 && chatKey.startsWith("d-") && !hasOlder && !canWriteInDirect(me, other, !!messages?.some((m) => m.author_id === other.id));
  const nameOf = (id: number) => {
    const u = people.get(id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          if (atBottom.current && unseen) setUnseen(0);
          // Near the top: the next 10 older messages come in.
          if (el.scrollTop < 160 && hasOlder && !loadingOlder) void loadOlder();
        }}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3"
      >
        {load.state.status === "loading" && (
          <LoadingBlock className="flex flex-col gap-3 p-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </LoadingBlock>
        )}
        {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} backHref="/chat" />}
        {messages && messages.length === 0 && <p className="p-6 text-center text-sm text-muted">{tr("لا رسائل بعد. ابدأ المحادثة.", "No messages yet. Start the conversation.")}</p>}
        {hasOlder && (
          // Loads by itself near the top; the button is there for the keyboard and when the list is short.
          <div className="flex justify-center pb-2">
            <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted hover:text-text disabled:opacity-60">
              {loadingOlder ? tr("جارٍ تحميل الرسائل الأقدم…", "Loading older messages…") : tr("اعرض الرسائل الأقدم", "Show older messages")}
            </button>
          </div>
        )}
        {messages && messages.length > 0 && (
          <ol ref={list} aria-label={tr("الرسائل", "Messages")} className="flex flex-col gap-0.5">
            {messages.map((m) => (
              <MessageItem
                key={shownAs[m.id] ?? m.id}
                m={m}
                replied={m.reply_to ? byId.get(m.reply_to) : undefined}
                people={people}
                mine={m.author_id === me.id}
                me={me.id}
                onReply={m.id > 0 ? setReplyTo : undefined}
                onJump={jumpTo}
                flash={flash === m.id}
              />
            ))}
          </ol>
        )}
      </div>
      {unseen > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-on-accent shadow-card"
        >
          <ArrowDown size={15} aria-hidden="true" />
          {unseen === 1 ? tr("رسالة جديدة", "1 new message") : tr(`رسائل جديدة: ${unseen}`, `${unseen} new messages`)}
        </button>
      )}
      {readOnly ? (
        <p className="border-t border-line bg-card-2 px-4 py-3 text-sm text-muted">
          {tr("لا يُراسَل المدير التنفيذي مباشرةً. ", "You don't message the CEO directly. ")}
          <Link href="/requests" className="font-medium text-accent-ink underline">
            {tr("أرسل طلباً بدلاً من ذلك", "Send a request instead")}
          </Link>
        </p>
      ) : (
        <Composer chatKey={chatKey} members={members} me={me} outbox={outbox} replyTo={replyTo} replyName={replyTo && nameOf(replyTo.author_id)} onCancelReply={() => setReplyTo(undefined)} />
      )}
    </div>
  );
}
