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
