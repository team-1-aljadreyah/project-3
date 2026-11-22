// The data shapes of the internal chat, shared by the real API, the demo backend and the pages.
import type { Attachment } from "@/features/attachments";

/**
 * The kinds of chat: one per project, one per team, private messages between two people (the brief), and group chats
 * that a person makes with a name and the people they pick (the client asked for these for the monitoring officer).
 */
export type ChatKind = "project" | "team" | "direct" | "group";

/**
 * A chat's key, safe in a web address: "p-3" (project 3), "t-1" (team 1), "d-7" (private chat 7), "g-2" (group 2).
 * Project and team chats exist by themselves; a private chat is made the first time someone writes; a group is made
 * by the person who creates it.
 */
export type ChatKey = string;

export interface Conversation {
  key: ChatKey;
  kind: ChatKind;
  /** The project's, team's or group's name; for a private chat, the other person's name (the page writes it). */
  title: string;
  title_en?: string;
  /** Who can read and write here (the brief: only the project's members, the team's members, or the two people). */
  member_ids: number[];
  /** A group only: the person who manages it (the one who made it, or the next member if they left). */
  created_by?: number;
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

/** A new group: its name and the other people in it (the creator is always added). */
export interface GroupInput {
  name: string;
  member_ids: number[];
}

/** A change to a group: a new name, and/or the new list of its members (its manager always stays in). */
export interface GroupChange {
  name?: string;
  member_ids?: number[];
}

/** Which messages to load: the newest `limit`, or the `limit` just older than message `before` (docs/backend.md, section 11). */
export interface MessagePage {
  before?: number;
  limit?: number;
}
