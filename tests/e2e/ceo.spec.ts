import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

// The CEO rule: the CEO may see and do everything any other job can (shared/lib/access.ts).
test("the CEO's menu has every page, the system admin's included, and its pages open", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  const nav = page.getByRole("navigation", { name: "القائمة الرئيسية" });
  for (const item of ["لوحة القيادة", "مهامي", "المشاريع", "المحادثات", "إدارة النظام", "سجل العمليات"]) {
    await expect(nav.getByRole("link", { name: item })).toBeVisible();
  }
  await nav.getByRole("link", { name: "إدارة النظام" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "إدارة النظام" })).toBeVisible();
  await expect(page.getByText("هذه الصفحة لمسؤول النظام")).toHaveCount(0);
});

test("the CEO is in every project chat and team chat", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/chat");
  // Both chats are in her list though she is in neither the project nor the team.
  await expect(page.getByRole("link", { name: /فريق التطوير/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /منصة الحجز الإلكتروني/ }).first()).toBeVisible();
});
