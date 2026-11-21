import { expect, test } from "@playwright/test";

test("each time the app opens, a welcome greets the person by name, never blocks a click, and is gone after a moment", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /هدى ناصر/ }).click();
  const splash = page.locator(".welcome");
  await expect(splash).toContainText("هدى");
  // Clicks pass through it: the menu works while it shows.
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "المحادثات" }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(splash).toHaveCount(0, { timeout: 5000 });
  // Not again in the same tab.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(splash).toHaveCount(0);
});

test("after signing out and in again, the welcome shows again", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /هدى ناصر/ }).click();
  await expect(page.locator(".welcome")).toHaveCount(1);
  await expect(page.locator(".welcome")).toHaveCount(0, { timeout: 5000 });
  // Sign out with the account menu, then sign in again in the same tab.
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await page.getByRole("button", { name: /مريم العبيدي/ }).click();
  await expect(page.locator(".welcome")).toContainText("مريم");
});

test("with reduce motion there is no welcome splash", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByRole("button", { name: /هدى ناصر/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
  await expect(page.locator(".welcome")).toHaveCount(0);
});
