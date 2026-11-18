// The internal chat. Pages call `chatApi`; the .env switch decides if it is the real server or the demo backend
// (./mock.ts). Both follow `ChatApi`. Files go through the attachments feature (owner type "message").
import { http, lazyApi } from "@/shared/api";
import type { ChatKey, Conversation, Message, MessageInput } from "./types";

export interface ChatApi {
  /** This person's chats: their projects, their team, their private chats; the latest message first. */
  conversations(): Promise<Conversation[]>;
  messages(key: ChatKey): Promise<Message[]>;
  send(key: ChatKey, input: MessageInput): Promise<Message>;
  /** This person has read everything in the chat so far. */
  markRead(key: ChatKey): Promise<void>;
  /** The private chat with this person: the existing one, or a new one. */
  startDirect(userId: number): Promise<Conversation>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const chatHttp: ChatApi = {
  conversations: () => data(http.get<Conversation[]>("/chats")),
  messages: (key) => data(http.get<Message[]>(`/chats/${key}/messages`)),
  send: (key, input) => data(http.post<Message>(`/chats/${key}/messages`, input)),
  markRead: (key) => data(http.post<void>(`/chats/${key}/read`)),
  startDirect: (userId) => data(http.post<Conversation>("/chats/direct", { user_id: userId })),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const chatApi: ChatApi = import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.chatMock)) : chatHttp;
