// The chat on the demo backend, as different people, plus its small rules: the same rules the real backend must keep.
import { beforeEach, describe, expect, it } from "vitest";
import { canCreateGroupChat, canManageGroupChat, chatKey, chatTitle, mentionQuery, parseKey, splitMentions } from "@/features/chat/rules";
import { ApiError } from "@/shared/api/errors";

// The demo backend reads the session from localStorage: a small in-memory one for Node.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { chatMock: api } = await import("@/features/chat/mock");
const { attachmentsMock } = await import("@/features/attachments/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees (team 1), 8 admin.
// Project 1: 2, 4, 5, 6, 7. Project 3: 2, 7. Private chat d-1: Ahmed (2) and Sara (5).
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("rules", () => {
  it("keys", () => {
    expect(chatKey("project", 3)).toBe("p-3");
    expect(parseKey("d-7")).toEqual({ kind: "direct", id: 7 });
    expect(parseKey("x-1")).toBeNull();
    expect(parseKey("p-1/../")).toBeNull();
  });

  it("finds the mention being typed", () => {
    expect(mentionQuery("مرحباً @سا", 10)).toBe("سا");
    expect(mentionQuery("@", 1)).toBe("");
    expect(mentionQuery("name@mail", 9)).toBeNull(); // an email isn't a mention
    expect(mentionQuery("@سارة\nثم", 8)).toBeNull();
    expect(mentionQuery("لا شيء", 6)).toBeNull();
  });

  it("splits a message around the mentioned names (the longest name first)", () => {
    expect(splitMentions("شكراً @سارة علي، تم", ["سارة", "سارة علي"])).toEqual(["شكراً ", { mention: "سارة علي" }, "، تم"]);
    expect(splitMentions("no mentions", [])).toEqual(["no mentions"]);
    expect(splitMentions("@a.b and @ab", ["a.b"])).toEqual([{ mention: "a.b" }, " and @ab"]);
  });

  it("a private chat is named after the other person", () => {
    const people = new Map(getDb().users.map((u) => [u.id, u]));
    const c = { key: "d-1", kind: "direct" as const, title: "", member_ids: [2, 5], unread: 0 };
    expect(chatTitle(c, people, 5, "ar")).toBe("أحمد كريم");
    expect(chatTitle(c, people, 2, "en")).toBe("Sara Ali");
  });
});

describe("who sees which chat", () => {
  it("Sara sees her project, her team and her private chat, with what she hasn't read", async () => {
    as(5);
    const list = await api.conversations();
    expect(list.map((c) => c.key).sort()).toEqual(["d-1", "p-1", "t-1"]);
    expect(Object.fromEntries(list.map((c) => [c.key, c.unread]))).toEqual({ "p-1": 2, "t-1": 0, "d-1": 1 });
    expect(list[0].key).toBe("p-1"); // the newest message first
  });

  it("someone outside a chat gets 404 for it, its messages and its files", async () => {
    as(8); // the system admin: in no project, no team and no group
    expect(await api.conversations()).toEqual([]);
    expect((await fails(api.messages("p-1")))?.status).toBe(404);
    expect((await fails(api.send("d-1", { body: "مرحباً" })))?.status).toBe(404);
    expect((await fails(attachmentsMock.list({ type: "message", id: 1 })))?.status).toBe(404);
    expect((await fails(api.messages("p-99")))?.status).toBe(404);
  });

  it("the monitoring officer follows every project and team chat, but not other people's private chats", async () => {
    as(3);
    const keys = (await api.conversations()).map((c) => c.key);
    const db = getDb();
    for (const p of db.projects) expect(keys).toContain(`p-${p.id}`);
    for (const t of db.teams) expect(keys).toContain(`t-${t.id}`);
    expect(keys).toContain("g-1"); // the group she made
    expect(keys).not.toContain("d-1");
    expect((await fails(api.messages("d-1")))?.status).toBe(404);
    // She can write in a project chat she isn't a member of, and see its files.
    expect(await api.send("p-3", { body: "متابعة: ما آخر موعد للتسليم؟" })).toMatchObject({ chat: "p-3", author_id: 3 });
    expect(await attachmentsMock.list({ type: "message", id: 1 })).toEqual([]);
  });

  it("a project chat follows the project's members", async () => {
    as(7);
    expect((await api.conversations()).map((c) => c.key)).toContain("p-3");
    as(5);
    expect((await fails(api.messages("p-3")))?.status).toBe(404);
  });
});

describe("writing", () => {
  it("sends, answers a message, and notifies only members who are mentioned", async () => {
    as(6);
    const before = getDb().seq.notification;
    const m = await api.send("p-1", { body: "  تم الإصلاح @سارة علي  ", reply_to: 6, mentions: [5, 8, 6] });
    expect(m).toMatchObject({ chat: "p-1", author_id: 6, body: "تم الإصلاح @سارة علي", reply_to: 6, mentions: [5], files: [] });
    const told = getDb().notifications.filter((n) => n.id > before);
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ user_id: 5, kind: "chat_mention", chat_key: "p-1", actor_id: 6 });
    // The writer has read their own message.
    expect((await api.conversations()).find((c) => c.key === "p-1")?.unread).toBe(0);
  });

  it("refuses an answer to a message from another chat, and a message that is too long", async () => {
    as(5);
    expect((await fails(api.send("p-1", { body: "x", reply_to: 4 })))?.errors).toHaveProperty("reply_to");
    expect((await fails(api.send("p-1", { body: "x".repeat(4001) })))?.errors).toHaveProperty("body");
  });

  it("opening a chat marks it as read", async () => {
    as(5);
    await api.markRead("p-1");
    expect((await api.conversations()).find((c) => c.key === "p-1")?.unread).toBe(0);
  });

  it("files sent in a chat: only the writer adds them, members see them, no task history is written", async () => {
    as(5);
    const m = await api.send("d-1", { body: "" });
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const histories = () => getDb().events.length + getDb().project_events.length + getDb().bug_events.length;
    const before = histories();
    await attachmentsMock.upload({ type: "message", id: m.id }, file);
    expect(histories()).toBe(before);
    as(2);
    expect((await fails(attachmentsMock.upload({ type: "message", id: m.id }, file)))?.status).toBe(403);
    const shown = (await api.messages("d-1")).at(-1)!;
    expect(shown.files.map((f) => f.name)).toEqual(["notes.txt"]);
  });
});

