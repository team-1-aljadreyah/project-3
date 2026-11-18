// Keys used in the browser storage, and a tiny script that runs before the page paints,
// so the right language, direction and day/night mode show at once (no flash of the wrong theme).

export const LOCALE_KEY = "p3.locale";
export const THEME_KEY = "p3.theme";

export const bootScript = `(function(){try{
var l=localStorage.getItem("${LOCALE_KEY}");if(l!=="en")l="ar";
var d=document.documentElement;d.lang=l;d.dir=l==="ar"?"rtl":"ltr";
var t=localStorage.getItem("${THEME_KEY}");
if(t==="dark"||(t===null&&window.matchMedia("(prefers-color-scheme: dark)").matches))d.classList.add("dark");
}catch(e){}})();`;

/** The language outside React (for the API's Accept-Language and the fake backend's messages). */
export function currentLocale(): "ar" | "en" {
  try {
    return localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}
