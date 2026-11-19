// The GitHub link. Pages call `githubApi`; the .env switch decides if it is the real server or the demo backend
// (./mock.ts). The browser never talks to GitHub and never holds a GitHub key: the server does.
import { http, lazyApi } from "@/shared/api";
import type { GithubLinks, GithubSettings } from "./types";

export interface GithubApi {
  settings(projectId: number): Promise<GithubSettings>;
  /** Turns GitHub on or off for a project and sets its repositories (the project's PM, the CEO). */
  saveSettings(projectId: number, input: { enabled: boolean; repos: string[] }): Promise<GithubSettings>;
  /** The pull requests and commits that mention this task's or bug's code. */
  links(owner: { type: "task" | "bug"; id: number }): Promise<GithubLinks>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const githubHttp: GithubApi = {
  settings: (projectId) => data(http.get<GithubSettings>(`/projects/${projectId}/github`)),
  saveSettings: (projectId, input) => data(http.put<GithubSettings>(`/projects/${projectId}/github`, input)),
  links: (owner) => data(http.get<GithubLinks>(`/${owner.type === "task" ? "tasks" : "bugs"}/${owner.id}/github`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const githubApi: GithubApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.githubMock)) : githubHttp;
