import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

// "Press on anything and it takes you somewhere": numbers, rows and names open their pages, and a page opened from a
// link is already on the right tab or filter (kept in the address).

test("the CEO's dashboard: a number opens the bugs already filtered, a team opens its people, a person their work", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/dashboard");
  // With late bugs it opens the late ones, else the open ones (the demo data has late bugs).
  await page.getByRole("link", { name: "أخطاء مفتوحة" }).click();
  await expect(page).toHaveURL(/\/bugs(\?show=late)?$/);
  const filter = page.url().includes("show=late") ? /^المتأخرة/ : /^المفتوحة/;
  await expect(page.getByRole("button", { name: filter })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "فريق التطوير" }).click();
  await expect(page).toHaveURL(/\/reports\?tab=people&team=1/);
  await expect(page.getByRole("tab", { name: "حسب الفريق والموظف" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("اختر الفريق")).toHaveValue("1");
  // The whole row opens the person.
  await page.getByRole("row", { name: /سارة علي/ }).getByRole("link", { name: "سارة علي" }).click();
  await expect(page).toHaveURL(/\/performance\/5/);
});

test("on the bugs page a number box filters the list, and the admin's cards switch tabs on the same page", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/bugs");
  await page.getByRole("button", { name: "مغلقة", exact: true }).click();
  await expect(page).toHaveURL(/show=closed/);
  await expect(page.getByRole("button", { name: /^المغلقة/ })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/admin?tab=teams");
  await expect(page.getByRole("tab", { name: "الفرق" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "الحسابات", exact: true }).click();
  await expect(page.getByRole("tab", { name: "المستخدمون والأدوار" })).toHaveAttribute("aria-selected", "true");
});

test("an employee opens their own performance from the account menu, but other people's names stay plain text", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "أدائي" }).click();
  await expect(page).toHaveURL(/\/performance\/5/);
  // A task of hers: the PM who created it is not a link for her.
  await page.goto("/my-tasks");
  await page.getByRole("link", { name: /TSK-118/ }).first().click();
  await expect(page.getByRole("link", { name: "أحمد كريم" })).toHaveCount(0);
});

test("quick search: Ctrl+K, type a task code, Enter opens the task", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.keyboard.press("Control+K");
  const box = page.getByRole("combobox", { name: /ابحث عن صفحة/ });
  await box.fill("TSK-118");
  await expect(page.getByRole("option", { name: /تصميم شاشة تسجيل الدخول/ })).toBeVisible();
  await box.press("Enter");
  await expect(page).toHaveURL(/\/tasks\/\d+/);
  await expect(page.getByRole("heading", { level: 1, name: "تصميم شاشة تسجيل الدخول" })).toBeVisible();
});
