// Tasks: the board's list, one task, changes, the status flow, comments and history. Pages call `tasksApi`; the .env
// switch decides if it is the real server (`tasksHttp`) or the demo backend (./mock.ts). Both follow `TasksApi`.
import { http, lazyApi } from "@/shared/api";
import type { MoveResult, Task, TaskComment, TaskEvent, TaskInput, TaskMove, TaskPatch } from "./types";

export interface TasksApi {
  /** Every task of a project (the board). */
  tasks(projectId: number): Promise<Task[]>;
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

export const tasksHttp: TasksApi = {
  tasks: (projectId) => data(http.get<Task[]>(`/projects/${projectId}/tasks`)),
  task: (id) => data(http.get<Task>(`/tasks/${id}`)),
  createTask: (projectId, input) => data(http.post<Task>(`/projects/${projectId}/tasks`, input)),
  updateTask: (id, patch) => data(http.patch<Task>(`/tasks/${id}`, patch)),
  moveTask: (id, move) => data(http.post<MoveResult>(`/tasks/${id}/status`, move)),
  decideCompletion: (id, decision) => data(http.post<Task>(`/tasks/${id}/approval`, decision)),
  comments: (taskId) => data(http.get<TaskComment[]>(`/tasks/${taskId}/comments`)),
  addComment: (taskId, body) => data(http.post<TaskComment>(`/tasks/${taskId}/comments`, { body })),
  history: (taskId) => data(http.get<TaskEvent[]>(`/tasks/${taskId}/history`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const tasksApi: TasksApi =
  import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.tasksMock)) : tasksHttp;
