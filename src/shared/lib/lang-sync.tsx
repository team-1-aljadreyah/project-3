import { useEffect } from "react";
import { useFmt } from "./i18n";

/** Keeps <html lang dir> in sync when the language changes. Draws nothing. */
export function LangSync() {
  const { lang } = useFmt();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  return null;
}
