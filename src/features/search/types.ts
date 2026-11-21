// Quick search (Ctrl+K): one call that finds projects, tasks, bugs, announcements and people the person may see.

export type SearchKind = "project" | "task" | "bug" | "announcement" | "person";

export interface SearchHit {
  kind: SearchKind;
  id: number;
  /** The main line: a name or a title. */
  title: string;
  title_en?: string;
  /** A short code people say ("PRJ-1", "TSK-118", "BUG-3"), when it has one. */
  code?: string;
  /** A second line: the project of a task or bug, a person's job title. */
  context?: string;
  context_en?: string;
  /** For people: their job, so the page can tell whether their name opens their performance. */
  role?: import("@/shared/api/types").Role;
  team_id?: number;
}

export interface SearchResult {
  q: string;
  hits: SearchHit[];
}
