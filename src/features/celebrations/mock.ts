// The demo backend for celebrations, with the rules the real server must keep (docs/backend.md, section 23). Only the
// demo build loads it.
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, nowIso, wait } from "@/mock/helpers";
import type { CelebrationsApi } from "./api";
import { canCelebrateTeams, CELEBRATION_KINDS, CELEBRATION_LIMITS, celebrationAudience } from "./rules";
import type { Celebration, StoredCelebration } from "./types";

function view(c: StoredCelebration): Celebration {
  const db = getDb();
  const team = db.teams.find((t) => t.id === c.team_id);
  const by = db.users.find((u) => u.id === c.by_id);
  return {
    id: c.id,
    team_id: c.team_id,
    team_name: team?.name ?? "",
    team_name_en: team?.name_en,
    kind: c.kind,
    ...(c.message ? { message: c.message } : {}),
    by_id: c.by_id,
    by_name: by?.name ?? "",
    by_name_en: by?.name_en,
    by_role: by?.role ?? "monitor",
    ...(by?.custom_role ? { by_custom_role: by.custom_role } : {}),
    created_at: c.created_at,
  };
}

export const celebrationsMock: CelebrationsApi = {
  async celebrate(input) {
    const actor = currentUser();
    if (!canCelebrateTeams(actor)) return fail(403, "FORBIDDEN", "الاحتفال بالفرق للمتابِعة والمدير التنفيذي.", "Celebrating teams is for the monitor and the CEO.");
    const db = getDb();
    if (!db.teams.some((t) => t.id === input.team_id)) invalid("team_id", "اختر فريقاً.", "Choose a team.");
    if (!CELEBRATION_KINDS.includes(input.kind)) invalid("kind", "اختر نوع الاحتفال.", "Choose the kind of celebration.");
    const message = input.message?.trim() ?? "";
    if (message.length > CELEBRATION_LIMITS.message) invalid("message", `الكلمات أطول من ${CELEBRATION_LIMITS.message} حرف.`, `At most ${CELEBRATION_LIMITS.message} characters.`);
    const to = celebrationAudience(input.team_id, db.users, actor.id).map((u) => u.id);
    if (!to.length) invalid("team_id", "لا أحد في هذا الفريق بعد.", "Nobody is in this team yet.");
    const list = (db.celebrations ??= []);
    const stored: StoredCelebration = {
      id: Math.max(0, ...list.map((c) => c.id)) + 1,
      team_id: input.team_id,
      kind: input.kind,
      ...(message ? { message } : {}),
      by_id: actor.id,
      created_at: nowIso(),
      to,
      seen: [],
    };
    list.push(stored);
    commit();
    return wait({ ...view(stored), sent_to: to.length });
  },

  async mine() {
    const me = currentUser();
    const since = Date.now() - CELEBRATION_LIMITS.showDays * 86_400_000;
    const list = (getDb().celebrations ?? []).filter((c) => c.to.includes(me.id) && !c.seen.includes(me.id) && new Date(c.created_at).getTime() >= since);
    return wait(list.map(view), 60);
  },

  async seen(id) {
    const me = currentUser();
    const c = getDb().celebrations?.find((x) => x.id === id);
    if (!c || !c.to.includes(me.id)) return fail(404, "NOT_FOUND", "لم يُعثر على الاحتفال.", "Celebration not found.");
    if (!c.seen.includes(me.id)) {
      c.seen.push(me.id);
      commit();
    }
    return wait(undefined, 30);
  },
};
