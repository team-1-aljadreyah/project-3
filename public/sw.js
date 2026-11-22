// The service worker: what makes the site an installable app that still opens without a connection, and that shows
// notifications. Plain JavaScript on purpose (no build step, no package): the browser loads this file as it is.
// src/shared/pwa/service-worker.tsx registers it as /sw.js?v=<build> in production builds, on https or localhost.
//
// What it keeps (docs/deploy-cloudflare.md):
// - /_next/static/*: the built scripts, styles and fonts. Their names carry a fingerprint, so a name never changes
//   content: cache first.
// - pages and the site's other files: the network first (always the newest), the saved copy when there is no
//   connection, and the offline page (/offline.html) for a page never opened before.
// - NEVER: the backend (another address, or any /api/ path), anything sent with an Authorization header, anything but
//   GET. So nobody's data is ever kept here: the pages are only the frame, drawn in the browser from the API.
//
// The cache's name is "p3-v<SHELL_VERSION>-<build>": every deploy has a new build, so a new worker with a fresh cache;
// the old caches are deleted when it takes over. Bump SHELL_VERSION when this file's rules change.
const SHELL_VERSION = 1;
const BUILD = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `p3-v${SHELL_VERSION}-${BUILD}`;
const OFFLINE = "/offline.html";
// Kept at install, so the app opens and the offline page shows even before any page was visited.
const SHELL = ["/", "/login", OFFLINE, "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];

/**
 * What to do with one request (a pure function: tests/unit/pwa.test.ts runs it from this file).
 * `req`: { url, method, mode, hasAuth, hasRange }; `origin`: the site's own origin.
 * "skip": leave it to the browser, never kept. "static": cache first. "page": a page, network first, then the saved
 * copy, then the offline page. "fresh": network first, then the saved copy.
 */
function cachePlan(req, origin) {
  if (req.method !== "GET" || req.hasAuth || req.hasRange) return "skip";
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return "skip";
  }
  // The backend lives on its own address (NEXT_PUBLIC_API_URL); other sites too.
  if (url.origin !== origin) return "skip";
  // Any API path, even on this address (a backend served under the same domain).
  if (/(^|\/)api(\/|$)/i.test(url.pathname)) return "skip";
  if (url.pathname === "/sw.js") return "skip";
  if (url.pathname.startsWith("/_next/static/")) return "static";
  if (req.mode === "navigate") return "page";
  return "fresh";
}

/** A copy without the "redirected" mark (a host may redirect /offline.html to /offline): a page can't use such a one. */
async function cleanCopy(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

const keepable = (res) => res && res.ok && res.type === "basic";

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    SHELL.map(async (path) => {
      try {
        const res = await cleanCopy(await fetch(path, { cache: "no-cache" }));
        if (!keepable(res)) return;
        await cache.put(path, res.clone());
        // A page: also keep the scripts and styles it loads, so it opens offline right after the install.
        if (/text\/html/.test(res.headers.get("content-type") || "")) {
          const assets = new Set((await res.text()).match(/\/_next\/static\/[^"'\s\\)]+/g) || []);
          await Promise.all([...assets].map((a) => cache.add(a).catch(() => {})));
        }
      } catch {}
    }),
  );
}

self.addEventListener("install", (event) => {
  // No skipWaiting here: an update waits until the person presses "Reload" (the app asks; see "message" below).
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("p3-") && name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirst(request) {
  const saved = await caches.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (keepable(res)) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
  }
  return res;
}

async function networkFirst(request, isPage) {
  try {
    const res = await fetch(request);
    if (keepable(res)) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
    }
    return res;
  } catch (error) {
    const saved = (await caches.match(request)) || (isPage && (await caches.match(request, { ignoreSearch: true })));
    if (saved) return saved;
    if (isPage) {
      const offline = await caches.match(OFFLINE);
      if (offline) return offline;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const r = event.request;
  const plan = cachePlan(
    { url: r.url, method: r.method, mode: r.mode, hasAuth: r.headers.has("authorization"), hasRange: r.headers.has("range") },
    self.location.origin,
  );
  if (plan === "skip") return;
  event.respondWith(plan === "static" ? cacheFirst(r) : networkFirst(r, plan === "page"));
});

// Push from the server (Web Push, when the backend sends it: docs/backend.md, "Push notifications"). The payload is
// JSON: { title, body, url, tag?, icon?, lang?, dir? }. The same `tag` as the open app uses ("chat-p-3", "n-42"), so
// a message the open app already showed is replaced, not shown twice.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "منصة المشاريع", {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      renotify: !!data.tag,
      lang: data.lang || "ar",
      dir: data.dir || "auto",
      data: { url: data.url || "/notifications" },
    }),
  );
});

// A click on a notification (from the open app or from push): bring the app forward on the right page, or open it.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  const path = target.pathname + target.search + target.hash;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const mine = windows.filter((c) => new URL(c.url).origin === self.location.origin);
      const client = mine.find((c) => c.focused) || mine.find((c) => c.visibilityState === "visible") || mine[0];
      if (client) {
        await client.focus();
        // The app moves to the page itself (no reload): src/shared/pwa/service-worker.tsx listens.
        client.postMessage({ type: "open", url: path });
        return;
      }
      await self.clients.openWindow(path);
    })(),
  );
});
