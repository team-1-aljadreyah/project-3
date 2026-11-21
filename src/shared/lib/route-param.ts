// Reading an id from the address (/projects/5 → "5") so it works both on a Node server and as plain files.
//
// As plain files each page with an id is built once, for the id "_" (./route-shell.ts), and served for every id.
// Next.js then still says the id is "_" (useParams), but the address in the browser is the real one, so the id is
// read from the address instead. In the browser only (pages call it).
import { usePathname } from "next/navigation";
import { SHELL_ID } from "./route-shell";

/**
 * The part of the address right after `after`: useRouteParam("projects") is "5" on /projects/5/settings.
 * undefined when the address has no such part.
 */
export function useRouteParam(after: string): string | undefined {
  return paramAfter(usePathname() ?? "", after);
}

/** The same, for a given address (pure, tested). */
export function paramAfter(pathname: string, after: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const at = parts.indexOf(after);
  const value = at < 0 ? undefined : parts[at + 1];
  return value === undefined || value === SHELL_ID ? undefined : decodeURIComponent(value);
}
