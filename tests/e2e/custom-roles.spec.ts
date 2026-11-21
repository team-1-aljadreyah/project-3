import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}

test("the CEO makes a role, the admin gives it to an account, and that person works by it", async ({ page }) => {
  test.slow(); // three sign-ins
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/advanced?s=roles");
  await expect(page.getByRole("heading", { name: "الوظائف والأدوار" })).toBeVisible();
  await page.getByRole("button", { name: "دور جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "دور جديد" });
  await dialog.getByLabel("الاسم بالعربية").fill("منسق مشاريع");
  await dialog.getByLabel("الاسم بالإنجليزية").fill("Project coordinator");
  await expect(dialog.getByLabel("يبدأ مثل")).toHaveValue("employee");
  await dialog.getByRole("checkbox", { name: "تسجيل مشكلة برمجية" }).uncheck();
  await dialog.getByRole("checkbox", { name: "الأداء", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "أضف الدور" }).click();
  await expect(page.getByRole("list", { name: "الأدوار التي أنشأتها" }).getByText("منسق مشاريع")).toBeVisible();
  await page.getByRole("region", { name: "حفظ التغييرات" }).getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("حُفظت الإعدادات، وتسري على الجميع الآن.")).toBeVisible();

  // The admin gives it to Sara.
  await signOut(page);
  await signInAs(page, /حسن رعد/);
  await page.goto("/admin");
  const users = page.getByRole("list", { name: "المستخدمون" });
  await users.getByRole("button", { name: /سارة علي/ }).click();
  const edit = page.getByRole("dialog", { name: /تعديل سارة علي/ });
  await edit.getByLabel("الدور").selectOption({ label: "منسق مشاريع (مثل موظف)" });
  await edit.getByRole("button", { name: "احفظ" }).click();
  await expect(page.getByText("حُفظ المستخدم.")).toBeVisible();
  await expect(users.getByRole("button", { name: /سارة علي/ })).toContainText("منسق مشاريع");

  // Sara sees her role's name, no performance page in the menu, and no "report a bug" button.
  await signOut(page);
  await signInAs(page, /سارة علي/);
  const menu = page.getByRole("navigation", { name: "القائمة الرئيسية" });
  await expect(menu.getByRole("link", { name: "الأداء" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "الأخطاء البرمجية" })).toHaveCount(1);
  await page.getByRole("button", { name: /حسابي/ }).click();
  await expect(page.getByRole("menu").getByText("منسق مشاريع")).toBeVisible();
  await page.keyboard.press("Escape");
  await menu.getByRole("link", { name: "الأخطاء البرمجية" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "الأخطاء البرمجية" })).toBeVisible();
  await expect(page.getByRole("button", { name: "سجّل مشكلة" })).toHaveCount(0);
});

test("a role given to someone can't be deleted until they are moved", async ({ page }) => {
  test.slow();
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/advanced?s=roles");
  await page.getByRole("button", { name: "دور جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "دور جديد" });
  await dialog.getByLabel("الاسم بالعربية").fill("مراجع جودة");
  await dialog.getByLabel("الاسم بالإنجليزية").fill("Quality reviewer");
  await dialog.getByRole("button", { name: "أضف الدور" }).click();
  await page.getByRole("region", { name: "حفظ التغييرات" }).getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("حُفظت الإعدادات، وتسري على الجميع الآن.")).toBeVisible();

  // The CEO may give roles in the administration too (the CEO rule).
  await page.goto("/admin");
  await page.getByRole("list", { name: "المستخدمون" }).getByRole("button", { name: /زينب فاضل/ }).click();
  await page.getByRole("dialog", { name: /تعديل زينب فاضل/ }).getByLabel("الدور").selectOption({ label: "مراجع جودة (مثل موظف)" });
  await page.getByRole("dialog", { name: /تعديل زينب فاضل/ }).getByRole("button", { name: "احفظ" }).click();
  await expect(page.getByText("حُفظ المستخدم.")).toBeVisible();

  await page.goto("/advanced?s=roles");
  await page.getByRole("button", { name: "احذف مراجع جودة" }).click();
  const remove = page.getByRole("dialog", { name: /حذف الدور/ });
  await expect(remove.getByRole("alert")).toContainText("1 من الحسابات النشطة");
  await expect(remove.getByRole("button", { name: "احذف الدور" })).toBeDisabled();
  await remove.getByRole("button", { name: "انقل 1" }).click();
  await expect(remove.getByRole("button", { name: "احذف الدور" })).toBeEnabled();
  await remove.getByRole("button", { name: "احذف الدور" }).click();
  await page.getByRole("region", { name: "حفظ التغييرات" }).getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("حُفظت الإعدادات، وتسري على الجميع الآن.")).toBeVisible();
  await expect(page.getByText("لم تنشئ أدواراً بعد")).toBeVisible();
});
