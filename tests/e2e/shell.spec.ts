import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("every menu item is a working link (pages not built yet would be greyed out, never broken)", async ({ page }) => {
  await signInAs(page, /حسن رعد/);
  const nav = page.getByRole("navigation", { name: "القائمة الرئيسية" });
  await nav.getByRole("link", { name: "إدارة النظام" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "إدارة النظام" })).toBeVisible();
  await nav.getByRole("link", { name: "سجل العمليات" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "سجل العمليات" })).toBeVisible();
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
  // With Next.js this also catches hydration warnings: the server's HTML and the browser's first drawing must agree.
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

test("each page keeps its own tab title after a full load", async ({ page }) => {
  // Next.js used to write its default title a moment after the page set its own (see src/app/layout.tsx).
  await signInAs(page, /أحمد كريم/);
  await page.goto("/bugs");
  await expect(page.getByRole("heading", { level: 1, name: "الأخطاء البرمجية" })).toBeVisible();
  await page.waitForTimeout(1000); // the late default title came after the page had drawn
  await expect(page).toHaveTitle("الأخطاء البرمجية · منصة المشاريع");
});
