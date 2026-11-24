// Celebrations (the client, 24 November 2026): the monitoring officer chooses a team and celebrates it; every active
// member sees it once. The same rules the real server must keep (docs/backend.md section 23).
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/errors";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { celebrationsMock } = await import("@/features/celebrations/mock");
const { canCelebrateTeams, celebrationAudience } = await import("@/features/celebrations/rules");
const { setDbForTests, getDb } = await import("@/mock/db");
const { seed } = await import("@/mock/seed");

// The demo people: 1 CEO, 3 Huda (monitor), 4 Mustafa (team 1's leader), 5 Sara, 6 Ali, 7 Zainab (team 1), 2 the PM.
const as = (id: number) => {
  const user = getDb().users.find((u) => u.id === id)!;
  store.set("p3.session", JSON.stringify({ token: `demo-${id}`, user }));
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store.clear();
  setDbForTests(seed());
});

describe("who celebrates", () => {
  it("the monitoring officer and the CEO; nobody else", () => {
    expect(canCelebrateTeams({ role: "monitor" })).toBe(true);
    expect(canCelebrateTeams({ role: "ceo" })).toBe(true);
    for (const role of ["pm", "lead", "employee", "admin"] as const) expect(canCelebrateTeams({ role })).toBe(false);
  });

  it("reaches the team's active members, never the sender", () => {
    const users = [
      { id: 1, active: true, team_id: 1 },
      { id: 2, active: false, team_id: 1 },
      { id: 3, active: true, team_id: 2 },
      { id: 4, active: true, team_id: 1 },
    ];
    expect(celebrationAudience(1, users, 4).map((u) => u.id)).toEqual([1]);
  });
});

describe("a team celebration", () => {
  it("is sent by the monitor to every member, shown once to each, with her words and name", async () => {
    as(3);
    const sent = await celebrationsMock.celebrate({ team_id: 1, kind: "big", message: "  أطلقتم النسخة الأولى!  " });
    expect(sent).toMatchObject({ kind: "big", team_name: "فريق التطوير", message: "أطلقتم النسخة الأولى!", by_name: "هدى ناصر", by_role: "monitor", sent_to: 4 });

    as(6);
    const [mine] = await celebrationsMock.mine();
    expect(mine).toMatchObject({ id: sent.id, kind: "big", message: "أطلقتم النسخة الأولى!" });
    await celebrationsMock.seen(sent.id);
    expect(await celebrationsMock.mine()).toEqual([]);

    // Another member still has it; someone outside the team never had it.
    as(5);
    expect(await celebrationsMock.mine()).toHaveLength(1);
    as(2);
    expect(await celebrationsMock.mine()).toEqual([]);
    expect((await fails(celebrationsMock.seen(sent.id)))?.status).toBe(404);
  });

  it("is refused to other jobs, without a team or kind, with too many words, and for a team with nobody in it", async () => {
    as(5);
    expect((await fails(celebrationsMock.celebrate({ team_id: 1, kind: "good" })))?.status).toBe(403);
    as(3);
    expect((await fails(celebrationsMock.celebrate({ team_id: 99, kind: "good" })))?.errors).toHaveProperty("team_id");
    expect((await fails(celebrationsMock.celebrate({ team_id: 1, kind: "huge" as never })))?.errors).toHaveProperty("kind");
    expect((await fails(celebrationsMock.celebrate({ team_id: 1, kind: "good", message: "x".repeat(201) })))?.errors).toHaveProperty("message");
    getDb().teams.push({ id: 2, name: "فريق فارغ" });
    expect((await fails(celebrationsMock.celebrate({ team_id: 2, kind: "good" })))?.errors).toHaveProperty("team_id");
  });

  it("is no longer shown after 7 days", async () => {
    as(3);
    const sent = await celebrationsMock.celebrate({ team_id: 1, kind: "good" });
    getDb().celebrations!.find((c) => c.id === sent.id)!.created_at = new Date(Date.now() - 8 * 86_400_000).toISOString();
    as(6);
    expect(await celebrationsMock.mine()).toEqual([]);
  });
});
