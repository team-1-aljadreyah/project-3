import { USE_MOCK } from "../config";
import { httpApi, type Api } from "./http";

// Pages always use `api`. The .env switch decides if it is the fake or the real backend.
//
// The fake backend (the demo data and its rules) is loaded only the first time a page asks for something,
// so it is never part of the real site's first load, and its demo accounts never reach the real site.
let mock: Promise<Api> | null = null;
const loadMock = () => (mock ??= import("./mock").then((m) => m.mockApi));
const lazyMock = new Proxy({} as Api, {
  get: (_t, key: string) =>
    (...args: unknown[]) =>
      loadMock().then((m) => (m[key as keyof Api] as (...a: unknown[]) => Promise<unknown>)(...args)),
});

export const api: Api = USE_MOCK ? lazyMock : httpApi;

export { ApiError } from "./errors";
export type { Api } from "./http";
export type * from "./types";
