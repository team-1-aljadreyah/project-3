// Helpers for the demo build: the fake backend (each feature's mock.ts) and the demo database (src/mock).
//
// IMPORTANT, so no demo data reaches the real site: the code that loads demo files must be written out in full
// where the import is:
//     import.meta.env.VITE_USE_MOCK === "true" ? import("./mock") : …
// Vite replaces import.meta.env.VITE_USE_MOCK with its value when it builds. In the real build that becomes
// "false" === "true", the build tool sees the branch can never run and drops the import, so the demo files are not
// in dist/ at all. Through a variable or a function argument it can't see that, and keeps them.
// `npm run check:no-demo` (and Jenkins) fails if a demo account is found in the real build.

/**
 * An API object that loads its real code only the first time a page calls it. Each feature's api.ts passes the
 * loader (with the written-out check above), so the demo backend doesn't slow down the first page.
 */
export function lazyApi<T extends object>(load: () => Promise<T>): T {
  let loaded: Promise<T> | null = null;
  return new Proxy({} as T, {
    get: (_target, key) =>
      (...args: unknown[]) =>
        (loaded ??= load()).then((api) => (api[key as keyof T] as (...a: unknown[]) => Promise<unknown>)(...args)),
  });
}

/** Starts the demo data again (the account menu, demo build only). */
export const resetDemoData = () =>
  import.meta.env.VITE_USE_MOCK === "true" ? import("@/mock/db").then((m) => m.resetDb()) : Promise.resolve();
