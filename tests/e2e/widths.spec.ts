import { expect, test, type Page } from "@playwright/test";

// 25 November 2026 ("make it responsive for all the devices"): every page, for the jobs that open it, at the smallest
// phone width (320 px: iPhone SE) and a small Android (360 px), in Arabic and English, never scrolls sideways.
// The full sweep found the admin overview's grids, the pill tabs of the inbox, a monitoring note's buttons and a long
// dropdown in English; these keep them fixed. One browser size is enough here (the widths are set by the test).
test.skip(({ isMobile }) => isMobile, "the widths are set by the test itself");
test.setTimeout(120_000);

const PAGES: Record<string, string[]> = {
  ceo: ["/dashboard", "/projects/1", "/bugs", "/chat", "/announcements", "/reports", "/performance", "/teams", "/teams/1", "/inbox", "/notifications", "/admin", "/admin/security", "/admin/health", "/audit", "/advanced"],
  monitor: ["/monitoring", "/monitoring/report", "/requests", "/trials", "/users", "/quick-actions"],
  pm: ["/my-tasks", "/projects/1/settings", "/projects/1/files", "/templates", "/performance/criteria"],
  admin: ["/admin", "/admin/structure", "/admin/import", "/audit"],
};

async function signIn(page: Page, role: string, lang: "ar" | "en") {
  await page.addInitScript((l) => {
    localStorage.setItem("p3.locale", l);
    localStorage.setItem("p3.welcome", String(Date.now()));
  }, lang);
  await page.goto("/login");
  await page.locator("#identifier").fill(`${role}@demo.test`);
  await page.locator("#password").fill("123456");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

for (const lang of ["ar", "en"] as const) {
  for (const [role, routes] of Object.entries(PAGES)) {
    test(`no page scrolls sideways at 320 and 360 px: ${role}, ${lang}`, async ({ page }) => {
      await signIn(page, role, lang);
      const wide: string[] = [];
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("main h1").first()).toBeVisible();
        for (const width of [320, 360]) {
          await page.setViewportSize({ width, height: 760 });
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (over > 0) wide.push(`${route} at ${width}px: ${over}px too wide`);
        }
        await page.setViewportSize({ width: 1280, height: 800 });
      }
      expect(wide).toEqual([]);
    });
  }
}

// 25 November 2026 (a screen recording from the live site: the monitor's dashboard slid sideways on a phone, and the
// card under the banner hid her name). Real names, teams and titles can be long words with no space; the demo's are
// short. Here every name and title gets a long word added, and the pages that list them must still fit 320 and 360 px.
const LONG_PAGES: Record<string, string[]> = {
  ceo: ["/dashboard", "/bugs", "/teams/1", "/performance/3", "/tasks/1", "/projects/1", "/announcements/1"],
  monitor: ["/dashboard", "/monitoring"],
};

async function makeNamesLong(page: Page) {
  // Before every page load, so the demo reads the long names when it starts (it writes its own copy back after a
  // change, which would undo an edit made while it runs). Adding the word twice is avoided.
  await page.addInitScript(() => {
    const raw = localStorage.getItem("p3.mock.db");
    if (!raw) return;
    const db = JSON.parse(raw);
    const AR = "المتابعةوالتقييمللمشاريعالكبيرة";
    const EN = "Supercalifragilisticexpialidocious";
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (!o || typeof o !== "object") return;
      const rec = o as Record<string, unknown>;
      for (const k of Object.keys(rec)) {
        const v = rec[k];
        if (typeof v === "string" && v && /^(name|title|name_en|title_en|code|body|description|note)$/.test(k)) {
          const add = /_en$|code/.test(k) ? EN : AR;
          if (!v.endsWith(add)) rec[k] = v + add;
        } else walk(v);
      }
    };
    walk(db);
    localStorage.setItem("p3.mock.db", JSON.stringify(db));
  });
}

for (const lang of ["ar", "en"] as const) {
  for (const [role, routes] of Object.entries(LONG_PAGES)) {
    test(`long names never push a page sideways: ${role}, ${lang}`, async ({ page }) => {
      await signIn(page, role, lang);
      await makeNamesLong(page);
      const wide: string[] = [];
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("main h1").first()).toBeVisible();
        // The long words really are on the page (the demo keeps its data in this browser).
        await expect(page.locator("main")).toContainText(/المتابعةوالتقييمللمشاريعالكبيرة|Supercalifragilistic/);
        for (const width of [320, 360]) {
          await page.setViewportSize({ width, height: 760 });
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (over > 0) wide.push(`${route} at ${width}px: ${over}px too wide`);
        }
        await page.setViewportSize({ width: 1280, height: 800 });
      }
      expect(wide).toEqual([]);
    });
  }
}

test("the monitor's banner grows with her greeting, so the card under it never hides the name or the clock", async ({ page }) => {
  await signIn(page, "monitor", "ar");
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/dashboard");
  const clock = page.locator("#dashboard-title").locator("xpath=..").locator("time");
  const card = page.locator("#dashboard-title").locator("xpath=../..").getByRole("link", { name: /التقارير/ });
  await expect(clock).toBeVisible();
  const clockBox = await clock.boundingBox();
  const cardBox = await card.locator("xpath=..").boundingBox();
  expect(clockBox && cardBox && clockBox.y + clockBox.height <= cardBox.y).toBe(true);
});
