import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Joins CSS class names and lets later Tailwind classes win: cn("p-2", isBig && "p-4") -> "p-4"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** A day as YYYY-MM-DD in local time (today, or `offsetDays` from today). */
export function today(offsetDays = 0, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole days from `a` to `b` (both YYYY-MM-DD). Positive when `b` is later. */
export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000);
}

/** Simple search that ignores Arabic letter forms (أ إ آ ا, ة ه, ى ي), diacritics and case. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .trim();
}

export function matches(q: string, ...fields: (string | undefined | null)[]) {
  const n = normalize(q);
  if (!n) return true;
  return fields.some((f) => f && normalize(f).includes(n));
}

/** The first letter of a name, for avatars ("سارة أحمد" -> "س"). */
export function initialOf(name: string) {
  return name.trim().charAt(0) || "?";
}
