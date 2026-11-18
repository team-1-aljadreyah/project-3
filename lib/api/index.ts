import { USE_MOCK } from "../config";
import { httpApi, type Api } from "./http";

// Pages always use `api`. The .env switch decides if it is the fake or the real backend.
//
// The fake backend (the demo data and its rules) is loaded only the first time a page asks for something.
// The check is written out in full (not USE_MOCK) on purpose: Next.js replaces it with "false" === "true" when
// building the real site, so the build drops the import and the demo data and accounts are not in its files at all.
let mock: Promise<Api> | null = null;
const loadMock = () =>
  (mock ??=
    process.env.NEXT_PUBLIC_USE_MOCK === "true"
      ? import("./mock").then((m) => m.mockApi)
      : Promise.reject(new Error("The demo backend is not in this build.")));
const lazyMock = new Proxy({} as Api, {
  get: (_t, key: string) =>
    (...args: unknown[]) =>
      loadMock().then((m) => (m[key as keyof Api] as (...a: unknown[]) => Promise<unknown>)(...args)),
});

export const api: Api = USE_MOCK ? lazyMock : httpApi;

/**
 * Starts the demo data again (the account menu, demo build only). Same written-out check as above: in a JSX
 * condition the build tool still kept the import and shipped the demo data in the real build (the no-demo check
 * caught it), so the import lives here.
 */
export const resetDemoData = () =>
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? import("./mock/db").then((m) => m.resetDb()) : Promise.resolve();

export { ApiError } from "./errors";
export type { Api } from "./http";
export type * from "./types";
