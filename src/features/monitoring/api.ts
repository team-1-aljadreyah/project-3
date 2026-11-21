// Monitoring notes and the CEO's inbox. Pages call `monitoringApi`; the .env switch decides if it is the real server
// or the demo backend (./mock.ts). Both follow `MonitoringApi`.
import { http, lazyApi } from "@/shared/api";
import type { MonitorNote, NoteAnswer, NoteInput } from "./types";

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
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const monitoringHttp: MonitoringApi = {
  notes: () => data(http.get<MonitorNote[]>("/monitoring/notes")),
  create: (input) => data(http.post<MonitorNote>("/monitoring/notes", input)),
  send: (id) => data(http.post<MonitorNote>(`/monitoring/notes/${id}/send`, {})),
  inbox: () => data(http.get<MonitorNote[]>("/ceo/inbox")),
  answer: (id, answer) => data(http.post<MonitorNote>(`/ceo/inbox/${id}/answer`, answer)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const monitoringApi: MonitoringApi =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.monitoringMock)) : monitoringHttp;
