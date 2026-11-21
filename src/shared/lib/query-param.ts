// A tab or a filter kept in the page's address (?tab=people), so a link from anywhere (also from the same page) can
// open the page already on it, and the back button and a shared link keep it. Built on Next.js's useSearchParams, which
// follows every navigation and window.history.replaceState; the signed-in layout gives it the <Suspense> it needs.
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * One value from the address. `allowed` (optional) keeps it to known values: anything else reads as the fallback.
 * Setting it changes the address without a new history step (the fallback removes it, for a clean address).
 */
export function useQueryParam<T extends string = string>(key: string, fallback: T, allowed?: readonly T[]): [T, (value: T) => void] {
  const v = useSearchParams().get(key);
  const value = v === null || (allowed && !allowed.includes(v as T)) ? fallback : (v as T);
  const set = useCallback(
    (next: T) => {
      const url = new URL(window.location.href);
      if (next === fallback || next === "") url.searchParams.delete(key);
      else url.searchParams.set(key, next);
      window.history.replaceState(null, "", url);
    },
    [key, fallback],
  );
  return [value, set];
}
