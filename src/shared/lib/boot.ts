// Keys used in the browser storage. index.html has a tiny script that reads the same keys before the page
// paints, so the right language, direction and day/night mode show at once (no flash of the wrong theme).
// If you rename a key, rename it in index.html too (tests/unit/helpers.test.ts checks they match).

export const LOCALE_KEY = "p3.locale";
export const THEME_KEY = "p3.theme";

/** The language outside React (for the API's Accept-Language and the fake backend's messages). */
export function currentLocale(): "ar" | "en" {
  try {
    return localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}
