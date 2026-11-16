// Every call to the real API: the paths, what is sent and what comes back.
// lib/api/mock.ts has the same calls on fake data, and `Api` keeps the two the same.
import { http } from "./axios";
import type { Project, ProjectSummary, Session, Sprint, Task, User } from "./types";

export interface Api {
  login(identifier: string, password: string): Promise<Session>;
  me(): Promise<User>;
  users(): Promise<User[]>;
  projects(): Promise<ProjectSummary[]>;
  project(id: number): Promise<Project>;
  tasks(projectId: number): Promise<Task[]>;
  sprints(projectId: number): Promise<Sprint[]>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const httpApi: Api = {
  login: (identifier, password) => data(http.post<Session>("/auth/login", { identifier, password })),
  me: () => data(http.get<User>("/me")),
  users: () => data(http.get<User[]>("/users")),
  projects: () => data(http.get<ProjectSummary[]>("/projects")),
  project: (id) => data(http.get<Project>(`/projects/${id}`)),
  tasks: (projectId) => data(http.get<Task[]>(`/projects/${projectId}/tasks`)),
  sprints: (projectId) => data(http.get<Sprint[]>(`/projects/${projectId}/sprints`)),
};
