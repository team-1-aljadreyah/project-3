// Monitoring notes and the CEO's inbox. Pages call `monitoringApi`; the .env switch decides if it is the real server
// or the demo backend (./mock.ts). Both follow `MonitoringApi`.
import { http, lazyApi } from "@/shared/api";
import type { MonitorNote, NoteAbout, NoteAnswer, NoteInput, ReportFacts, ReportPeriod } from "./types";

export interface MonitoringApi {
  /** The notes this person may see, newest first (the writer: hers; the CEO: all). */
  notes(): Promise<MonitorNote[]>;
  create(input: NoteInput): Promise<MonitorNote>;
  /** Send a note to the CEO (again, if it was sent before: it comes back to "new"). */
  send(id: number): Promise<MonitorNote>;
  /** The CEO's inbox: every note sent to the CEO, the newest first. */
  inbox(): Promise<MonitorNote[]>;
  /** The CEO answers a note: a reply and/or "seen" / "done". */
  answer(id: number, answer: NoteAnswer): Promise<MonitorNote>;
  /** The monitoring officer sends a waiting request on to the CEO, with an optional note for the CEO. */
  forwardRequest(id: number, note?: string): Promise<MonitorNote>;
  /** The monitoring officer answers a waiting request herself; it does not go to the CEO. */
  answerRequest(id: number, reply: string): Promise<MonitorNote>;
  /** Send a note also to more people (its writer, or the CEO). */
  share(id: number, userIds: number[]): Promise<MonitorNote>;
  /** The notes the monitoring officer sent to me (newest first). */
  received(): Promise<MonitorNote[]>;
  /** I opened a note sent to me (its writer sees it). */
  markSeen(id: number): Promise<MonitorNote>;
  /** The report builder: the counted numbers about a team, a person or a project over a period. */
  reportFacts(about: { type: Exclude<NoteAbout["type"], "general">; id: number }, period: ReportPeriod): Promise<ReportFacts>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const monitoringHttp: MonitoringApi = {
  notes: () => data(http.get<MonitorNote[]>("/monitoring/notes")),
  create: (input) => data(http.post<MonitorNote>("/monitoring/notes", input)),
  send: (id) => data(http.post<MonitorNote>(`/monitoring/notes/${id}/send`, {})),
  inbox: () => data(http.get<MonitorNote[]>("/ceo/inbox")),
  answer: (id, answer) => data(http.post<MonitorNote>(`/ceo/inbox/${id}/answer`, answer)),
  forwardRequest: (id, note) => data(http.post<MonitorNote>(`/monitoring/requests/${id}/forward`, { note })),
  answerRequest: (id, reply) => data(http.post<MonitorNote>(`/monitoring/requests/${id}/answer`, { reply })),
  share: (id, userIds) => data(http.post<MonitorNote>(`/monitoring/notes/${id}/share`, { user_ids: userIds })),
  received: () => data(http.get<MonitorNote[]>("/monitoring/received")),
  markSeen: (id) => data(http.post<MonitorNote>(`/monitoring/notes/${id}/seen`, {})),
  reportFacts: (about, period) => data(http.get<ReportFacts>("/monitoring/report-facts", { params: { type: about.type, id: about.id, ...period } })),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const monitoringApi: MonitoringApi =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.monitoringMock)) : monitoringHttp;
