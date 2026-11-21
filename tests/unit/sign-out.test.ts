// Signing out tells the server first (POST /auth/logout cancels the token), and never keeps anyone signed in: a server
// that fails or doesn't answer still ends the session in this browser.
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { onSignOut, signOut, setSession, getToken } = await import("@/shared/lib/session");
const user = { id: 5, name: "سارة", email: "s@x.test", role: "employee" as const, title: "", active: true };

beforeEach(() => {
  store.clear();
  setSession({ token: "t-123", user });
});

describe("signing out", () => {
  it("tells the server with the token still there, then forgets the token", async () => {
    const seen: (string | null)[] = [];
    onSignOut(async () => void seen.push(getToken()));
    await signOut();
    expect(seen).toEqual(["t-123"]);
    expect(getToken()).toBeNull();
  });

  it("still signs out when the server fails", async () => {
    onSignOut(() => Promise.reject(new Error("offline")));
    await signOut();
    expect(getToken()).toBeNull();
  });

  it("doesn't wait more than 3 seconds for a server that doesn't answer", async () => {
    vi.useFakeTimers();
    onSignOut(() => new Promise(() => {}));
    const done = signOut();
    await vi.advanceTimersByTimeAsync(3000);
    await done;
    expect(getToken()).toBeNull();
    vi.useRealTimers();
  });
});
