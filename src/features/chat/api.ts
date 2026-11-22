// The internal chat. Pages call `chatApi`; the .env switch decides if it is the real server or the demo backend
// (./mock.ts). Both follow `ChatApi`. Files go through the attachments feature (owner type "message").
import { http, lazyApi } from "@/shared/api";
import type { ChatKey, Conversation, GroupChange, GroupInput, Message, MessageInput, MessagePage } from "./types";

export interface ChatApi {
  /** This person's chats: their projects, their team, their private chats; the latest message first. */
  conversations(): Promise<Conversation[]>;
  /**
   * A chat's messages, oldest first. With `limit`: only the newest `limit` (the chat opens with those); with `before`
   * too: the `limit` messages just older than that message id (scrolling up loads them). Without both: all of them.
   */
  messages(key: ChatKey, page?: MessagePage): Promise<Message[]>;
  send(key: ChatKey, input: MessageInput): Promise<Message>;
  /** This person has read everything in the chat so far. */
  markRead(key: ChatKey): Promise<void>;
  /** The private chat with this person: the existing one, or a new one. */
  startDirect(userId: number): Promise<Conversation>;
  /** A new group chat with a name and the people picked; the creator is always in it. */
  createGroup(input: GroupInput): Promise<Conversation>;
  /** Rename a group or change its members (its manager and the CEO only). */
  updateGroup(key: ChatKey, change: GroupChange): Promise<Conversation>;
  /** This person leaves the group (any member). */
  leaveGroup(key: ChatKey): Promise<void>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const chatHttp: ChatApi = {
  conversations: () => data(http.get<Conversation[]>("/chats")),
  messages: (key, page) => data(http.get<Message[]>(`/chats/${key}/messages`, { params: page })),
  send: (key, input) => data(http.post<Message>(`/chats/${key}/messages`, input)),
  markRead: (key) => data(http.post<void>(`/chats/${key}/read`)),
  startDirect: (userId) => data(http.post<Conversation>("/chats/direct", { user_id: userId })),
  createGroup: (input) => data(http.post<Conversation>("/chats/groups", input)),
  updateGroup: (key, change) => data(http.patch<Conversation>(`/chats/${key}`, change)),
  leaveGroup: (key) => data(http.post<void>(`/chats/${key}/leave`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const chatApi: ChatApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.chatMock)) : chatHttp;
