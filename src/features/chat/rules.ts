// The chat's small rules: keys, limits, who may make and manage group chats, and finding @mentions in a message.
// Pure functions, tested in Node.
import type { Role, User } from "@/shared/api/types";
import { isCeo } from "@/shared/lib/access";
import { matches } from "@/shared/lib/utils";
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
 * Start a private chat with someone. Only the monitoring officer talks to the CEO directly (the client, 22 November 2026:
 * "only the monitor can speak directly with the CEO in the chat"); everyone else sends a request (/requests), which
 * reaches the monitoring officer first. The CEO may start a chat with anyone, and that person may then answer.
 */
export const canStartDirect = (user: Pick<User, "role">, other: Pick<User, "role">) => isCeo(user) || !isCeo(other) || user.role === "monitor";

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

/** A web address in a message: what was written, and where it opens (always http or https). */
export interface MessageLink {
  link: string;
  href: string;
}

// "https://…", "http://…" or "www.…", up to a space, a quote or an angle bracket.
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"'«»]+/gi;

/**
 * Splits text into plain text and web addresses, so the addresses can be pressed: "انظر https://a.com/x." →
 * ["انظر ", {link: "https://a.com/x", href: "https://a.com/x"}, "."]. A full stop, comma or closing bracket at the end
 * belongs to the sentence, not to the address (unless the address opened that bracket); "www.a.com" opens as
 * "https://www.a.com". Only http and https are made into links, so nothing typed can run a script.
 */
export function splitLinks(text: string): (string | MessageLink)[] {
  const parts: (string | MessageLink)[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    let link = m[0];
    while (/[.,;:!?؟،؛)\]}]$/.test(link)) {
      const end = link.at(-1)!;
      const open = { ")": "(", "]": "[", "}": "{" }[end];
      if (open && link.split(open).length >= link.split(end).length) break; // "…/Go_(language)" keeps its bracket
      link = link.slice(0, -1);
    }
    if (!/[a-z0-9]/i.test(link.replace(/^(https?:\/\/|www\.)/i, ""))) continue;
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ link, href: /^www\./i.test(link) ? `https://${link}` : link });
    last = m.index! + link.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** A message that is only one to three emoji (no text): it is shown larger, like in other chat apps. */
export function onlyEmoji(body: string) {
  const t = body.replace(/\s/g, "");
  // Emoji parts only (skin tones and joiners included), with at least one picture: "12" or "#" alone are not emoji.
  if (!/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u{FE0F}|\u{200D})+$/u.test(t) || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t)) return false;
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t)].length <= 3;
}

/**
 * Whether a chat matches what is typed in the chat list's search box: its name in Arabic or English (a private chat's
 * name is the other person's), and for a group, the names of its members too. Arabic letter forms count as the same
 * ("احمد" finds "أحمد"), like the other searches of the site.
 */
export function chatMatches(c: Conversation, q: string, people: Map<number, User>, me: number) {
  if (!q.trim()) return true;
  const names = (ids: number[]) => ids.flatMap((id) => [people.get(id)?.name, people.get(id)?.name_en]);
  if (c.kind === "direct") return matches(q, ...names(c.member_ids.filter((id) => id !== me)));
  return matches(q, c.title, c.title_en, ...(c.kind === "group" ? names(c.member_ids) : []));
}

/** The name of a chat in the chosen language. A private chat is named after the other person. */
export function chatTitle(c: Conversation, people: Map<number, User>, me: number, lang: "ar" | "en") {
  if (c.kind === "direct") {
    const other = people.get(c.member_ids.find((id) => id !== me) ?? me);
    return other ? (lang === "en" && other.name_en ? other.name_en : other.name) : "-";
  }
  return lang === "en" && c.title_en ? c.title_en : c.title;
}
