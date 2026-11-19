import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the CEO's dashboard: totals, projects that need a decision, teams, staff, bugs and announcements", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "لوحة القيادة" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "لوحة القيادة" })).toBeVisible();
  await expect(page.getByText("المشاريع النشطة")).toBeVisible();
  await expect(page.getByText("أخطاء مفتوحة")).toBeVisible();
  await expect(page.getByRole("region", { name: "مستوى الفرق" }).getByText("فريق التطوير")).toBeVisible();
  await expect(page.getByRole("region", { name: "ملخص الموظفين" }).getByText("سارة علي")).toBeVisible();
  await expect(page.getByRole("region", { name: "آخر الإعلانات" }).getByRole("link").first()).toBeVisible();
  // The whole row of a project that needs a decision opens its board.
  const attention = page.getByRole("region", { name: "مشاريع تحتاج إلى قرار" });
  const first = attention.getByRole("link").first();
  if ((await first.count()) > 0) {
    await first.click();
    await expect(page).toHaveURL(/\/projects\/\d+$/);
  }
});

test("the CEO's dashboard opens with the night banner: the page's name, today's numbers and the way to the reports", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/dashboard");
  const banner = page.getByRole("region", { name: /لوحة القيادة/ });
  await expect(banner.getByText("في مكان واحد.")).toBeVisible();
  await expect(banner.getByText(/مشاريع نشطة/)).toBeVisible();
  await banner.getByRole("link", { name: "كل التقارير" }).click();
  await expect(page).toHaveURL(/\/reports$/);
});

test("reports: by project, by team and person (filter), by sprint with velocity; each table downloads as CSV", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/reports");
  const projects = page.getByRole("table", { name: "تقرير المشاريع" });
  await expect(projects.getByRole("link", { name: "منصة الحجز الإلكتروني" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "نزّل الجدول (CSV)" }).click();
  expect((await download).suggestedFilename()).toBe("projects-report.csv");

  await page.getByRole("tab", { name: "حسب الفريق والموظف" }).click();
  const people = page.getByRole("table", { name: "تقرير الموظفين" });
  await expect(people.getByText("سارة علي")).toBeVisible();
  await page.getByLabel("اختر الفريق").selectOption({ label: "بلا فريق" });
  await expect(people.getByText("سارة علي")).toHaveCount(0);

  await page.getByRole("tab", { name: "حسب الدورة" }).click();
  await expect(page.getByText("السرعة")).toBeVisible();
  await expect(page.getByRole("list", { name: "الدورات: المخطط والمنجز" }).getByText("الدورة 3")).toBeVisible();
});

test("employees don't have the dashboard or the reports", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  const nav = page.getByRole("navigation", { name: "القائمة الرئيسية" });
  await expect(nav.getByText("لوحة القيادة")).toHaveCount(0);
  await expect(nav.getByText("التقارير")).toHaveCount(0);
  await page.goto("/reports");
  await expect(page.getByText("التقارير للإدارة")).toBeVisible();
});
