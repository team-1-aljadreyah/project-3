// The demo backend for quick search, with the rules the real server must keep: only what the person may see (the
// projects they may see, those projects' tasks and bugs, the announcements, the active people). Only the demo build
// loads it.
import { getDb } from "@/mock/db";
import { currentUser, invalid, wait } from "@/mock/helpers";
import { canSeeProject } from "@/shared/lib/access";
import { matches } from "@/shared/lib/utils";
import type { SearchApi } from "./api";
import type { SearchHit } from "./types";

const EACH = 8;

export const searchMock: SearchApi = {
  async search(raw) {
    const user = currentUser();
    const q = (raw ?? "").trim();
    if (q.length < 2) invalid("q", "اكتب حرفين على الأقل.", "Type at least two letters.");
    if (q.length > 80) invalid("q", "البحث أطول من المسموح.", "The search is too long.");
    const db = getDb();
    const projects = db.projects.filter((p) => canSeeProject(user, p));
    const projectOf = new Map(projects.map((p) => [p.id, p]));
    const hits: SearchHit[] = [
      ...projects
        .filter((p) => matches(q, p.name, p.name_en, p.code))
        .slice(0, EACH)
        .map((p) => ({ kind: "project" as const, id: p.id, title: p.name, title_en: p.name_en, code: p.code })),
      ...db.tasks
        .filter((t) => projectOf.has(t.project_id) && matches(q, t.title, t.code))
        .slice(0, EACH)
        .map((t) => ({ kind: "task" as const, id: t.id, title: t.title, code: t.code, context: projectOf.get(t.project_id)!.name, context_en: projectOf.get(t.project_id)!.name_en })),
      ...db.bugs
        .filter((b) => projectOf.has(b.project_id) && matches(q, b.title, b.code))
        .slice(0, EACH)
        .map((b) => ({ kind: "bug" as const, id: b.id, title: b.title, code: b.code, context: projectOf.get(b.project_id)!.name, context_en: projectOf.get(b.project_id)!.name_en })),
      ...db.announcements
        .filter((a) => matches(q, a.title, a.body))
        .slice(0, EACH)
        .map((a) => ({ kind: "announcement" as const, id: a.id, title: a.title })),
      ...db.users
        .filter((u) => u.active && matches(q, u.name, u.name_en, u.email, u.title))
        .slice(0, EACH)
        .map((u) => ({ kind: "person" as const, id: u.id, title: u.name, title_en: u.name_en, context: u.title, role: u.role, team_id: u.team_id })),
    ];
    return wait({ q, hits }, 80);
  },
};
