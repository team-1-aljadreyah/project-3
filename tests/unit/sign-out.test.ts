// Signing out ends the session in this browser at once, and tells the server in the background (POST /auth/logout,
// with the token that was used), so the token stops working there too. A server that fails changes nothing here.
import { beforeEach, describe, expect, it } from "vitest";

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
  it("forgets the token at once and tells the server which token to cancel", async () => {
    const told: string[] = [];
    onSignOut(async (token) => void told.push(token));
    signOut();
    expect(getToken()).toBeNull();
    expect(told).toEqual(["t-123"]);
  });

  it("a server that fails or never answers changes nothing", async () => {
    onSignOut(() => Promise.reject(new Error("offline")));
    signOut();
    expect(getToken()).toBeNull();
    setSession({ token: "t-456", user });
    onSignOut(() => new Promise(() => {}));
    signOut();
    expect(getToken()).toBeNull();
  });

  it("with nobody signed in, nothing is sent", () => {
    const told: string[] = [];
    onSignOut(async (token) => void told.push(token));
    store.clear();
    signOut();
    expect(told).toEqual([]);
  });
});
