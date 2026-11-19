import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

// Project 1: TSK-092 waits for TSK-109 (not done). Template "تطبيق جوال" exists (3 phases, 5 tasks).

test("a waiting task shows what it waits for; the PM makes another task wait, and it is in the history", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await expect(page.getByRole("link", { name: /TSK-092/ }).getByText("تنتظر مهمة واحدة")).toBeVisible();

  await page.getByRole("link", { name: /TSK-092/ }).click();
  const deps = page.getByRole("region", { name: "الاعتماديات" });
  await expect(deps.getByRole("link", { name: /TSK-109/ })).toBeVisible();
  await expect(deps.getByText("لا يمكن إكمال هذه المهمة قبل إنجاز ما تنتظره.")).toBeVisible();

  // TSK-109 is waited for by TSK-092, so it can't be chosen to wait for it (that would be a loop).
  await deps.getByRole("link", { name: /TSK-109/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "صفحة إعلانات الشركة" })).toBeVisible(); // TSK-109's page is open
  await page.getByRole("region", { name: "الاعتماديات" }).getByRole("button", { name: "عدّل ما تنتظره المهمة" }).click();
  const dialog = page.getByRole("dialog", { name: "ما تنتظره TSK-109" });
  await expect(dialog.getByText("TSK-092")).toHaveCount(0);
  await dialog.getByLabel("ابحث عن مهمة").fill("TSK-115");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "احفظ" }).click();
  await expect(page.getByText("حُفظت الاعتماديات.")).toBeVisible();
  await expect(page.getByRole("region", { name: "الاعتماديات" }).getByRole("link", { name: /TSK-115/ })).toBeVisible();
  await page.getByRole("tab", { name: "سجل التحديثات" }).click();
  await expect(page.getByRole("tabpanel").getByText("جعلها تنتظر TSK-115")).toBeVisible();
});

test("the PM saves a project as a template, and a new project starts from a template with its tasks", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/3/settings");
  await page.getByRole("button", { name: "احفظ كقالب" }).click();
  const save = page.getByRole("dialog", { name: "حفظ المشروع كقالب" });
  await save.getByLabel("اسم القالب").fill("حملة تسويق موسمية");
  await save.getByRole("button", { name: "احفظ القالب" }).click();
  await expect(page.getByText("حُفظ القالب «حملة تسويق موسمية».")).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "القوالب" }).click();
  await expect(page.getByRole("heading", { name: "حملة تسويق موسمية" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "تطبيق جوال" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "مشروع جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "مشروع جديد" });
  await dialog.getByLabel("ابدأ من قالب (اختياري)").selectOption({ label: "تطبيق جوال" });
  await expect(dialog.getByText(/من القالب «تطبيق جوال»: 7 حالات، 3 مراحل، 5 مهام/)).toBeVisible();
  await dialog.getByLabel("اسم المشروع").fill("تطبيق التوصيل");
  await dialog.getByLabel("تاريخ البدء").fill("2026-12-01");
  await dialog.getByLabel("التاريخ المتوقع للإنجاز").fill("2027-03-01");
  await dialog.getByRole("button", { name: "أنشئ المشروع" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /تطبيق التوصيل/ })).toBeVisible();
  // It works in sprints (from the template): its tasks wait in the backlog until a sprint exists.
  await page.getByRole("tab", { name: "قائمة الانتظار" }).click();
  await expect(page.getByRole("link", { name: /جمع المتطلبات مع العميل/ })).toBeVisible();
});

test("employees don't see templates", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await expect(page.getByRole("link", { name: "القوالب" })).toHaveCount(0);
  await page.goto("/templates");
  await expect(page.getByText("القوالب لمن ينشئ المشاريع")).toBeVisible();
});
