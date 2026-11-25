import { expect, test } from "@playwright/test";

test("the front door: the intro ring never blocks signing in, and the page shows the platform", async ({ page }) => {
  await page.goto("/login");
  // The ring may still be counting: the form works at once (the ring lets clicks through).
  await page.getByLabel("البريد الإلكتروني").fill("pm@demo.test");
  await page.getByLabel("كلمة المرور").fill("123456");
  await expect(page.getByRole("heading", { level: 1, name: /كل مشروع وكل مهمة/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "هكذا يمضي العمل" })).toBeAttached();
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
});

test("with reduce motion there is no intro, and the sprint meter still answers the drag", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.locator(".intro")).toHaveCount(0);
  const meter = page.getByLabel(/اليوم 6 من 10/);
  await meter.fill("10");
  await expect(page.getByText("اليوم 10 من 10")).toBeVisible();
  await expect(page.getByText("على الخطة.")).toBeVisible();
});

test("the threads of light drop in behind the page, and are simply there with reduce motion", async ({ page }) => {
  await page.goto("/login");
  // Drawn once behind the page, with a frosted picture of them for the glass cards.
  await expect(page.locator("canvas[data-drawn]")).toHaveCount(1);
  // The curtain that uncovers them slides down the page once the intro is over.
  const curtain = page.locator(".threads-curtain");
  await expect.poll(() => curtain.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42), { timeout: 8000 }).toBeGreaterThan(300);
  // Signing in is never covered: the form is on top and works.
  await expect(page.getByLabel("البريد الإلكتروني")).toBeEditable();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("canvas[data-drawn]")).toHaveCount(1);
  await expect(page.locator(".threads-curtain")).toBeHidden();
});

// 25 November 2026 (Lighthouse on phones: 53): the sign-in page is in the first HTML, so it shows before the scripts
// have loaded, and the intro ring starts with the first paint (CSS). The visits it would be wrong for are held back.
test("the sign-in page and its intro ring are in the first HTML", async ({ request }) => {
  const html = await (await request.get("/login")).text();
  expect(html).toContain("كل مشروع وكل مهمة");
  expect(html).toContain('id="identifier"');
  expect(html).toContain('class="intro"');

});

test("an English visitor gets the page in English, with no Arabic first and no warnings", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
  });
  await page.addInitScript(() => localStorage.setItem("p3.locale", "en"));
  // Until the app has drawn it in English, the Arabic first HTML is held back (never shown).
  await page.goto("/login", { waitUntil: "commit" });
  await page.waitForSelector("h1", { state: "attached" });
  const shownInArabic = await page.evaluate(() => !document.documentElement.hasAttribute("data-hold") && /كل مشروع/.test(document.querySelector("h1")?.textContent ?? ""));
  expect(shownInArabic).toBe(false);
  await expect(page.getByRole("heading", { level: 1, name: /Every project and task/ })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-hold", /.*/);
  expect(problems).toEqual([]);
});

test("someone already signed in goes straight on from the sign-in page, to where it was asked", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /أحمد كريم/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
  await page.goto("/login?next=%2Fmy-tasks");
  await expect(page).toHaveURL(/\/my-tasks$/);
  await expect(page.getByLabel("البريد الإلكتروني")).toHaveCount(0);
});
