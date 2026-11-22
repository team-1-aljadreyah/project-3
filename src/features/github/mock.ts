// The demo backend for the GitHub link. The real server gets pull requests and commits from GitHub's webhooks; the demo
// keeps a few made-up ones (src/mock/seed.ts) and links them the same way: by the task's or bug's code in the text.
import { commit, getDb } from "@/mock/db";
import { currentUser, fail, invalid, projectFor, wait } from "@/mock/helpers";
import { featureIsOn, requireFeature } from "@/mock/site";
import { canManageProjectSetup } from "@/shared/lib/access";
import type { GithubApi } from "./api";
import { GITHUB_LIMITS, isRepoName, mentions, safeGithubUrl } from "./rules";

const settingsOf = (projectId: number) => getDb().github.find((g) => g.project_id === projectId) ?? { project_id: projectId, enabled: false, repos: [] };

export const githubMock: GithubApi = {
  async settings(projectId) {
    projectFor(currentUser(), projectId);
    return wait(settingsOf(projectId));
  },

  async saveSettings(projectId, input) {
    const user = currentUser();
    requireFeature(user, "github");
    const project = projectFor(user, projectId);
    if (!canManageProjectSetup(user, project)) return fail(403, "FORBIDDEN", "يضبط GitHub مدير القسم أو المدير التنفيذي.", "The project's department manager or the CEO sets up GitHub.");
    const repos = [...new Set(input.repos.map((r) => r.trim()).filter(Boolean))];
    if (repos.length > GITHUB_LIMITS.repos) invalid("repos", `${GITHUB_LIMITS.repos} مستودعات على الأكثر.`, `At most ${GITHUB_LIMITS.repos} repositories.`);
    const bad = repos.find((r) => !isRepoName(r));
    if (bad) invalid("repos", `«${bad}» ليس اسم مستودع (المالك/الاسم).`, `"${bad}" isn't a repository name (owner/name).`);
    if (input.enabled && !repos.length) invalid("repos", "أضف مستودعاً واحداً على الأقل.", "Add at least one repository.");
    const db = getDb();
    const saved = { project_id: projectId, enabled: input.enabled, repos };
    db.github = [...db.github.filter((g) => g.project_id !== projectId), saved];
    commit();
    return wait(saved);
  },

  async links(owner) {
    const user = currentUser();
    const db = getDb();
    const item = owner.type === "task" ? db.tasks.find((t) => t.id === owner.id) : db.bugs.find((b) => b.id === owner.id);
    if (!item) return fail(404, "NOT_FOUND", "لم يُعثر على المطلوب.", "Not found.");
    projectFor(user, item.project_id); // 404 for someone who can't see the project
    const s = settingsOf(item.project_id);
    // Switched off by the CEO: nothing is shown, as if the project had no link (the CEO still sees it).
    if (!s.enabled || (user.role !== "ceo" && !featureIsOn("github"))) return wait({ enabled: false, repos: [], items: [] });
    const items = db.github_items
      .filter((g) => s.repos.includes(g.repo) && mentions(g.title, item.code) && safeGithubUrl(g.url))
      .sort((a, b) => b.at.localeCompare(a.at));
    return wait({ enabled: true, repos: s.repos, items });
  },
};
