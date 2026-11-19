// Keys used in the browser storage, and the tiny script the root layout (src/app/layout.tsx) puts in <head>. It reads
// the same keys before the page paints, so the right language, direction and day/night mode show at once (no flash of
// the wrong theme). The script is built from the keys below, so the two can never disagree.

export const LOCALE_KEY = "p3.locale";
export const THEME_KEY = "p3.theme";

/** Runs in <head> before anything is drawn: sets <html lang dir> and the dark class from the saved choices. */
export const BOOT_SCRIPT = `(function () {
  try {
    var l = localStorage.getItem("${LOCALE_KEY}");
    if (l !== "en") l = "ar";
    var d = document.documentElement;
    d.lang = l;
    d.dir = l === "ar" ? "rtl" : "ltr";
    var t = localStorage.getItem("${THEME_KEY}");
    if (t === "dark" || (t === null && window.matchMedia("(prefers-color-scheme: dark)").matches)) d.classList.add("dark");
  } catch (e) {}
})();`;

/** The language outside React (for the API's Accept-Language and the fake backend's messages). */
export function currentLocale(): "ar" | "en" {
  try {
    return localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}
