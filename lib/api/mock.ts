// The fake backend: the same calls as http.ts, on the demo data, with the same rules the real server must keep
// (who sees which project, wrong password, stopped account). It is the living reference for the backend.
import { getToken } from "../auth";
import { currentLocale } from "../boot";
import { countTasks, plannedRatio } from "../tasks";
import { today } from "../utils";
import { ApiError } from "./errors";
import type { Api } from "./http";
import { DEMO_PASSWORD, seed, type MockDb } from "./mock/seed";
import type { Project, User } from "./types";

let db: MockDb | null = null;
const data = () => (db ??= seed());

/** A short wait, so loading states show in the demo like on a real network. */
const wait = <T>(value: T, ms = 150) => new Promise<T>((r) => setTimeout(() => r(structuredClone(value)), ms));

const msg = (ar: string, en: string) => (currentLocale() === "ar" ? ar : en);

function currentUser(): User {
  const token = getToken();
  const id = token?.startsWith("demo-") ? Number(token.slice(5)) : NaN;
  const user = data().users.find((u) => u.id === id && u.active);
  if (!user) throw new ApiError(401, msg("انتهت الجلسة، سجّل الدخول من جديد.", "Your session ended. Please sign in again."), undefined, "UNAUTHENTICATED");
  return user;
}

/** The brief: the CEO, M&E and the admin see every project; a PM the ones they run; others the ones they're in. */
export function canSeeProject(user: User, project: Project) {
  if (user.role === "ceo" || user.role === "monitor" || user.role === "admin") return true;
  if (user.role === "pm") return project.pm_id === user.id || project.member_ids.includes(user.id);
  return project.member_ids.includes(user.id);
}

function projectFor(user: User, id: number) {
  const project = data().projects.find((p) => p.id === id);
  // Not found and not allowed answer the same, so nobody learns which projects exist.
  if (!project || !canSeeProject(user, project)) {
    throw new ApiError(404, msg("لم يُعثر على المشروع.", "Project not found."), undefined, "NOT_FOUND");
  }
  return project;
}

export const mockApi: Api = {
  async login(identifier, password) {
    const id = identifier.trim().toLowerCase();
    const user = data().users.find((u) => u.email === id || u.phone === id);
    if (!user || password !== DEMO_PASSWORD) {
      throw new ApiError(422, msg("البريد أو كلمة المرور غير صحيحة.", "Wrong email or password."), undefined, "VALIDATION");
    }
    if (!user.active) throw new ApiError(403, msg("تم إيقاف هذا الحساب.", "This account is stopped."), undefined, "FORBIDDEN");
    return wait({ token: `demo-${user.id}`, user });
  },

  async me() {
    return wait(currentUser());
  },

  async users() {
    currentUser();
    return wait(data().users);
  },

  async projects() {
    const user = currentUser();
    const day = today();
    const list = data()
      .projects.filter((p) => canSeeProject(user, p))
      .map((p) => {
        const c = countTasks(p, data().tasks.filter((t) => t.project_id === p.id), day);
        return { ...p, tasks_total: c.total, tasks_done: c.done, tasks_late: c.late, tasks_blocked: c.blocked };
      });
    return wait(list);
  },

  async project(id) {
    return wait(projectFor(currentUser(), id));
  },

  async tasks(projectId) {
    projectFor(currentUser(), projectId);
    return wait(data().tasks.filter((t) => t.project_id === projectId));
  },

  async sprints(projectId) {
    projectFor(currentUser(), projectId);
    const day = today();
    return wait(data().sprints.filter((s) => s.project_id === projectId).map((s) => ({ ...s, planned_ratio: plannedRatio(s.start, s.end, day) })));
  },
};
