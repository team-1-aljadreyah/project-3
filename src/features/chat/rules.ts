// The chat's small rules: keys, limits, and finding @mentions in a message. Pure functions, tested in Node.
import type { User } from "@/shared/api/types";
import type { ChatKey, ChatKind, Conversation } from "./types";

export const CHAT_LIMITS = { body: 4000 };

const PREFIX: Record<ChatKind, string> = { project: "p", team: "t", direct: "d" };

/** "p-3", "t-1", "d-7". */
export const chatKey = (kind: ChatKind, id: number): ChatKey => `${PREFIX[kind]}-${id}`;

/** The kind and id inside a key, or null for a key that isn't one. */
export function parseKey(key: ChatKey): { kind: ChatKind; id: number } | null {
  const m = /^([ptd])-(\d+)$/.exec(key);
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
