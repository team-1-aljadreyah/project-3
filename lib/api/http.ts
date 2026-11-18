// Every call to the real API: the paths, what is sent and what comes back.
// lib/api/mock.ts has the same calls on fake data, and `Api` keeps the two the same.
import { http } from "./axios";
import type {
  MoveResult,
  Project,
  ProjectSummary,
  Session,
  Sprint,
  Task,
  TaskComment,
  TaskEvent,
  TaskInput,
  TaskMove,
  TaskPatch,
  User,
} from "./types";

export interface Api {
  login(identifier: string, password: string): Promise<Session>;
  me(): Promise<User>;
  users(): Promise<User[]>;
  projects(): Promise<ProjectSummary[]>;
  project(id: number): Promise<Project>;
  tasks(projectId: number): Promise<Task[]>;
  sprints(projectId: number): Promise<Sprint[]>;

  task(id: number): Promise<Task>;
  createTask(projectId: number, input: TaskInput): Promise<Task>;
  updateTask(id: number, patch: TaskPatch): Promise<Task>;
  /** Change the status. A done status from someone who may not approve becomes an approval request. */
  moveTask(id: number, move: TaskMove): Promise<MoveResult>;
  /** Approve a completion request, or send it back with a note (`note` required to send back). */
  decideCompletion(id: number, decision: { approve: boolean; note?: string }): Promise<Task>;
  comments(taskId: number): Promise<TaskComment[]>;
  addComment(taskId: number, body: string): Promise<TaskComment>;
  history(taskId: number): Promise<TaskEvent[]>;
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

  task: (id) => data(http.get<Task>(`/tasks/${id}`)),
  createTask: (projectId, input) => data(http.post<Task>(`/projects/${projectId}/tasks`, input)),
  updateTask: (id, patch) => data(http.patch<Task>(`/tasks/${id}`, patch)),
  moveTask: (id, move) => data(http.post<MoveResult>(`/tasks/${id}/status`, move)),
  decideCompletion: (id, decision) => data(http.post<Task>(`/tasks/${id}/approval`, decision)),
  comments: (taskId) => data(http.get<TaskComment[]>(`/tasks/${taskId}/comments`)),
  addComment: (taskId, body) => data(http.post<TaskComment>(`/tasks/${taskId}/comments`, { body })),
  history: (taskId) => data(http.get<TaskEvent[]>(`/tasks/${taskId}/history`)),
};
