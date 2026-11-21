// Quick search. Pages call `searchApi`; the .env switch decides if it is the real server or the demo backend
// (./mock.ts). Both follow `SearchApi` (docs/backend.md, "Quick search").
import { http, lazyApi } from "@/shared/api";
import type { SearchResult } from "./types";

export interface SearchApi {
  /** What matches `q` (at least 2 characters), only among what this person may see; at most 8 of each kind. */
  search(q: string): Promise<SearchResult>;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const searchHttp: SearchApi = {
  search: (q) => data(http.get<SearchResult>("/search", { params: { q } })),
};

// Written out in full on purpose (see shared/api/demo.ts): the real build drops the demo backend.
export const searchApi: SearchApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.searchMock)) : searchHttp;
