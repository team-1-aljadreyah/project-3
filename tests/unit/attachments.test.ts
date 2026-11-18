// File attachments on the demo backend, as different people: the same rules the real backend must keep.
import { beforeEach, describe, expect, it } from "vitest";
import { fileProblem, MAX_FILE_BYTES, sizeText } from "@/features/attachments/rules";
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

const { attachmentsMock: api } = await import("@/features/attachments/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 2 PM, 3 M&E, 4 team leader, 5–7 employees, 8 admin.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);
const task = (code: string) => ({ type: "task" as const, id: getDb().tasks.find((t) => t.code === code)!.id });
const file = (name: string, text = "نص تجريبي") => new File([text], name, { type: "text/plain" });

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("the file rules", () => {
  it("allows the listed types and sizes only; never SVG or HTML", () => {
    expect(fileProblem({ name: "خطة.PDF", size: 100 })).toBeNull();
    expect(fileProblem({ name: "logo.svg", size: 100 })).toBe("type");
    expect(fileProblem({ name: "page.html", size: 100 })).toBe("type");
    expect(fileProblem({ name: "no-extension", size: 100 })).toBe("type");
    expect(fileProblem({ name: "a.txt", size: 0 })).toBe("empty");
    expect(fileProblem({ name: "a.zip", size: MAX_FILE_BYTES + 1 })).toBe("size");
  });

  it("writes sizes short", () => {
    expect(sizeText(900, "en")).toBe("900 B");
    expect(sizeText(320 * 1024, "en")).toBe("320 KB");
    expect(sizeText(1.5 * 1024 * 1024, "en")).toBe("1.5 MB");
    expect(sizeText(10 * 1024 * 1024, "en")).toBe("10 MB");
  });
});

describe("reading", () => {
  it("members see a task's files; someone who can't see the project gets 404", async () => {
    as(5);
    expect((await api.list(task("TSK-118"))).map((a) => a.name)).toEqual(["متطلبات-شاشة-الدخول.txt"]);
    expect((await fails(api.list(task("TSK-201"))))?.status).toBe(404); // project 2: Sara isn't in it
  });
});

describe("adding", () => {
  it("a member attaches a file; it is in the list and the task's history", async () => {
    as(5);
    const a = await api.upload(task("TSK-109"), file("ملاحظات.txt"));
    expect(a).toMatchObject({ name: "ملاحظات.txt", mime: "text/plain", uploaded_by: 5 });
    expect(a.url.startsWith("data:text/plain;base64,")).toBe(true);
    const last = getDb().events.at(-1)!;
    expect(last).toMatchObject({ kind: "attachment_added", to: "ملاحظات.txt", actor_id: 5 });
  });

  it("refuses a type that isn't allowed, an empty file, and a file over the demo's 1 MB (422 on file)", async () => {
    as(5);
    expect((await fails(api.upload(task("TSK-109"), file("x.svg"))))?.errors).toHaveProperty("file");
    expect((await fails(api.upload(task("TSK-109"), file("x.txt", ""))))?.errors).toHaveProperty("file");
    expect((await fails(api.upload(task("TSK-109"), file("big.txt", "x".repeat(1024 * 1024 + 1)))))?.errors).toHaveProperty("file");
  });

  it("the system admin can't attach files to project work (403)", async () => {
    as(8);
    expect((await fails(api.upload(task("TSK-109"), file("a.txt"))))?.status).toBe(403);
  });
});

describe("removing", () => {
  it("the person who added it may remove it; another member may not; the PM may remove any", async () => {
    as(5);
    const mine = await api.upload(task("TSK-109"), file("a.txt"));
    as(6);
    expect((await fails(api.remove(mine.id)))?.status).toBe(403);
    as(5);
    await api.remove(mine.id);
    expect(getDb().events.at(-1)).toMatchObject({ kind: "attachment_removed", from: "a.txt" });
    as(2); // the PM removes a file someone else added
    const theirs = getDb().attachments[0];
    await api.remove(theirs.id);
    expect(getDb().attachments.some((a) => a.id === theirs.id)).toBe(false);
  });

  it("a project's file goes into the project's history", async () => {
    as(2);
    await api.upload({ type: "project", id: 1 }, file("محضر-اجتماع.txt"));
    expect(getDb().project_events.at(-1)).toMatchObject({ kind: "attachment_added", to: "محضر-اجتماع.txt" });
  });
});
