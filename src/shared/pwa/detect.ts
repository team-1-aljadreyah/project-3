// Which device and window the site runs in, for the install offers. Pure functions of what the browser says (easy to
// test), and small wrappers that ask the browser.

/** An iPhone, iPod or iPad. iPadOS's Safari says "Macintosh", so a Mac that has a touch screen is an iPad. */
export function isIos(ua: string, maxTouchPoints: number) {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/** Apps that open links inside themselves (Facebook, Instagram…): they can't add a site to the home screen. */
const IN_APP = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|GSA\//i;

/**
 * Can this iPhone or iPad add the site to its home screen by hand (Share, then "Add to Home Screen")? Safari can, and
 * since iOS 16.4 Chrome, Edge and Firefox too. Apple's browsers never offer an install button by themselves.
 */
export function iosCanAddToHome(ua: string, maxTouchPoints: number) {
  return isIos(ua, maxTouchPoints) && !IN_APP.test(ua);
}

/** The installed app's own window (or iOS's home-screen app), not a browser tab. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || ["standalone", "fullscreen", "minimal-ui"].some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
}

/** A phone: a touch screen whose short side is under 600 px (tablets and computers are not). */
export function isPhoneSize(coarsePointer: boolean, screenWidth: number, screenHeight: number) {
  return coarsePointer && Math.min(screenWidth, screenHeight) < 600;
}

export function isPhone() {
  if (typeof window === "undefined") return false;
  return isPhoneSize(window.matchMedia("(pointer: coarse)").matches, screen.width, screen.height);
}

/** A service worker may run only on https, or on this computer while trying the built site. */
export function workerAllowed(protocol: string, hostname: string) {
  return protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

/** The build a worker was registered for ("/sw.js?v=abc" → "abc"). */
export const workerBuild = (scriptUrl: string) => new URL(scriptUrl, "http://x").searchParams.get("v");
