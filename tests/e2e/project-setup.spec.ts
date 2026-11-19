import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

const column = (page: Page, name: string) => page.getByRole("region", { name: `عمود ${name}` });
const card = (page: Page, code: string) => page.getByRole("link", { name: new RegExp(code) });

test("a PM creates a project, and its board opens with the seven base statuses", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.getByRole("button", { name: "مشروع جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "مشروع جديد" });
  await dialog.getByRole("button", { name: "أنشئ المشروع" }).click();
  await expect(dialog.getByText("اكتب اسم المشروع.")).toBeVisible();

  await dialog.getByLabel("اسم المشروع").fill("تطبيق الحضور");
  await dialog.getByLabel("تاريخ البدء").fill("2026-12-01");
  await dialog.getByLabel("التاريخ المتوقع للإنجاز").fill("2027-02-01");
  // The whole row is the checkbox's label (click anywhere).
  await dialog.getByRole("checkbox", { name: /سارة علي/ }).check();
  await dialog.getByRole("button", { name: "أنشئ المشروع" }).click();

  await expect(page).toHaveURL(/\/projects\/4$/);
  await expect(page.getByRole("heading", { level: 1, name: /تطبيق الحضور/ })).toBeVisible();
  for (const name of ["جديدة", "قيد الانتظار", "قيد التنفيذ", "قيد المراجعة", "قيد الاختبار", "مكتملة", "متوقفة"]) {
    await expect(column(page, name)).toBeVisible();
  }
});

test("the PM adds a project status; it becomes a board column and is in the project's history", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await page.getByRole("link", { name: "الإعدادات" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "إعدادات المشروع" })).toBeVisible();

  await page.getByRole("tab", { name: "الحالات" }).click();
  await page.getByRole("button", { name: "أضف حالة" }).click();
  await page.getByRole("textbox", { name: "اسم الحالة" }).fill("بانتظار العميل");
  await page.getByRole("button", { name: "احفظ الحالات" }).click();
  await expect(page.getByText("حُفظت الحالات.")).toBeVisible();

  await page.getByRole("tab", { name: "سجل المشروع" }).click();
  await expect(page.getByRole("tabpanel").getByText(/عدّل حالات المهام/)).toBeVisible();

  await page.getByRole("link", { name: "منصة الحجز الإلكتروني" }).click();
  await expect(column(page, "بانتظار العميل")).toBeVisible();
});

test("someone with open tasks can't be removed from the project; the message says why", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1/settings");
  await page.getByRole("tab", { name: "الأعضاء" }).click();
  await page.getByRole("checkbox", { name: /سارة علي/ }).uncheck();
  await page.getByRole("button", { name: "احفظ الأعضاء" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /لدى سارة علي مهام مفتوحة/ })).toBeVisible();
});

test("the board shows one phase at a time", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  // Project 1 works in sprints: the phase filter is on the "all tasks" board.
  await page.getByRole("tab", { name: "كل المهام" }).click();
  await expect(card(page, "TSK-118")).toBeVisible();
  await page.getByLabel("عرض مرحلة").selectOption({ label: "الإطلاق" });
  await expect(card(page, "TSK-092")).toBeVisible();
  await expect(card(page, "TSK-118")).toHaveCount(0);
});

test("an employee can't create projects or open a project's settings", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await expect(page.getByRole("button", { name: "مشروع جديد" })).toHaveCount(0);
  await page.goto("/projects/1");
  await expect(column(page, "جديدة")).toBeVisible();
  await expect(page.getByRole("link", { name: "الإعدادات" })).toHaveCount(0);
  await page.goto("/projects/1/settings");
  await expect(page.getByText("إعدادات المشروع لمدير المشروع والمدير التنفيذي فقط.")).toBeVisible();
});
