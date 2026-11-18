import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("pages that are not built yet are greyed out, never broken links", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  const nav = page.getByRole("navigation", { name: "القائمة الرئيسية" });
  await expect(nav.getByRole("link", { name: "المشاريع" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "المحادثات" })).toHaveCount(0);
  await expect(nav.getByText("المحادثات")).toBeVisible();
});

test("dark mode stays after a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInAs(page, /أحمد كريم/);
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "الوضع الليلي" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("English turns the page left-to-right, and back", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

  // The menu stays open after a switch, so the person can switch back at once.
  await page.getByRole("menuitem", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("the page never scrolls sideways (phone and computer)", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await expect(page.getByRole("region", { name: "عمود جديدة" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a fresh page load prints no warnings or errors in the console", async ({ page }) => {
  // React Router warned "No HydrateFallback element provided" on every first load (pages load lazily).
  const problems: string[] = [];
  page.on("console", (m) => {
    // The browser asks for /favicon.ico by itself; the site has no icon yet (the logo is not decided).
    if (m.location().url.endsWith("/favicon.ico")) return;
    if (m.type() === "warning" || m.type() === "error") problems.push(`${m.text()} (${m.location().url})`);
  });
  await signInAs(page, /أحمد كريم/); // a first load of /login
  await page.goto("/projects/1"); // a first load of a signed-in page
  await expect(page.getByRole("region", { name: "عمود جديدة" })).toBeVisible();
  expect(problems).toEqual([]);
});
