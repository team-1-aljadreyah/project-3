// Company announcements. Pages call `announcementsApi`; the .env switch decides if it is the real server or the
// demo backend (./mock.ts). Both follow `AnnouncementsApi`.
import { http, lazyApi } from "@/shared/api";
import type { Announcement, AnnouncementInput, AnnouncementReads } from "./types";

export interface AnnouncementsApi {
  /** Every announcement, important ones first, then newest first. */
  announcements(): Promise<Announcement[]>;
  announcement(id: number): Promise<Announcement>;
  create(input: AnnouncementInput): Promise<Announcement>;
  remove(id: number): Promise<void>;
  /** The signed-in person has opened it. */
  markSeen(id: number): Promise<void>;
  reads(id: number): Promise<AnnouncementReads>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const announcementsHttp: AnnouncementsApi = {
  announcements: () => data(http.get<Announcement[]>("/announcements")),
  announcement: (id) => data(http.get<Announcement>(`/announcements/${id}`)),
  create: (input) => data(http.post<Announcement>("/announcements", input)),
  remove: (id) => data(http.delete<void>(`/announcements/${id}`)),
  markSeen: (id) => data(http.post<void>(`/announcements/${id}/seen`)),
  reads: (id) => data(http.get<AnnouncementReads>(`/announcements/${id}/reads`)),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const announcementsApi: AnnouncementsApi =
  import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.announcementsMock)) : announcementsHttp;
