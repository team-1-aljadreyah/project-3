// Trial teams (the monitoring officer's only). Screens call `trialsApi`; the .env switch decides if it is the real server
// or the demo backend (./mock.ts). Both follow `TrialsApi` (docs/backend.md section 24). Sending one to the CEO uses
// the monitoring notes (a report sent to her inbox), so it needs no call of its own.
import { http, lazyApi } from "@/shared/api";
import type {
  TrialEntry,
  TrialEntryInput,
  TrialMember,
  TrialMemberInput,
  TrialMemberPatch,
  TrialTeam,
  TrialTeamDetail,
  TrialTeamInput,
  TrialTeamPatch,
  TrialTeamRow,
} from "./types";

export interface TrialsApi {
  teams(): Promise<TrialTeamRow[]>;
  team(id: number): Promise<TrialTeamDetail>;
  createTeam(input: TrialTeamInput): Promise<TrialTeam>;
  /** Change it, or end it (`status: "ended"`) and start it again. */
  updateTeam(id: number, patch: TrialTeamPatch): Promise<TrialTeam>;
  addMember(teamId: number, input: TrialMemberInput): Promise<TrialMember>;
  /** Change a member's details, or their decision. */
  updateMember(id: number, patch: TrialMemberPatch): Promise<TrialMember>;
  /** Remove a member added by mistake (with their ratings and notes). */
  removeMember(id: number): Promise<void>;
  /** A rating, a note, or both. */
  addEntry(memberId: number, input: TrialEntryInput): Promise<TrialEntry>;
  removeEntry(id: number): Promise<void>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const trialsHttp: TrialsApi = {
  teams: () => data(http.get<TrialTeamRow[]>("/trials")),
  team: (id) => data(http.get<TrialTeamDetail>(`/trials/${id}`)),
  createTeam: (input) => data(http.post<TrialTeam>("/trials", input)),
  updateTeam: (id, patch) => data(http.patch<TrialTeam>(`/trials/${id}`, patch)),
  addMember: (teamId, input) => data(http.post<TrialMember>(`/trials/${teamId}/members`, input)),
  updateMember: (id, patch) => data(http.patch<TrialMember>(`/trials/members/${id}`, patch)),
  removeMember: (id) => data(http.delete<void>(`/trials/members/${id}`)),
  addEntry: (memberId, input) => data(http.post<TrialEntry>(`/trials/members/${memberId}/entries`, input)),
  removeEntry: (id) => data(http.delete<void>(`/trials/entries/${id}`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const trialsApi: TrialsApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.trialsMock)) : trialsHttp;
