// Celebrations: the monitoring officer celebrates a team; its members see it once. Screens call `celebrationsApi`; the
// .env switch decides if it is the real server or the demo backend (./mock.ts). Both follow `CelebrationsApi`
// (docs/backend.md section 23).
import { http, lazyApi } from "@/shared/api";
import type { Celebration, CelebrationInput, CelebrationSent } from "./types";

export interface CelebrationsApi {
  /** Celebrate a team (the monitoring officer and the CEO; 403 otherwise). */
  celebrate(input: CelebrationInput): Promise<CelebrationSent>;
  /** My celebrations not seen yet (from the last 7 days), oldest first. */
  mine(): Promise<Celebration[]>;
  /** I saw it: it is not shown again. */
  seen(id: number): Promise<void>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const celebrationsHttp: CelebrationsApi = {
  celebrate: (input) => data(http.post<CelebrationSent>("/celebrations", input)),
  mine: () => data(http.get<Celebration[]>("/me/celebrations")),
  seen: (id) => data(http.post<void>(`/celebrations/${id}/seen`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const celebrationsApi: CelebrationsApi =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.celebrationsMock)) : celebrationsHttp;
