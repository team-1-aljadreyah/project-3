// The data shapes of company announcements, shared by the real API, the demo backend and the pages.

export interface Announcement {
  id: number;
  title: string;
  body: string;
  /** Pinned at the top of the list, and shown on the CEO dashboard (the brief: "important announcements"). */
  important: boolean;
  author_id: number;
  created_at: string;
  /** Has the signed-in person seen it? (worked out by the server for each person) */
  seen: boolean;
  /** How many people have seen it, out of how many it is for. */
  seen_count: number;
  audience_count: number;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  important: boolean;
}

/** Who has seen an announcement and who hasn't yet (the brief), for the people allowed to know. */
export interface AnnouncementReads {
  seen: { user_id: number; at: string }[];
  not_seen: number[];
}
