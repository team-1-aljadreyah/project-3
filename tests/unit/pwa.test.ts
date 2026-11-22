import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { takeKeys } from "@/shared/pwa/claim";
import { iosCanAddToHome, isIos, isPhoneSize, workerAllowed, workerBuild } from "@/shared/pwa/detect";
import { keyBytes } from "@/shared/pwa/push";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1",
  iphoneInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0",
  ipadOs: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
};

describe("installing on iPhone and iPad", () => {
  it("knows an iPhone, and an iPad that says it is a Mac (it has a touch screen)", () => {
    expect(isIos(UA.iphoneSafari, 5)).toBe(true);
    expect(isIos(UA.ipadOs, 5)).toBe(true);
    expect(isIos(UA.ipadOs, 0)).toBe(false); // a real Mac
    expect(isIos(UA.android, 5)).toBe(false);
  });

  it("offers the how-to in Safari and the other iOS browsers, not inside an app like Instagram", () => {
    expect(iosCanAddToHome(UA.iphoneSafari, 5)).toBe(true);
    expect(iosCanAddToHome(UA.iphoneChrome, 5)).toBe(true);
    expect(iosCanAddToHome(UA.ipadOs, 5)).toBe(true);
    expect(iosCanAddToHome(UA.iphoneInstagram, 5)).toBe(false);
    expect(iosCanAddToHome(UA.android, 5)).toBe(false);
  });

  it("a phone is a touch screen with a short side under 600 px", () => {
    expect(isPhoneSize(true, 412, 915)).toBe(true);
    expect(isPhoneSize(true, 1024, 768)).toBe(false); // a tablet
    expect(isPhoneSize(false, 400, 800)).toBe(false); // a narrow computer window
  });
});

describe("the service worker's registration", () => {
  it("runs only on https or on this computer", () => {
    expect(workerAllowed("https:", "platform.example.com")).toBe(true);
    expect(workerAllowed("http:", "localhost")).toBe(true);
    expect(workerAllowed("http:", "127.0.0.1")).toBe(true);
    expect(workerAllowed("http:", "192.168.1.5")).toBe(false);
  });

  it("reads the build from the worker's address", () => {
    expect(workerBuild("https://x.test/sw.js?v=abc123")).toBe("abc123");
    expect(workerBuild("/sw.js")).toBeNull();
  });
});

/** The real public/sw.js, run with a stand-in for the worker's `self`: its cachePlan is what the browser uses. */
function loadWorker() {
  const context: Record<string, unknown> = {
    self: { location: { href: "https://app.test/sw.js?v=b1", origin: "https://app.test" }, addEventListener: () => {} },
    URL,
  };
  // A top-level const is not a property of the context: the line added at the end copies the cache name out.
  runInNewContext(`${readFileSync("public/sw.js", "utf8")}
globalThis.cacheName = CACHE;`, context);
  return context as { cachePlan: (req: object, origin: string) => string; cacheName: string };
}

describe("what the service worker keeps", () => {
  const { cachePlan, cacheName } = loadWorker();
  const origin = "https://app.test";
  const get = (url: string, more: object = {}) => cachePlan({ url, method: "GET", mode: "cors", hasAuth: false, hasRange: false, ...more }, origin);

  it("keeps the fingerprinted build files first from the cache", () => {
    expect(get("https://app.test/_next/static/chunks/app-1a2b.js")).toBe("static");
    expect(get("https://app.test/_next/static/media/readex.woff2")).toBe("static");
  });

  it("pages: the network first, then the saved copy and the offline page", () => {
    expect(get("https://app.test/projects/3", { mode: "navigate" })).toBe("page");
    expect(get("https://app.test/", { mode: "navigate" })).toBe("page");
  });

  it("the site's other files: the network first", () => {
    expect(get("https://app.test/manifest.webmanifest")).toBe("fresh");
    expect(get("https://app.test/projects/_/__next.projects.txt?_rsc=x1")).toBe("fresh");
  });

  it("never keeps the API, another address, a signed request, a change, or the worker itself", () => {
    expect(get("https://api.example.com/api/v1/projects")).toBe("skip");
    expect(get("https://app.test/api/v1/me")).toBe("skip");
    expect(get("https://app.test/backend/api/v1/chats")).toBe("skip");
    expect(get("https://app.test/projects", { hasAuth: true })).toBe("skip");
    expect(get("https://app.test/projects", { method: "POST" })).toBe("skip");
    expect(get("https://app.test/video.mp4", { hasRange: true })).toBe("skip");
    expect(get("https://app.test/sw.js")).toBe("skip");
  });

  it("names its cache after the build, so each deploy starts a fresh one", () => {
    expect(cacheName).toBe("p3-v1-b1");
  });
});

describe("one tab alerts", () => {
  it("the first tab takes a key; another tab then finds it taken", () => {
    const first = takeKeys([], ["c:p-1:7", "n:3"], 1000);
    expect(first.won).toEqual(["c:p-1:7", "n:3"]);
    const second = takeKeys(first.ledger, ["c:p-1:7", "n:4"], 1100);
    expect(second.won).toEqual(["n:4"]);
  });

  it("forgets keys after a day", () => {
    const old = takeKeys([], ["n:1"], 0);
    expect(takeKeys(old.ledger, ["n:1"], 25 * 60 * 60 * 1000).won).toEqual(["n:1"]);
  });
});

describe("push", () => {
  it("turns the backend's public key (base64url) into bytes", () => {
    expect([...keyBytes("AQID_w")]).toEqual([1, 2, 3, 255]);
  });
});