describe("private chats", () => {
  it("one private chat per pair: opening it again gives the same one", async () => {
    as(5);
    expect((await api.startDirect(2)).key).toBe("d-1");
    const c = await api.startDirect(7);
    expect(c).toMatchObject({ kind: "direct", member_ids: [5, 7], unread: 0 });
    as(7);
    expect((await api.startDirect(5)).key).toBe(c.key);
  });

  it("not with yourself", async () => {
    as(5);
    expect((await fails(api.startDirect(5)))?.errors).toHaveProperty("user_id");
  });
});

describe("group chats", () => {
  const user = (id: number) => getDb().users.find((u) => u.id === id)!;

  it("rules: the monitoring officer, PMs, team leaders and the CEO make groups; the maker and the CEO manage them", () => {
    expect([1, 2, 3, 4, 5, 8].map((id) => canCreateGroupChat(user(id)))).toEqual([true, true, true, true, false, false]);
    expect(canManageGroupChat(user(3), { created_by: 3 })).toBe(true);
    expect(canManageGroupChat(user(1), { created_by: 3 })).toBe(true);
    expect(canManageGroupChat(user(2), { created_by: 3 })).toBe(false);
    expect(parseKey("g-2")).toEqual({ kind: "group", id: 2 });
    expect(chatKey("group", 4)).toBe("g-4");
  });

  it("the demo group: made by Huda with the CEO, Ahmed and Mustafa; she hasn't read the CEO's last message", async () => {
    as(3);
    const g = (await api.conversations()).find((c) => c.key === "g-1")!;
    expect(g).toMatchObject({ kind: "group", title: "متابعة الإطلاق", created_by: 3, unread: 1 });
    expect(g.member_ids.sort()).toEqual([1, 2, 3, 4]);
    as(5);
    expect((await fails(api.messages("g-1")))?.status).toBe(404);
  });

  it("Huda makes a group: she is always in it, and its members see it and write in it", async () => {
    as(3);
    const g = await api.createGroup({ name: "  تقييم الربع الأخير  ", member_ids: [5, 7, 5, 3] });
    expect(g).toMatchObject({ kind: "group", title: "تقييم الربع الأخير", created_by: 3, unread: 0 });
    expect(g.member_ids).toEqual([3, 5, 7]);
    expect(g.key).toMatch(/^g-\d+$/);
    as(7);
    expect((await api.conversations()).map((c) => c.key)).toContain(g.key);
    expect(await api.send(g.key, { body: "جاهزة" })).toMatchObject({ chat: g.key, author_id: 7 });
    as(6);
    expect((await fails(api.messages(g.key)))?.status).toBe(404);
  });

  it("refuses an employee and the admin (403), a missing or long name and too few or wrong people (422)", async () => {
    as(5);
    expect((await fails(api.createGroup({ name: "مجموعتي", member_ids: [6, 7] })))?.status).toBe(403);
    as(8);
    expect((await fails(api.createGroup({ name: "مجموعتي", member_ids: [6, 7] })))?.status).toBe(403);
    as(4);
    expect((await fails(api.createGroup({ name: "   ", member_ids: [6, 7] })))?.errors).toHaveProperty("name");
    expect((await fails(api.createGroup({ name: "x".repeat(61), member_ids: [6, 7] })))?.errors).toHaveProperty("name");
    expect((await fails(api.createGroup({ name: "مجموعة", member_ids: [6, 4] })))?.errors).toHaveProperty("member_ids"); // only one other person
    expect((await fails(api.createGroup({ name: "مجموعة", member_ids: [6, 8] })))?.errors).toHaveProperty("member_ids"); // the admin
    expect((await fails(api.createGroup({ name: "مجموعة", member_ids: [6, 99] })))?.errors).toHaveProperty("member_ids"); // nobody
    expect(getDb().groups).toHaveLength(1);
  });

  it("renaming and changing members: the maker and the CEO only; the maker always stays in", async () => {
    as(2);
    expect((await fails(api.updateGroup("g-1", { name: "اسم آخر" })))?.status).toBe(403);
    as(3);
    const g = await api.updateGroup("g-1", { name: "متابعة الإطلاق النهائي", member_ids: [1, 4, 5] });
    expect(g).toMatchObject({ title: "متابعة الإطلاق النهائي" });
    expect(g.member_ids).toEqual([3, 1, 4, 5]);
    as(2); // Ahmed was taken out: he no longer sees it
    expect((await fails(api.messages("g-1")))?.status).toBe(404);
    as(1); // the CEO, a member, may change it too
    expect((await api.updateGroup("g-1", { name: "الإطلاق" })).title).toBe("الإطلاق");
    expect((await fails(api.updateGroup("g-1", { member_ids: [1] })))?.errors).toHaveProperty("member_ids");
    // A project chat is not a group.
    expect((await fails(api.updateGroup("p-1", { name: "x" })))?.status).toBe(404);
  });

  it("any member may leave; when the maker leaves, the next member manages the group", async () => {
    as(4);
    await api.leaveGroup("g-1");
    expect((await api.conversations()).map((c) => c.key)).not.toContain("g-1");
    expect((await fails(api.send("g-1", { body: "مرحباً" })))?.status).toBe(404);
    expect((await fails(api.leaveGroup("g-1")))?.status).toBe(404);
    as(3);
    await api.leaveGroup("g-1");
    as(1);
    const g = (await api.conversations()).find((c) => c.key === "g-1")!;
    expect(g.member_ids).toEqual([1, 2]);
    expect(g.created_by).toBe(1);
  });
});

describe("employees and the CEO", () => {
  it("only the monitoring officer opens a private chat with the CEO and writes freely there", async () => {
    as(3);
    const c = await api.startDirect(1);
    expect((await api.send(c.key, { body: "تقرير اليوم جاهز." })).body).toBe("تقرير اليوم جاهز.");
  });

  it("nobody else opens a private chat with the CEO; the CEO can, and then the other person may answer", async () => {
    for (const id of [2, 4, 8]) {
      as(id);
      expect((await fails(api.startDirect(1)))?.status, `job of ${id}`).toBe(403);
    }
    as(5);
    expect((await fails(api.startDirect(1)))?.status).toBe(403);
    as(1);
    const c = await api.startDirect(5);
    as(5);
    expect((await fails(api.send(c.key, { body: "مرحباً" })))?.status).toBe(403);
    as(1);
    await api.send(c.key, { body: "كيف سير العمل؟" });
    as(5);
    expect((await api.send(c.key, { body: "جيد، شكراً." })).body).toBe("جيد، شكراً.");
  });
});
