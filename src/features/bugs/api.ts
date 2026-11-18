// The bug tracker. Pages call `bugsApi`; the .env switch decides if it is the real server or the demo backend
// (./mock.ts). Both follow `BugsApi`.
import { http, lazyApi } from "@/shared/api";
import type { Bug, BugEvent, BugInput, BugPatch, BugStatus } from "./types";

export interface BugsApi {
  /** Every bug in the projects this person can see. */
  bugs(): Promise<Bug[]>;
  bug(id: number): Promise<Bug>;
  report(projectId: number, input: BugInput): Promise<Bug>;
  update(id: number, patch: BugPatch): Promise<Bug>;
  /** Move to another status. `note` is required to send it back ("reopened"). */
  move(id: number, status: BugStatus, note?: string): Promise<Bug>;
  history(id: number): Promise<BugEvent[]>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const bugsHttp: BugsApi = {
  bugs: () => data(http.get<Bug[]>("/bugs")),
  bug: (id) => data(http.get<Bug>(`/bugs/${id}`)),
  report: (projectId, input) => data(http.post<Bug>(`/projects/${projectId}/bugs`, input)),
  update: (id, patch) => data(http.patch<Bug>(`/bugs/${id}`, patch)),
  move: (id, status, note) => data(http.post<Bug>(`/bugs/${id}/status`, { status, note })),
  history: (id) => data(http.get<BugEvent[]>(`/bugs/${id}/history`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const bugsApi: BugsApi = import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.bugsMock)) : bugsHttp;
