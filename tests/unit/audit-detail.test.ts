// The audit log's detail panel: reading a device from a User-Agent, the before → after rows, the address filter, the
// copied text (pure functions); then the demo backend writing where each line came from, and GET /audit/:id with its
// permissions and context.
import { beforeEach, describe, expect, it } from "vitest";
import { buildDiff, detailText, deviceWords, fieldName, ipMatches, parseUserAgent, shortSession, valueWords } from "@/features/admin/audit-detail";
import type { AuditEntry } from "@/features/admin/types";
import { ApiError } from "@/shared/api/errors";
import { makeFmt } from "@/shared/lib/format";

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

const { adminMock: api } = await import("@/features/admin/mock");
const { authMock } = await import("@/features/auth/mock");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed, DEMO_PASSWORD, TEST_USER_AGENT, UNKNOWN_IP, demoIp } = await import("@/mock/seed");

const en = makeFmt("en").tr;
const ar = makeFmt("ar").tr;

const UA = {
  chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  firefoxUbuntu: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  samsungTablet: "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Safari/537.36",
  opera: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0",
  chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  curl: "curl/8.4.0",
};

describe("reading the device from a User-Agent", () => {
  it("names the browser (Edge, Opera and Samsung before Chrome; Chrome before Safari), its version and the system", () => {
    expect(parseUserAgent(UA.chromeWin)).toEqual({ browser: "Chrome", version: "131", os: "Windows", osVersion: undefined, kind: "computer" });
    expect(parseUserAgent(UA.edgeWin)).toMatchObject({ browser: "Edge", version: "130", os: "Windows" });
    expect(parseUserAgent(UA.opera)).toMatchObject({ browser: "Opera", os: "Windows" });
    expect(parseUserAgent(UA.safariMac)).toMatchObject({ browser: "Safari", version: "18.1", os: "macOS", kind: "computer" });
    expect(parseUserAgent(UA.firefoxUbuntu)).toMatchObject({ browser: "Firefox", version: "132", os: "Ubuntu", kind: "computer" });
    expect(parseUserAgent(UA.chromebook)).toMatchObject({ browser: "Chrome", os: "ChromeOS" });
  });

  it("tells phones and tablets apart, with the system's version", () => {
    expect(parseUserAgent(UA.safariIphone)).toMatchObject({ browser: "Safari", os: "iOS", osVersion: "18.1", kind: "phone" });
    expect(parseUserAgent(UA.chromeIphone)).toMatchObject({ browser: "Chrome", os: "iOS", osVersion: "17.5", kind: "phone" });
    expect(parseUserAgent(UA.chromeAndroid)).toMatchObject({ browser: "Chrome", os: "Android", osVersion: "14", kind: "phone" });
    expect(parseUserAgent(UA.ipad)).toMatchObject({ os: "iPadOS", kind: "tablet" });
    expect(parseUserAgent(UA.samsungTablet)).toMatchObject({ browser: "Samsung Internet", os: "Android", kind: "tablet" });
  });

  it("says it in plain words, and copes with tools, nonsense and nothing", () => {
    expect(deviceWords(parseUserAgent(UA.chromeWin), en)).toBe("Chrome 131 on Windows");
    expect(deviceWords(parseUserAgent(UA.chromeWin), en, false)).toBe("Chrome on Windows");
    expect(deviceWords(parseUserAgent(UA.safariIphone), ar, false)).toBe("Safari على iOS");
    expect(deviceWords(parseUserAgent(UA.curl), en)).toBe("curl 8.4.0");
    expect(parseUserAgent(UA.curl).kind).toBe("other");
    expect(deviceWords(parseUserAgent("???"), en)).toBe("Unknown device");
    expect(parseUserAgent(undefined)).toEqual({ kind: "other" });
    expect(parseUserAgent("")).toEqual({ kind: "other" });
  });
});

