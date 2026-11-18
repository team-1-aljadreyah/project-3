// The chat on the demo backend, as different people, plus its small rules: the same rules the real backend must keep.
import { beforeEach, describe, expect, it } from "vitest";
import { chatKey, chatTitle, mentionQuery, parseKey, splitMentions } from "@/features/chat/rules";
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
    as(3); // M&E: in no project and no team
    expect(await api.conversations()).toEqual([]);
    expect((await fails(api.messages("p-1")))?.status).toBe(404);
    expect((await fails(api.send("d-1", { body: "مرحباً" })))?.status).toBe(404);
    expect((await fails(attachmentsMock.list({ type: "message", id: 1 })))?.status).toBe(404);
    expect((await fails(api.messages("p-99")))?.status).toBe(404);
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
    const m = await api.send("p-1", { body: "  تم الإصلاح @سارة علي  ", reply_to: 6, mentions: [5, 3, 6] });
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
