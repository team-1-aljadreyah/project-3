// The administration and the audit log. Pages call `adminApi`; the .env switch decides if it is the real server or
// the demo backend (./mock.ts). Both follow `AdminApi`.
import { http, lazyApi } from "@/shared/api";
import type { Team, User } from "@/shared/api/types";
import type { AdminUser, AuditEntry, AuditFilter, DataHealth, Settings, TeamInput, UserInput, UserPatch } from "./types";

export interface AdminApi {
  users(): Promise<AdminUser[]>;
  createUser(input: UserInput): Promise<User>;
  updateUser(id: number, patch: UserPatch): Promise<User>;
  teams(): Promise<Team[]>;
  createTeam(input: TeamInput): Promise<Team>;
  updateTeam(id: number, patch: TeamInput): Promise<Team>;
  settings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  health(): Promise<DataHealth>;
  /** The audit log, newest first (the admin and the CEO). */
  audit(filter: AuditFilter): Promise<AuditEntry[]>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const adminHttp: AdminApi = {
  users: () => data(http.get<AdminUser[]>("/admin/users")),
  createUser: (input) => data(http.post<User>("/admin/users", input)),
  updateUser: (id, patch) => data(http.patch<User>(`/admin/users/${id}`, patch)),
  teams: () => data(http.get<Team[]>("/teams")),
  createTeam: (input) => data(http.post<Team>("/admin/teams", input)),
  updateTeam: (id, patch) => data(http.patch<Team>(`/admin/teams/${id}`, patch)),
  settings: () => data(http.get<Settings>("/admin/settings")),
  saveSettings: (settings) => data(http.put<Settings>("/admin/settings", settings)),
  health: () => data(http.get<DataHealth>("/admin/health")),
  audit: (filter) => data(http.get<AuditEntry[]>("/audit", { params: filter })),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const adminApi: AdminApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.adminMock)) : adminHttp;
