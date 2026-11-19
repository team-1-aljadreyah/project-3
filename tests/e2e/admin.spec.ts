import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the admin adds a user, stops another, makes a team; the CEO reads it all in the audit log", async ({ page }) => {
  await signInAs(page, /حسن رعد/);
  await page.goto("/admin");
  await page.getByRole("button", { name: "مستخدم جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "مستخدم جديد" });
  await dialog.getByLabel("الاسم", { exact: true }).fill("ليلى سمير");
  await dialog.getByLabel("البريد الإلكتروني").fill("laila@demo.test");
  await dialog.getByLabel("المسمى الوظيفي").fill("مصممة واجهات");
  await dialog.getByLabel("الفريق").selectOption({ label: "فريق التطوير" });
  await dialog.getByRole("button", { name: "احفظ" }).click();
  await expect(page.getByText("أُضيف المستخدم.")).toBeVisible();
  const users = page.getByRole("list", { name: "المستخدمون" });
  await expect(users.getByRole("button", { name: /ليلى سمير/ })).toBeVisible();

  await users.getByRole("button", { name: /زينب فاضل/ }).click();
  await page.getByRole("dialog", { name: /تعديل زينب فاضل/ }).getByRole("button", { name: "أوقف الحساب" }).click();
  await expect(users.getByRole("button", { name: /زينب فاضل/ }).getByText("موقوف")).toBeVisible();

  await page.getByRole("tab", { name: "الفرق" }).click();
  await page.getByRole("button", { name: "فريق جديد" }).click();
  const team = page.getByRole("dialog", { name: "فريق جديد" });
  await team.getByLabel("اسم الفريق").fill("فريق التصميم");
  await team.getByRole("button", { name: "احفظ" }).click();
  await expect(page.getByRole("list", { name: "الفرق" }).getByText("فريق التصميم")).toBeVisible();

  await page.getByRole("tab", { name: "الإعدادات وصحة البيانات" }).click();
  await expect(page.getByRole("region", { name: "صحة البيانات" }).getByText("حسابات نشطة")).toBeVisible();

  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await signInAs(page, /مريم العبيدي/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "سجل العمليات" }).click();
  const log = page.getByRole("list", { name: "العمليات" });
  await expect(log.getByRole("listitem").filter({ hasText: "فريق التصميم" }).getByText(/أنشأ فريقاً/)).toBeVisible();
  await expect(log.getByRole("listitem").filter({ hasText: "زينب فاضل" }).getByText(/أوقف حساباً/)).toBeVisible();
  await expect(log.getByRole("listitem").filter({ hasText: "ليلى سمير" }).getByText(/أضاف مستخدماً/)).toBeVisible();
  await page.getByLabel("نوع العملية").selectOption({ label: "أوقف حساباً" });
  await expect(log.getByRole("listitem")).toHaveCount(1);
});

test("wrong passwords lock the account; the sign-in page says so", async ({ page }) => {
  await page.goto("/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("البريد الإلكتروني").fill("employee@demo.test");
    await page.getByLabel("كلمة المرور").fill("wrong-password");
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page.getByText("البريد أو كلمة المرور غير صحيحة.")).toBeVisible();
  }
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByText(/الحساب مقفل مؤقتاً/)).toBeVisible();
});