describe("the changes table (before → after)", () => {
  it("one row per field, unchanged fields left out, set and cleared values kept", () => {
    const rows = buildDiff([
      { field: "title", from: "مطورة", to: "مطورة أولى" },
      { field: "name", from: "سارة", to: "سارة" },
      { field: "team", to: "فريق التطوير" },
      { field: "phone", from: "0770" },
      { field: "email" },
    ]);
    expect(rows).toEqual([
      { field: "title", type: "value", from: "مطورة", to: "مطورة أولى" },
      { field: "team", type: "value", from: undefined, to: "فريق التطوير" },
      { field: "phone", type: "value", from: "0770", to: undefined },
    ]);
    expect(buildDiff(undefined)).toEqual([]);
  });

  it("lists on both sides become what was added (+) and removed (−); only the order changed stays a plain row", () => {
    const [row] = buildDiff([{ field: "items", from: "إنجاز المهام 30، الالتزام 30، الجودة 20، التعاون 20", to: "إنجاز المهام 25، الالتزام 25، الجودة 30، التعاون 20" }]);
    expect(row).toEqual({ field: "items", type: "list", added: ["إنجاز المهام 25", "الالتزام 25", "الجودة 30"], removed: ["إنجاز المهام 30", "الالتزام 30", "الجودة 20"] });
    expect(buildDiff([{ field: "members", from: "a, b", to: "a, b, c" }])[0]).toEqual({ field: "members", type: "list", added: ["c"], removed: [] });
    expect(buildDiff([{ field: "members", from: "a, b", to: "b, a" }])[0]).toMatchObject({ type: "value", from: "a, b", to: "b, a" });
  });

  it("human field names (the key when there is none) and values in words", () => {
    expect(fieldName("title", en)).toBe("Job title");
    expect(fieldName("lock_after", ar)).toBe("محاولات خاطئة قبل القفل");
    expect(fieldName("work.days", en)).toBe("work.days");
    expect(valueWords("role", "monitor", en)).toBe("Monitoring & evaluation");
    expect(valueWords("role", "pm", ar)).toBe("مدير القسم");
    expect(valueWords("moved_to", "backlog", en)).toBe("Backlog");
    expect(valueWords("title", "pm", en)).toBe("pm");
  });
});

describe("the address filter", () => {
  it("exact, or a prefix ending with '.', ':' or '*'; whole parts only otherwise", () => {
    expect(ipMatches("192.0.2.14", "192.0.2.14")).toBe(true);
    expect(ipMatches("192.0.2.14", "192.0.2.1")).toBe(false);
    expect(ipMatches("192.0.2.14", "192.0.2")).toBe(true);
    expect(ipMatches("192.0.2.14", "192.0.2.")).toBe(true);
    expect(ipMatches("192.0.2.14", "192.0.2.1*")).toBe(true);
    expect(ipMatches("198.51.100.24", "192.0.2.")).toBe(false);
    expect(ipMatches("2001:db8::1", "2001:db8:")).toBe(true);
    expect(ipMatches(undefined, "10.")).toBe(false);
    expect(ipMatches(undefined, " ")).toBe(true);
  });

  it("a session id shows short", () => {
    expect(shortSession("s_1a2b3c4d5e6f7a8b")).toBe("1a2b3c4d");
    expect(shortSession(undefined)).toBeUndefined();
  });
});

describe("Copy details", () => {
  it("puts every fact on its own line, with the changes in words", () => {
    const e: AuditEntry = {
      id: 7, actor_id: 8, action: "user_changed", target: { type: "user", id: 5, label: "سارة علي" }, at: "2026-11-20T07:30:15.000Z",
      changes: [{ field: "role", from: "employee", to: "lead" }], ip: "10.20.0.5", user_agent: UA.firefoxUbuntu, session_id: "s_abc", request_id: "req_1",
    };
    const text = detailText(e, { tr: en, who: "Hassan Raad <admin@demo.test>", action: "changed a user", when: "Friday", kind: "Account", device: "Firefox 132 on Ubuntu" });
    expect(text.split("\n")).toEqual(
      expect.arrayContaining([
        "Audit log #7",
        "Who: Hassan Raad <admin@demo.test>",
        "Subject: سارة علي (#5)",
        "When: Friday (2026-11-20T07:30:15.000Z)",
        "IP address: 10.20.0.5",
        "Device: Firefox 132 on Ubuntu",
        "Session: s_abc",
        "Request: req_1",
        "  Role: Employee → Team leader",
      ]),
    );
  });
});

// ── The demo backend ────────────────────────────────────────────────────────────────────────────────────────────────

