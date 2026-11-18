// The data shapes of the internal chat, shared by the real API, the demo backend and the pages.
import type { Attachment } from "@/features/attachments";

/** The three kinds of chat in the brief: one per project, one per team, and private messages between two people. */
export type ChatKind = "project" | "team" | "direct";

/**
 * A chat's key, safe in a web address: "p-3" (project 3), "t-1" (team 1), "d-7" (private chat 7).
 * Project and team chats exist by themselves; a private chat is made the first time someone writes.
 */
export type ChatKey = string;

export interface Conversation {
  key: ChatKey;
  kind: ChatKind;
  /** The project's or team's name; for a private chat, the other person's name (the page writes it). */
  title: string;
  title_en?: string;
  /** Who can read and write here (the brief: only the project's members, the team's members, or the two people). */
  member_ids: number[];
  last_message?: Message;
  /** Messages from others since this person last opened the chat. */
  unread: number;
}

export interface Message {
  id: number;
  chat: ChatKey;
  author_id: number;
  body: string;
  /** The message this one answers (the brief: "الرد على رسالة محددة"). */
  reply_to?: number;
  /** People called by name with @ (they get a notification). */
  mentions: number[];
  created_at: string;
  /** Images and files sent with the message. */
  files: Attachment[];
}

export interface MessageInput {
  body: string;
  reply_to?: number;
  mentions?: number[];
}
