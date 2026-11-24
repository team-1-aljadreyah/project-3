// The server's live updates (24 November 2026: the real-time part moves to a Go service with a WebSocket,
// docs/backend.md section 25). A fake WebSocket stands in for the server: what the site sends, what it does with each
// event, and how it comes back after a cut.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;
const win = new EventTarget();
const doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
Object.assign(globalThis, { window: win, document: doc });

class FakeSocket {
  static all: FakeSocket[] = [];
  sent: string[] = [];
  closedWith?: number;
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(text: string) {
    this.sent.push(text);
  }
  close(code: number) {
    this.closedWith = code;
  }
  // The server's side:
  accept() {
    this.onopen?.();
  }
  say(data: unknown) {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }
  drop(code = 1006) {
    this.onclose?.({ code });
  }
}
Object.assign(globalThis, { WebSocket: FakeSocket });

const { cleanSocketUrl, connectSocket, onSocketEvent, parseEvent, retryDelay } = await import("@/shared/lib/socket");
const { onDataChange } = await import("@/shared/lib/live");
const { getToken, setSession } = await import("@/shared/lib/session");

const URL = "wss://api.example.test/api/v1/ws";
const last = () => FakeSocket.all[FakeSocket.all.length - 1];
let stop: (() => void) | undefined;
let refreshes = 0;
let stopListening: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
  store.clear();
  refreshes = 0;
  stopListening = onDataChange(() => refreshes++);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  stopListening();
  vi.useRealTimers();
});

describe("the address", () => {
  it("is used only when it is a ws:// or wss:// address", () => {
    expect(cleanSocketUrl(" wss://api.example.test/api/v1/ws ")).toBe("wss://api.example.test/api/v1/ws");
    expect(cleanSocketUrl("ws://localhost:8080/ws")).toBe("ws://localhost:8080/ws");
    for (const bad of [undefined, "", "https://api.example.test/ws", "wss://", "api.example.test/ws"]) expect(cleanSocketUrl(bad)).toBe("");
  });
});

describe("the events", () => {
  it("knows the six kinds and ignores anything else", () => {
    expect(parseEvent('{"type":"chat_message","chat":"g-2","id":9}')).toEqual({ type: "chat_message", chat: "g-2", id: 9 });
    expect(parseEvent('{"type":"site_live"}')).toEqual({ type: "site_live" });
    for (const bad of ['{"type":"typing"}', "not json", "null", "[]", 42]) expect(parseEvent(bad)).toBeNull();
  });
});

describe("a signed-in tab", () => {
  it("sends the token as its first message, never in the address", () => {
    stop = connectSocket(URL, "tok-1");
    expect(last().url).toBe(URL);
    last().accept();
    expect(last().sent).toEqual([JSON.stringify({ type: "auth", token: "tok-1" })]);
  });

  it("refreshes the open screens on each event, and tells who listens which one", async () => {
    const heard: unknown[] = [];
    const stopHearing = onSocketEvent((e) => heard.push(e));
    stop = connectSocket(URL, "tok-1");
    last().accept();
    last().say({ type: "chat_message", chat: "g-2", id: 9031 });
    last().say({ type: "something_new" });
    await vi.advanceTimersByTimeAsync(100);
    expect(refreshes).toBe(1);
    expect(heard).toEqual([{ type: "chat_message", chat: "g-2", id: 9031 }]);
    stopHearing();
  });

  it("comes back after a cut, waiting longer each time, and reloads the screens once back", async () => {
    stop = connectSocket(URL, "tok-1");
    last().accept();
    last().drop();
    expect(FakeSocket.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1300);
    expect(FakeSocket.all).toHaveLength(2);
    last().drop(); // the server is still down
    await vi.advanceTimersByTimeAsync(1300);
    expect(FakeSocket.all).toHaveLength(2); // the second wait is about 2 s
    await vi.advanceTimersByTimeAsync(1300);
    expect(FakeSocket.all).toHaveLength(3);
    refreshes = 0;
    last().accept();
    await vi.advanceTimersByTimeAsync(100);
    expect(refreshes).toBe(1); // what changed meanwhile is loaded
  });

  it("tries again at once when the network comes back", () => {
    stop = connectSocket(URL, "tok-1");
    last().drop();
    window.dispatchEvent(new Event("online"));
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("signs out when the server closes with 4401, and does not try again", async () => {
    setSession({ token: "tok-1", user: { id: 5, name: "سارة", email: "s@x.test", role: "employee", title: "", active: true } });
    stop = connectSocket(URL, "tok-1");
    last().accept();
    last().drop(4401);
    expect(getToken()).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("closes for good on sign-out", async () => {
    stop = connectSocket(URL, "tok-1");
    last().accept();
    const socket = last();
    stop();
    stop = undefined;
    expect(socket.closedWith).toBe(1000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });
});

describe("the waits", () => {
  it("double from 1 s to at most 30 s, give or take a fifth", () => {
    const mid = () => 0.5;
    expect([0, 1, 2, 3, 4, 5, 9].map((a) => retryDelay(a, mid))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect(retryDelay(0, () => 0)).toBe(800);
    expect(retryDelay(0, () => 1)).toBe(1200);
  });
});
