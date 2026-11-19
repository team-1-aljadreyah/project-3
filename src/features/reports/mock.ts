// The demo backend for the dashboard and the reports: the numbers come from ./compute.ts, over the projects the
// person may see (docs/backend.md, section 12). Only the demo build loads it.
import { getDb } from "@/mock/db";
import { currentUser, fail, wait } from "@/mock/helpers";
import { canSeeProject } from "@/shared/lib/access";
import { today } from "@/shared/lib/utils";
import type { ReportsApi } from "./api";
import { overview } from "./compute";
import { canSeeReports } from "./rules";

export const reportsMock: ReportsApi = {
  async overview() {
    const user = currentUser();
    if (!canSeeReports(user)) {
      return fail(403, "FORBIDDEN", "التقارير للإدارة ومديري المشاريع والمتابعة وقادة الفرق.", "Reports are for management, project managers, M&E and team leaders.");
    }
    const db = getDb();
    return wait(
      overview({
        projects: db.projects.filter((p) => canSeeProject(user, p)),
        tasks: db.tasks,
        users: db.users,
        teams: db.teams,
        bugs: db.bugs,
        sprints: db.sprints,
        today: today(),
      }),
    );
  },
};
