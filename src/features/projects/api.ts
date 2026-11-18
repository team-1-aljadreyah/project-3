// Projects and their sprints. Pages call `projectsApi`; the .env switch decides if it is the real server
// (`projectsHttp`) or the demo backend (./mock.ts). Both follow `ProjectsApi`, so switching changes no page.
import { http, lazyApi } from "@/shared/api";
import type { Project, ProjectSummary, Sprint } from "./types";

export interface ProjectsApi {
  /** The projects this person may see, with their task counts. */
  projects(): Promise<ProjectSummary[]>;
  project(id: number): Promise<Project>;
  sprints(projectId: number): Promise<Sprint[]>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const projectsHttp: ProjectsApi = {
  projects: () => data(http.get<ProjectSummary[]>("/projects")),
  project: (id) => data(http.get<Project>(`/projects/${id}`)),
  sprints: (projectId) => data(http.get<Sprint[]>(`/projects/${projectId}/sprints`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const projectsApi: ProjectsApi =
  import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.projectsMock)) : projectsHttp;
