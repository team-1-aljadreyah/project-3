// The chat's small rules: keys, limits, who may make and manage group chats, and finding @mentions in a message.
// Pure functions, tested in Node.
import type { Role, User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import type { ChatKey, ChatKind, Conversation } from "./types";

/** `groupName`: the most letters in a group's name. `groupOthers`: the fewest people in a group besides its maker. */
export const CHAT_LIMITS = { body: 4000, groupName: 60, groupOthers: 2 };

const PREFIX: Record<ChatKind, string> = { project: "p", team: "t", direct: "d", group: "g" };

/** "p-3", "t-1", "d-7", "g-2". */
export const chatKey = (kind: ChatKind, id: number): ChatKey => `${PREFIX[kind]}-${id}`;

/** The jobs that may make group chats: the monitoring officer (the client asked for her), PMs and team leaders. */
const GROUP_MAKERS: Role[] = ["monitor", "pm", "lead"];

/** Who may make a group chat. */
/**
 * Start a private chat with someone. Nobody starts a private chat with the CEO (the client, 21 November 2026: "no one can
 * create a chat with him unless the CEO does it"): they send a request instead (/requests), answered in the CEO's inbox.
 * The CEO may start a chat with anyone.
 */
export const canStartDirect = (user: Pick<User, "role">, other: Pick<User, "role">) => isCeo(user) || !isCeo(other);

/** Write in a private chat: always, except with the CEO, where you may answer only once the CEO has written. */
export const canWriteInDirect = (user: Pick<User, "role">, other: Pick<User, "role">, otherHasWritten: boolean) => canStartDirect(user, other) || otherHasWritten;

export function canCreateGroupChat(user: Pick<User, "role">) {
  return isCeo(user) || GROUP_MAKERS.includes(user.role);
}

/** Who may rename a group and change its members: the person who manages it (its maker), and the CEO. */
export function canManageGroupChat(user: Pick<User, "id" | "role">, group: { created_by?: number }) {
  return isCeo(user) || group.created_by === user.id;
}

/** Who can be put in a group: any active person except the system admin (they manage accounts, not the work). */
export const mayJoinGroup =(u: Pick<User, "active" | "role">) => u.active && u.role !== "admin";

/** The kind and id inside a key, or null for a key that isn't one. */
export function parseKey(key: ChatKey): { kind: ChatKind; id: number } | null {
  const m = /^([ptdg])-(\d+)$/.exec(key);
  if (!m) return null;
  const kind = (Object.keys(PREFIX) as ChatKind[]).find((k) => PREFIX[k] === m[1])!;
  return { kind, id: Number(m[2]) };
}

/**
 * The text being typed after the last "@" before the cursor, if the person is writing a mention now:
 * "مرحباً @سا" → "سا". Used to show the list of people to choose from.
 */
export function mentionQuery(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]))) return null; // "@" must start a word
  const query = before.slice(at + 1);
  return /\n/.test(query) || query.length > 30 ? null : query;
}

/**
 * Splits a message into plain text and the names of the people it mentions, so the page can show the mentions in
 * colour: "شكراً @سارة علي" with Sara mentioned → ["شكراً ", {mention: "سارة علي"}].
 */
export function splitMentions(body: string, names: string[]): (string | { mention: string })[] {
  const sorted = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length); // the longest name first
  if (!sorted.length) return [body];
  const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts: (string | { mention: string })[] = [];
  let last = 0;
  for (const m of body.matchAll(new RegExp(`@(${escaped.join("|")})`, "g"))) {
    if (m.index! > last) parts.push(body.slice(last, m.index));
    parts.push({ mention: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

/** The name of a chat in the chosen language. A private chat is named after the other person. */
export function chatTitle(c: Conversation, people: Map<number, User>, me: number, lang: "ar" | "en") {
  if (c.kind === "direct") {
    const other = people.get(c.member_ids.find((id) => id !== me) ?? me);
    return other ? (lang === "en" && other.name_en ? other.name_en : other.name) : "-";
  }
  return lang === "en" && c.title_en ? c.title_en : c.title;
}
