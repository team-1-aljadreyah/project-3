// The demo backend for the chat, with the rules the real server must keep (docs/backend.md, section 11).
// Only the demo build loads it (see ./api.ts).
import { chatMembers } from "@/mock/chat";
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import { notify } from "@/mock/notify";
import type { User } from "@/shared/api/types";
import type { ChatApi } from "./api";
import { CHAT_LIMITS as L, canCreateGroupChat, canManageGroupChat, chatKey, mayJoinGroup, parseKey, canStartDirect, canWriteInDirect } from "./rules";
import type { ChatKey, Conversation, Message } from "./types";

/** The chat's members, if this person is one of them. Not a member answers like a chat that doesn't exist. */
function membersFor(user: User, key: ChatKey) {
  const members = chatMembers(key);
  if (!members || !members.includes(user.id)) return fail(404, "NOT_FOUND", "لم يُعثر على المحادثة.", "Chat not found.");
  return members;
}

/** A stored message with its files joined in. */
const withFiles = (m: Omit<Message, "files">): Message => ({
  ...m,
  files: getDb().attachments.filter((a) => a.owner_type === "message" && a.owner_id === m.id),
});

function conversation(key: ChatKey, userId: number): Conversation {
  const db = getDb();
  const { kind, id } = parseKey(key)!;
  const members = chatMembers(key)!;
  const messages = db.messages.filter((m) => m.chat === key);
  const lastRead = db.chat_reads.find((r) => r.chat === key && r.user_id === userId)?.last_id ?? 0;
  const last = messages.at(-1);
  let title = "";
  let title_en: string | undefined;
  let created_by: number | undefined;
  if (kind === "project") {
    const p = db.projects.find((x) => x.id === id)!;
    title = p.name;
    title_en = p.name_en;
  } else if (kind === "team") {
    const t = db.teams.find((x) => x.id === id)!;
    title = t.name;
    title_en = t.name_en;
  } else if (kind === "group") {
    const g = db.groups.find((x) => x.id === id)!;
    title = g.name;
    created_by = g.created_by;
  }
  return {
    key,
    kind,
    title,
    title_en,
    member_ids: members,
    created_by,
    last_message: last && withFiles(last),
    unread: messages.filter((m) => m.id > lastRead && m.author_id !== userId).length,
  };
}