const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("the demo backend records where each line came from", () => {
  it("every old line has an example address, a plain device and (with a person) a session", () => {
    const ranges = /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$|^10\./;
    for (const e of getDb().audit) {
      expect(e.ip).toMatch(ranges);
      expect(parseUserAgent(e.user_agent).browser).toBeTruthy();
      expect(e.request_id).toMatch(/^req_[0-9a-f]{12}$/);
      if (e.actor_id) expect(e.session_id).toMatch(/^s_[0-9a-f]{16}$/);
    }
    // The same on every fresh demo.
    expect(seed().audit.map((e) => e.session_id)).toEqual(getDb().audit.map((e) => e.session_id));
  });

  it("a new line gets the person's address, this browser's device (a fixed one in tests) and the session of their sign-in", async () => {
    const { token } = await authMock.login("admin@demo.test", DEMO_PASSWORD);
    expect(token).toBe("demo-8");
    as(8);
    const session = getDb().logins.find((l) => l.user_id === 8)?.session_id;
    expect(session).toMatch(/^s_[0-9a-f]{16}$/);
    await api.updateUser(5, { title: "مطورة أولى" });
    await api.saveSettings({ due_soon_days: 3, lock_after: 5, lock_minutes: 15 });
    const [a, b] = getDb().audit.slice(-2);
    expect(a).toMatchObject({ actor_id: 8, ip: demoIp(8), user_agent: TEST_USER_AGENT, session_id: session });
    expect(b.session_id).toBe(session);
    expect(a.request_id).not.toBe(b.request_id);
    // Signing in again starts a new session.
    await authMock.login("admin@demo.test", DEMO_PASSWORD);
    await api.saveSettings({ due_soon_days: 2, lock_after: 5, lock_minutes: 15 });
    expect(getDb().audit.at(-1)?.session_id).not.toBe(session);
  });

  it("a failed sign-in has no session; a known account's comes from its owner's address, an unknown email's from elsewhere", async () => {
    await fails(authMock.login("employee@demo.test", "wrong"));
    await fails(authMock.login("nobody@demo.test", "wrong"));
    const [known, unknown] = getDb().audit.slice(-2);
    expect(known).toMatchObject({ action: "login_failed", actor_id: undefined, session_id: undefined, ip: demoIp(5), user_agent: TEST_USER_AGENT });
    expect(unknown).toMatchObject({ action: "login_failed", ip: UNKNOWN_IP });
  });

  it("a long User-Agent is cut to 300 characters", async () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: `Mozilla/5.0 ${"x".repeat(400)}` }, configurable: true });
    try {
      as(8);
      await api.saveSettings({ due_soon_days: 4, lock_after: 5, lock_minutes: 15 });
      expect(getDb().audit.at(-1)?.user_agent).toHaveLength(300);
    } finally {
      if (real) Object.defineProperty(globalThis, "navigator", real);
    }
  });
});

describe("GET /audit (search, kind and address filters) and GET /audit/:id", () => {
  it("searches who, the subject and the changes; filters by kind and by address", async () => {
    as(1);
    const byName = await api.audit({ q: "Hassan" });
    expect(byName.length).toBeGreaterThan(0);
    expect(byName.every((e) => e.actor_id === 8)).toBe(true);
    expect((await api.audit({ q: "مختبِرة" })).some((e) => e.target.id === 7)).toBe(true);
    expect((await api.audit({ kind: "settings" })).every((e) => e.action === "settings_changed")).toBe(true);
    const office = await api.audit({ ip: "198.51.100." });
    expect(office.length).toBeGreaterThan(0);
    expect(office.every((e) => e.ip?.startsWith("198.51.100."))).toBe(true);
    expect(await api.audit({ ip: "203.0.113.9" })).toEqual([]);
  });

  it("one line with the same person's other lines that day and the subject's history; admin and CEO only (403), 404 when missing", async () => {
    as(1);
    // The admin wrote the team's English names on one day: five lines, one after another.
    const names = getDb().audit.filter((e) => e.action === "user_changed" && e.changes?.[0].field === "name_en" && e.target.id !== 2);
    const one = names[1];
    const d = await api.auditEntry(one.id);
    expect(d).toMatchObject({ id: one.id, actor_id: 8, ip: one.ip, user_agent: one.user_agent });
    expect(d.related_by_actor.map((e) => e.id)).toEqual(expect.arrayContaining(names.filter((e) => e.id !== one.id).map((e) => e.id)));
    expect(d.related_by_actor.every((e) => e.actor_id === 8 && e.id !== one.id && e.at.slice(0, 10) === one.at.slice(0, 10))).toBe(true);
    // Newest first.
    expect(d.related_by_actor.map((e) => e.at)).toEqual([...d.related_by_actor.map((e) => e.at)].sort().reverse());
    expect(d.related_by_target.length).toBeGreaterThan(0);
    expect(d.related_by_target.every((e) => e.target.type === "user" && e.target.id === one.target.id)).toBe(true);

    as(8);
    expect((await api.auditEntry(one.id)).id).toBe(one.id);
    expect((await fails(api.auditEntry(99999)))?.status).toBe(404);
    for (const id of [2, 3, 4, 5]) {
      as(id);
      expect((await fails(api.auditEntry(one.id)))?.status).toBe(403);
    }
  });

  it("a failed sign-in and the lock it led to are the same person's history", async () => {
    for (let i = 0; i < 5; i++) await fails(authMock.login("employee@demo.test", "wrong"));
    as(8);
    const locked = getDb().audit.at(-1)!;
    expect(locked.action).toBe("login_locked");
    const d = await api.auditEntry(locked.id);
    expect(d.related_by_actor).toEqual([]);
    expect(d.related_by_target.filter((e) => e.action === "login_failed")).toHaveLength(5);
  });
});
