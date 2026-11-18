// Projects, their setup and their sprints. Pages call `projectsApi`; the .env switch decides if it is the real server
// (`projectsHttp`) or the demo backend (./mock.ts). Both follow `ProjectsApi`, so switching changes no page.
import { http, lazyApi } from "@/shared/api";
import type {
  PhaseInput,
  Project,
  ProjectEvent,
  ProjectInput,
  ProjectPatch,
  ProjectSummary,
  Sprint,
  SprintInput,
  StatusInput,
} from "./types";

export interface ProjectsApi {
  /** The projects this person may see, with their task counts. */
  projects(): Promise<ProjectSummary[]>;
  project(id: number): Promise<Project>;
  sprints(projectId: number): Promise<Sprint[]>;

  createProject(input: ProjectInput): Promise<Project>;
  updateProject(id: number, patch: ProjectPatch): Promise<Project>;
  /** Replace the project's status list (the base statuses always stay). */
  saveStatuses(id: number, statuses: StatusInput[]): Promise<Project>;
  /** Replace the project's phase list. */
  savePhases(id: number, phases: PhaseInput[]): Promise<Project>;
  createSprint(projectId: number, input: SprintInput): Promise<Sprint>;
  updateSprint(id: number, input: SprintInput): Promise<Sprint>;
  deleteSprint(id: number): Promise<void>;
  /** The project's history: who changed its setup, what and when. */
  history(projectId: number): Promise<ProjectEvent[]>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const projectsHttp: ProjectsApi = {
  projects: () => data(http.get<ProjectSummary[]>("/projects")),
  project: (id) => data(http.get<Project>(`/projects/${id}`)),
  sprints: (projectId) => data(http.get<Sprint[]>(`/projects/${projectId}/sprints`)),

  createProject: (input) => data(http.post<Project>("/projects", input)),
  updateProject: (id, patch) => data(http.patch<Project>(`/projects/${id}`, patch)),
  saveStatuses: (id, statuses) => data(http.put<Project>(`/projects/${id}/statuses`, { statuses })),
  savePhases: (id, phases) => data(http.put<Project>(`/projects/${id}/phases`, { phases })),
  createSprint: (projectId, input) => data(http.post<Sprint>(`/projects/${projectId}/sprints`, input)),
  updateSprint: (id, input) => data(http.patch<Sprint>(`/sprints/${id}`, input)),
  deleteSprint: (id) => data(http.delete<void>(`/sprints/${id}`)),
  history: (projectId) => data(http.get<ProjectEvent[]>(`/projects/${projectId}/history`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const projectsApi: ProjectsApi =
  import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.projectsMock)) : projectsHttp;
