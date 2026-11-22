// The demo database: kept in this browser's localStorage, so changes survive a reload and every tab of the
// browser sees the same data (a change in one tab refreshes the others through shared/lib/live.ts).
// Bump DB_VERSION whenever the shape or the seed changes: old saved data is then replaced by a fresh seed.
import { ApiError } from "@/shared/api/errors";
import { currentLocale } from "@/shared/lib/boot";
import { dataChanged } from "@/shared/lib/live";
import { getToken } from "@/shared/lib/session";
import { seed, type MockDb } from "./seed";

const KEY = "p3.mock.db";
const DB_VERSION = 23;

let db: MockDb | null = null;
/** The data as last saved, to drop a change the read-only mode refuses. */
let lastSaved: string | null = null;

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
  lastSaved = JSON.stringify(db);
  return db;
}

/**
 * Read-only mode (the CEO's advanced settings): a change by anyone but the CEO is refused, and what the call already
 * changed in memory is dropped, so nothing of it stays.
 */
function refuseReadOnly() {
  const current = db;
  if (!current?.advanced?.read_only?.on) return;
  const token = getToken();
  const id = token?.startsWith("demo-") ? Number(token.slice(5)) : NaN;
  const user = current.users.find((u) => u.id === id);
  if (!user || user.role === "ceo") return;
  db = lastSaved ? (JSON.parse(lastSaved) as MockDb) : seed();
  const ar = currentLocale() === "ar";
  const note = ar ? current.advanced.read_only.message : current.advanced.read_only.message_en || current.advanced.read_only.message;
  throw new ApiError(
    423,
    `${ar ? "المنصة في وضع القراءة فقط الآن، فلم يُحفظ التغيير." : "The platform is read-only now, so the change was not saved."}${note?.trim() ? ` ${note.trim()}` : ""}`,
    undefined,
    "READ_ONLY",
  );
}

/**
 * Save after a change, and tell every open screen (this tab and the others). `own: true` marks a person's own
 * bookkeeping (signing in, reading notifications and chats, their notification choices), which read-only mode allows.
 */
export function commit(opts?: { own?: boolean }) {
  if (!opts?.own) refuseReadOnly();
  lastSaved = JSON.stringify(db);
  try {
    storage()?.setItem(KEY, `{"v":${DB_VERSION},"db":${lastSaved}}`);
  } catch {}
  dataChanged();
}

/** Start the demo again from the seed (the account menu, demo build only). */
export function resetDb() {
  db = seed();
  commit({ own: true });
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
  lastSaved = JSON.stringify(next);
}
