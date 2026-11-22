// The administration and the audit log. Pages call `adminApi`; the .env switch decides if it is the real server or
// the demo backend (./mock.ts). Both follow `AdminApi`.
import { http, lazyApi } from "@/shared/api";
import type { Team, User } from "@/shared/api/types";
import type { AdminSession, AdminUser, AuditDetail, AuditEntry, AuditFilter, DataHealth, ImportResult, ImportRow, SecuritySummary, Settings, TeamInput, UserInput, UserPatch } from "./types";

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
  /** One line with its context (the same person that day, the same subject): the admin and the CEO; 404 when there is none. */
  auditEntry(id: number): Promise<AuditDetail>;
  /** Every active sign-in session, the last used first (the admin and the CEO). */
  sessions(): Promise<AdminSession[]>;
  /** End one session: its token stops working (409 for your own current session, 404 when it has ended). */
  endSession(id: string): Promise<void>;
  /** End every session of a person except the one making the request ("sign out everywhere"). */
  endUserSessions(userId: number): Promise<{ ended: number }>;
  /** End a sign-in lock now (409 when the account isn't locked). */
  unlockUser(userId: number): Promise<AdminUser>;
  /** Failed sign-ins of the last 7 days by account and by address, locked accounts, accounts never used. */
  securitySummary(): Promise<SecuritySummary>;
  /** Check accounts from a CSV (dry run), or create the valid ones; the others are skipped with their reasons. */
  importUsers(rows: ImportRow[], dryRun: boolean): Promise<ImportResult>;
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
  auditEntry: (id) => data(http.get<AuditDetail>(`/audit/${id}`)),
  sessions: () => data(http.get<AdminSession[]>("/admin/sessions")),
  endSession: (id) => data(http.delete<void>(`/admin/sessions/${encodeURIComponent(id)}`)),
  endUserSessions: (userId) => data(http.delete<{ ended: number }>(`/admin/users/${userId}/sessions`)),
  unlockUser: (userId) => data(http.post<AdminUser>(`/admin/users/${userId}/unlock`)),
  securitySummary: () => data(http.get<SecuritySummary>("/admin/security/summary")),
  importUsers: (rows, dryRun) => data(http.post<ImportResult>("/admin/users/import", { rows, dry_run: dryRun })),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const adminApi: AdminApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.adminMock)) : adminHttp;
