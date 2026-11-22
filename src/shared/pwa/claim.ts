// Several tabs of the app may notice the same new message. Only one may ring and show it: each alert has a key
// ("c:p-1:57", "n:42"), and the first tab to write it in the shared list below wins. The browser's Web Locks make the
// read-and-write one step across tabs (where they exist; else the list alone is nearly always enough).
// A tab in the background waits a moment first, so the tab the person is looking at goes first.

const KEY = "p3.alerted";
const KEEP_MS = 24 * 60 * 60 * 1000;

type Ledger = [key: string, at: number][];

function readLedger(): Ledger {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Ledger) : [];
  } catch {
    return [];
  }
}

/** Takes the keys nobody has taken yet; returns them. Pure: the ledger in, the new ledger and the winners out. */
export function takeKeys(ledger: Ledger, keys: string[], now: number): { ledger: Ledger; won: string[] } {
  const fresh = ledger.filter(([, at]) => now - at < KEEP_MS).slice(-300);
  const taken = new Set(fresh.map(([k]) => k));
  const won = [...new Set(keys)].filter((k) => !taken.has(k));
  return { ledger: [...fresh, ...won.map((k) => [k, now] as [string, number])], won };
}

function takeNow(keys: string[]) {
  const { ledger, won } = takeKeys(readLedger(), keys, Date.now());
  try {
    localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {}
  return won;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The keys this tab may alert for (the others were taken by another tab). */
export async function claimAlerts(keys: string[], background: boolean): Promise<string[]> {
  if (!keys.length) return [];
  if (background) await pause(1200);
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    try {
      return await navigator.locks.request("p3-alerts", () => takeNow(keys));
    } catch {}
  }
  return takeNow(keys);
}