export const chatMock: ChatApi = {
  async conversations() {
    const user = currentUser();
    const db = getDb();
    const keys = [
      ...db.projects.map((p) => chatKey("project", p.id)),
      ...db.teams.map((t) => chatKey("team", t.id)),
      ...db.directs.map((d) => chatKey("direct", d.id)),
      ...db.groups.map((g) => chatKey("group", g.id)),
    ].filter((k) => chatMembers(k)?.includes(user.id));
    const list = keys.map((k) => conversation(k, user.id));
    // The chat with the newest message first; chats with no message yet at the end.
    list.sort((a, b) => (b.last_message?.created_at ?? "").localeCompare(a.last_message?.created_at ?? ""));
    return wait(list);
  },

  async messages(key) {
    membersFor(currentUser(), key);
    return wait(getDb().messages.filter((m) => m.chat === key).map(withFiles));
  },

  async send(key, input) {
    const user = currentUser();
    const members = membersFor(user, key);
    // An employee answers the CEO in a private chat only once the CEO has written there (they send requests instead).
    if (key.startsWith("d-")) {
      const other = getDb().users.find((u) => u.id !== user.id && members.includes(u.id));
      const otherHasWritten = !!other && getDb().messages.some((m) => m.chat === key && m.author_id === other.id);
      if (other && !canWriteInDirect(user, other, otherHasWritten)) {
        return fail(403, "FORBIDDEN", "لا تُراسَل المديرة التنفيذية مباشرة: أرسل طلباً من صفحة «طلباتي».", "You don't message the CEO directly: send a request from the Requests page.");
      }
    }
    const body = input.body.trim();
    if (body.length > L.body) invalid("body", "الرسالة أطول من المسموح.", "The message is too long.");
    // An empty text is allowed only for a message that will carry a file (the page sends the file right after).
    const db = getDb();
    if (input.reply_to !== undefined && !db.messages.some((m) => m.id === input.reply_to && m.chat === key)) {
      invalid("reply_to", "الرسالة التي تردّ عليها ليست في هذه المحادثة.", "The message you answer isn't in this chat.");
    }
    // Only members can be mentioned: nobody outside the chat learns what was said in it.
    const mentions = [...new Set(input.mentions ?? [])].filter((id) => members.includes(id) && id !== user.id);
    const message = { id: ++db.seq.message, chat: key, author_id: user.id, body, reply_to: input.reply_to, mentions, created_at: nowIso() };
    db.messages.push(message);
    // The writer has read their own message.
    db.chat_reads = db.chat_reads.filter((r) => !(r.chat === key && r.user_id === user.id));
    db.chat_reads.push({ chat: key, user_id: user.id, last_id: message.id });
    // The brief: a person called by name gets a direct notification.
    notify(mentions, "chat_mention", { actor_id: user.id, chat_key: key, data: { note: body.slice(0, 120) } });
    commit();
    return wait(withFiles(message));
  },

  async markRead(key) {
    const user = currentUser();
    membersFor(user, key);
    const db = getDb();
    const lastId = db.messages.filter((m) => m.chat === key).at(-1)?.id ?? 0;
    const read = db.chat_reads.find((r) => r.chat === key && r.user_id === user.id);
    // Save only when something new was read, so opening a chat doesn't refresh every screen each time.
    if (!read || read.last_id < lastId) {
      db.chat_reads = db.chat_reads.filter((r) => r !== read);
      db.chat_reads.push({ chat: key, user_id: user.id, last_id: lastId });
      commit();
    }
    return wait(undefined);
  },

  async startDirect(userId) {
    const user = currentUser();
    const db = getDb();
    const other = db.users.find((u) => u.id === userId && u.active);
    if (!other || other.id === user.id) return invalid("user_id", "اختر زميلاً آخر.", "Choose another person.");
    if (!canStartDirect(user, other)) return fail(403, "FORBIDDEN", "لا تُراسَل المديرة التنفيذية مباشرة: أرسل طلباً من صفحة «طلباتي».", "You don't message the CEO directly: send a request from the Requests page.");
    // One private chat per pair of people: open the existing one if there is.
    let direct = db.directs.find((d) => d.member_ids.includes(user.id) && d.member_ids.includes(userId));
    if (!direct) {
      direct = { id: ++db.seq.direct, member_ids: [user.id, userId] };
      db.directs.push(direct);
      commit();
    }
    return wait(conversation(chatKey("direct", direct.id), user.id));
  },

  async createGroup(input) {
    const user = currentUser();
    if (!canCreateGroupChat(user)) fail(403, "FORBIDDEN", "لا يمكنك إنشاء مجموعة محادثة.", "You can't create a group chat.");
    const name = checkName(input.name);
    const others = checkPeople(input.member_ids, user.id);
    const db = getDb();
    const group = { id: ++db.seq.group, name, created_by: user.id, member_ids: [user.id, ...others], created_at: nowIso() };
    db.groups.push(group);
    commit();
    return wait(conversation(chatKey("group", group.id), user.id));
  },

  async updateGroup(key, change) {
    const user = currentUser();
    const group = groupFor(user, key);
    if (!canManageGroupChat(user, group)) fail(403, "FORBIDDEN", "لا يغيّر المجموعة إلا من يديرها.", "Only the person who manages the group can change it.");
    const name = change.name === undefined ? group.name : checkName(change.name);
    // The manager always stays in; the others are checked like a new group's.
    const others = change.member_ids === undefined ? undefined : checkPeople(change.member_ids, group.created_by);
    group.name = name;
    if (others) group.member_ids = [group.created_by, ...others];
    commit();
    return wait(conversation(key, user.id));
  },

  async leaveGroup(key) {
    const user = currentUser();
    const group = groupFor(user, key);
    const db = getDb();
    group.member_ids = group.member_ids.filter((id) => id !== user.id);
    // If the manager leaves, the next member manages the group, so it is never left with nobody to change it.
    if (group.created_by === user.id && group.member_ids.length) group.created_by = group.member_ids[0];
    db.chat_reads = db.chat_reads.filter((r) => !(r.chat === key && r.user_id === user.id));
    commit();
    return wait(undefined);
  },
};

/** A group this person is in. Another kind of chat, or a group they aren't in, answers like one that doesn't exist. */
function groupFor(user: User, key: ChatKey) {
  const parsed = parseKey(key);
  membersFor(user, key);
  const group = parsed?.kind === "group" ? getDb().groups.find((g) => g.id === parsed.id) : undefined;
  if (!group) return fail(404, "NOT_FOUND", "لم يُعثر على المجموعة.", "Group not found.");
  return group;
}

/** A group's name: required and short. */
function checkName(raw: string) {
  const name = (raw ?? "").trim();
  if (!name) invalid("name", "اكتب اسم المجموعة.", "Enter the group's name.");
  if (name.length > L.groupName) invalid("name", `الاسم أطول من ${L.groupName} حرفاً.`, `The name is longer than ${L.groupName} letters.`);
  return name;
}

/** The people picked for a group besides `owner`: active, not the system admin, and at least two of them. */
function checkPeople(ids: number[], owner: number) {
  const db = getDb();
  const others = [...new Set(ids ?? [])].filter((id) => id !== owner);
  if (others.some((id) => !db.users.some((u) => u.id === id && mayJoinGroup(u)))) {
    invalid("member_ids", "بعض من اخترتهم لا يمكن إضافتهم إلى مجموعة.", "Some of the people you picked can't be added to a group.");
  }
  if (others.length < L.groupOthers) invalid("member_ids", "اختر شخصين آخرين على الأقل.", "Pick at least two other people.");
  return others;
}
