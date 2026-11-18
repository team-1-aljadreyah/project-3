// Arabic first, English second. Texts are written next to each other in the code: tr("المهام", "Tasks"),
// so a screen can never miss a translation, and you read both while you work. Arabic text is Fusha.
import { useMemo, useSyncExternalStore } from "react";
import { LOCALE_KEY } from "./boot";
import { makeFmt, type Fmt, type Lang } from "./format";

export type { Fmt, Lang, Tr } from "./format";

const listeners = new Set<() => void>();

function readLang(): Lang {
  try {
    return localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(LOCALE_KEY, lang);
  } catch {}
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  listeners.forEach((l) => l());
}

/** Everything a screen needs to show text, numbers and dates in the chosen language. */
export function useFmt(): Fmt {
  const lang = useSyncExternalStore(subscribe, readLang, () => "ar" as Lang);
  return useMemo(() => makeFmt(lang), [lang]);
}

