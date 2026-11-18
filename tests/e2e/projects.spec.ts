import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the CEO sees every project; an employee only their own", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await expect(page.getByRole("link", { name: /PRJ-/ })).toHaveCount(3);

  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();

  await signInAs(page, /سارة علي/);
  await expect(page.getByRole("link", { name: /PRJ-/ })).toHaveCount(1);
});

test("a project's board: every status is a column, blocked tasks show why, late tasks are flagged", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  // The whole card is the link (click anywhere).
  await page.getByRole("link", { name: /منصة الحجز الإلكتروني/ }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);

  for (const name of ["جديدة", "قيد الانتظار", "قيد التنفيذ", "قيد المراجعة", "قيد الاختبار", "مكتملة", "متوقفة"]) {
    await expect(page.getByRole("region", { name: `عمود ${name}` })).toBeVisible();
  }
  await expect(page.getByText("بانتظار صلاحية الوصول إلى المستودع")).toBeVisible();
  await expect(page.getByText(/تحتاج إلى قرار/)).toBeVisible();
  await expect(page.getByText(/متأخرة يومين/)).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /إنجاز الدورة 4/ })).toBeVisible();
});

test("a project with its own status shows it as a column", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/3");
  await expect(page.getByRole("region", { name: "عمود بانتظار موافقة الإدارة" })).toBeVisible();
  await expect(page.getByRole("region", { name: "عمود قيد الاختبار" })).toHaveCount(0);
});

test("a project you are not in answers 'not found' with a way back", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/projects/2");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("لم يُعثر على المشروع.");
  await expect(page.getByRole("link", { name: "رجوع" })).toBeVisible();
});
