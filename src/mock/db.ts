// The demo database: kept in this browser's localStorage, so changes survive a reload and every tab of the
// browser sees the same data (a change in one tab refreshes the others through shared/lib/live.ts).
// Bump DB_VERSION whenever the shape or the seed changes: old saved data is then replaced by a fresh seed.
import { dataChanged } from "@/shared/lib/live";
import { seed, type MockDb } from "./seed";

const KEY = "p3.mock.db";
const DB_VERSION = 5;

let db: MockDb | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The data, loaded once (from the browser, or a fresh seed). */
export function getDb(): MockDb {
  if (db) return db;
  try {
    const saved = storage()?.getItem(KEY);
    const parsed = saved ? (JSON.parse(saved) as { v: number; db: MockDb }) : null;
    if (parsed?.v === DB_VERSION) db = parsed.db;
  } catch {}
  db ??= seed();
  return db;
}

/** Save after a change, and tell every open screen (this tab and the others). */
export function commit() {
  try {
    storage()?.setItem(KEY, JSON.stringify({ v: DB_VERSION, db }));
  } catch {}
  dataChanged();
}

/** Start the demo again from the seed (the account menu, demo build only). */
export function resetDb() {
  db = seed();
  commit();
}

/** Another tab saved: drop this tab's copy so the next read loads the new data. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) db = null;
  });
}

/** For tests: start from a given database. */
export function setDbForTests(next: MockDb) {
  db = next;
}
