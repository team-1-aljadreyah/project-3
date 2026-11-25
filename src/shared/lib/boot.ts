// Keys used in the browser storage, and the tiny script the root layout (src/app/layout.tsx) puts in <head>. It reads
// the same keys before the page paints, so the right language, direction and day/night mode show at once (no flash of
// the wrong theme). The script is built from the keys below, so the two can never disagree.

export const LOCALE_KEY = "p3.locale";
export const THEME_KEY = "p3.theme";
/** The signed-in person (shared/lib/session.ts). */
export const SESSION_KEY = "p3.session";
/** Set for this browser tab once the sign-in page's intro ring has played (features/auth front-door.tsx). */
export const INTRO_KEY = "p3.intro";

/**
 * Runs in <head> before anything is drawn: sets <html lang dir> and the dark class from the saved choices.
 *
 * The sign-in page is already in the first HTML (in Arabic, for someone who is not signed in), so it shows before any
 * script has loaded. Two more things are decided here for it, before the first paint:
 * - `data-hold`: that first HTML would be wrong for this visit (English is chosen, or the person is already signed in
 *   and is about to be sent on), so it stays hidden until the app has drawn the right thing (app/providers.tsx lifts
 *   it). Those visits see what they saw before: an empty page for a moment, never the wrong one.
 * - `intro-play`: the intro ring plays on this visit (once per tab, never with "reduce motion" or in a background
 *   tab). It starts with the first paint, in CSS, while the scripts are still on their way.
 */
export const BOOT_SCRIPT = `(function () {
  try {
    var l = localStorage.getItem("${LOCALE_KEY}");
    if (l !== "en") l = "ar";
    var d = document.documentElement;
    d.lang = l;
    d.dir = l === "ar" ? "rtl" : "ltr";
    var t = localStorage.getItem("${THEME_KEY}");
    if (t === "dark" || (t === null && window.matchMedia("(prefers-color-scheme: dark)").matches)) d.classList.add("dark");
    var p = location.pathname;
    if (p === "/login" || p === "/login/") {
      if (l === "en" || sessionStorage.getItem("${SESSION_KEY}") || localStorage.getItem("${SESSION_KEY}")) d.setAttribute("data-hold", "");
      else if (!sessionStorage.getItem("${INTRO_KEY}") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && document.visibilityState === "visible") {
        sessionStorage.setItem("${INTRO_KEY}", "1");
        d.classList.add("intro-play");
      }
    }
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
