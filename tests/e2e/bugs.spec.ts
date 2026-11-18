import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}
const status = (page: Page, name: string) => page.getByText(name, { exact: true }).first();

/** Zainab has no one-tap button (the login page shows one account per job), so she signs in with the form. */
async function signInAsZainab(page: Page) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("zainab@demo.test");
  await page.getByLabel("كلمة المرور").fill("123456");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
}

test("the whole flow: Zainab reports, the PM assigns Sara, Sara fixes, Zainab sends it back", async ({ page }) => {
  test.slow(); // four people sign in one after another
  await signInAsZainab(page);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الأخطاء البرمجية" }).click();
  await page.getByRole("button", { name: "سجّل مشكلة" }).click();
  const dialog = page.getByRole("dialog", { name: "تسجيل مشكلة برمجية" });
  await dialog.getByLabel("العنوان").fill("الصورة لا تظهر في الإعلان");
  await dialog.getByLabel("درجة الخطورة").selectOption({ label: "عالية" });
  await dialog.getByRole("button", { name: "سجّل المشكلة" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "الصورة لا تظهر في الإعلان" })).toBeVisible();
  await expect(status(page, "مُسجّلة")).toBeVisible();
  const url = page.url();
  await signOut(page);

  await signInAs(page, /أحمد كريم/);
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  await page.getByRole("dialog", { name: "آخر الإشعارات" }).getByRole("link", { name: /زينب فاضل سجّل مشكلة/ }).click();
  await page.getByRole("button", { name: "تعديل" }).click();
  const edit = page.getByRole("dialog", { name: /تعديل BUG-/ });
  await edit.getByLabel("المطور المسؤول").selectOption({ label: "سارة علي" });
  await edit.getByRole("button", { name: "احفظ" }).click();
  await expect(status(page, "مُسندة")).toBeVisible();
  await signOut(page);

  await signInAs(page, /سارة علي/);
  await page.goto(url);
  await page.getByRole("button", { name: "ابدأ الإصلاح" }).click();
  await expect(status(page, "قيد الإصلاح")).toBeVisible();
  await page.getByRole("button", { name: "أصلحتُها: إلى الاختبار" }).click();
  await expect(status(page, "قيد الاختبار")).toBeVisible();
  await signOut(page);

  await signInAsZainab(page);
  await page.goto(url);
  await page.getByRole("button", { name: "لم تُحل: أعدها للمطور" }).click();
  const back = page.getByRole("dialog", { name: /إعادة BUG-/ });
  await back.getByRole("button", { name: "أعدها للمطور" }).click();
  await expect(back.getByText("اكتب لماذا لم تُحل المشكلة.")).toBeVisible();
  await back.getByLabel("ما الذي لم يُحل؟").fill("الصورة ما زالت لا تظهر على الهاتف");
  await back.getByRole("button", { name: "أعدها للمطور" }).click();
  await expect(status(page, "أُعيدت للمطور")).toBeVisible();
  await expect(page.getByText("الصورة ما زالت لا تظهر على الهاتف")).toBeVisible();
});

test("the reports: late bugs, counts by project, and a severity filter", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/bugs");
  await page.getByRole("button", { name: /المتأخرة/ }).click();
  await expect(page.getByRole("link", { name: /BUG-1/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /BUG-2/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "حسب المشروع" }).getByText("منصة الحجز الإلكتروني")).toBeVisible();

  await page.getByRole("button", { name: /^الكل/ }).click();
  await page.getByLabel("درجة الخطورة").selectOption({ label: "حرجة" });
  await expect(page.getByRole("link", { name: /BUG-1/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /BUG-6/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /BUG-3/ })).toHaveCount(0);
});
