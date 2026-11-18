// The demo backend for projects and sprints. Only the demo build loads it (see ./api.ts).
import { countTasks, plannedRatio } from "./counts";
import { getDb } from "@/mock/db";
import { currentUser, projectFor, wait } from "@/mock/helpers";
import { canSeeProject } from "@/shared/lib/access";
import { today } from "@/shared/lib/utils";
import type { ProjectsApi } from "./api";

export const projectsMock: ProjectsApi = {
  async projects() {
    const user = currentUser();
    const day = today();
    const db = getDb();
    const list = db.projects
      .filter((p) => canSeeProject(user, p))
      .map((p) => {
        const c = countTasks(p, db.tasks.filter((t) => t.project_id === p.id), day);
        return { ...p, tasks_total: c.total, tasks_done: c.done, tasks_late: c.late, tasks_blocked: c.blocked };
      });
    return wait(list);
  },

  async project(id) {
    return wait(projectFor(currentUser(), id));
  },

  async sprints(projectId) {
    projectFor(currentUser(), projectId);
    const day = today();
    return wait(getDb().sprints.filter((s) => s.project_id === projectId).map((s) => ({ ...s, planned_ratio: plannedRatio(s.start, s.end, day) })));
  },
};
