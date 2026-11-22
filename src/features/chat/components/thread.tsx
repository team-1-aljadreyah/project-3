import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { useLoad } from "@/shared/lib/use-load";
import { ErrorBox, LoadingBlock, Skeleton } from "@/shared/ui";
import { chatApi } from "../api";
import type { ChatKey, Message } from "../types";
import { canWriteInDirect } from "../rules";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";

/**
 * One chat's messages, the oldest at the top and the box to write at the bottom. Opening the chat (and every new
 * message while it is open) marks it as read, so the count in the list goes away.
 */
export function Thread({ chatKey, people, members, me }: { chatKey: ChatKey; people: Map<number, User>; members: User[]; me: User }) {
  const { tr, lang } = useFmt();
  const load = useLoad(() => chatApi.messages(chatKey), [chatKey]);
  const [replyTo, setReplyTo] = useState<Message>();
  const bottom = useRef<HTMLDivElement>(null);
  const messages = load.data;
  const loaded = messages !== undefined;
  const lastId = messages?.at(-1)?.id;

  // A new message (or another chat): go to the bottom and mark everything as read.
  useEffect(() => {
    if (!loaded) return;
    bottom.current?.scrollIntoView({ block: "end" });
    chatApi.markRead(chatKey).catch(() => {});
  }, [chatKey, lastId, loaded]);

  const byId = new Map(messages?.map((m) => [m.id, m]));
  // A private chat with the CEO: you answer only once the CEO has written (otherwise you send a request).
  const other = members.find((u) => u.id !== me.id);
  const readOnly = !!other && members.length === 2 && chatKey.startsWith("d-") && !canWriteInDirect(me, other, !!messages?.some((m) => m.author_id === other.id));
  const nameOf = (id: number) => {
    const u = people.get(id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {load.state.status === "loading" && (
          <LoadingBlock className="flex flex-col gap-3 p-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </LoadingBlock>
        )}
        {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} backHref="/chat" />}
        {messages && messages.length === 0 && <p className="p-6 text-center text-sm text-muted">{tr("لا رسائل بعد. ابدأ المحادثة.", "No messages yet. Start the conversation.")}</p>}
        {messages && messages.length > 0 && (
          <ol aria-label={tr("الرسائل", "Messages")} className="flex flex-col gap-0.5">
            {messages.map((m) => (
              <MessageItem key={m.id} m={m} replied={m.reply_to ? byId.get(m.reply_to) : undefined} people={people} mine={m.author_id === me.id} me={me.id} onReply={setReplyTo} />
            ))}
          </ol>
        )}
        <div ref={bottom} />
      </div>
      {readOnly ? (
        <p className="border-t border-line bg-card-2 px-4 py-3 text-sm text-muted">
          {tr("لا تُراسَل المديرة التنفيذية مباشرة. ", "You don't message the CEO directly. ")}
          <Link href="/requests" className="font-medium text-accent-ink underline">
            {tr("أرسل طلباً بدلاً من ذلك", "Send a request instead")}
          </Link>
        </p>
      ) : (
        <Composer chatKey={chatKey} members={members} me={me} replyTo={replyTo} replyName={replyTo && nameOf(replyTo.author_id)} onCancelReply={() => setReplyTo(undefined)} />
      )}
    </div>
  );
}
