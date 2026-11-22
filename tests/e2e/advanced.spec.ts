import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}

const saveBar = (page: Page) => page.getByRole("region", { name: "حفظ التغييرات" });

test("the CEO changes a working day: Changed, Undo, then Save, and it is in the history", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  // In the account menu, not the top bar.
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الإعدادات المتقدمة" })).toHaveCount(0);
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "الإعدادات المتقدمة" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "الإعدادات المتقدمة" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /أهلاً، مريم/ })).toBeVisible();

  await page.goto("/advanced?s=work");
  const days = page.getByRole("group", { name: "أيام العمل" });
  const thursday = days.getByRole("button", { name: "الخميس" });
  await expect(thursday).toHaveAttribute("aria-pressed", "true");
  await thursday.click();
  const row = page.locator("[data-changed]").filter({ hasText: "أيام العمل" });
  await expect(row.getByText("معدَّل")).toBeVisible();
  await expect(saveBar(page)).toContainText("لديك تغييرات غير محفوظة");

  // Undo drops the draft.
  await saveBar(page).getByRole("button", { name: "تراجع" }).click();
  await expect(saveBar(page)).toHaveCount(0);
  await expect(thursday).toHaveAttribute("aria-pressed", "true");

  // Change it again and save.
  await thursday.click();
  await saveBar(page).getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("حُفظت الإعدادات، وتسري على الجميع الآن.")).toBeVisible();
  await expect(saveBar(page)).toHaveCount(0);
  await expect(thursday).toHaveAttribute("aria-pressed", "false");

  await page.goto("/advanced?s=history");
  // One save, by her, with one line: the working days, from → to.
  const saves = page.getByRole("list", { name: "سجل التغييرات" }).locator(":scope > li");
  await expect(saves).toHaveCount(1);
  await expect(saves.first()).toContainText("مريم العبيدي");
  await expect(saves.first().getByRole("listitem")).toHaveCount(1);
  await expect(saves.first().getByRole("listitem")).toContainText("أيام العمل");
});

test("a field in red blocks the save until it is fixed", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/advanced?s=names");
  const box = page.getByLabel("بادئة رموز المشاريع");
  await box.fill("TSK");
  await expect(page.getByText("مستعملة لنوع آخر")).toBeVisible();
  await expect(saveBar(page).getByRole("button", { name: "حفظ" })).toBeDisabled();
  await box.fill("PRO");
  await expect(saveBar(page).getByRole("button", { name: "حفظ" })).toBeEnabled();
});

test("a feature switched off leaves an employee's menu, not the CEO's", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/advanced?s=features");
  await page.getByRole("switch", { name: "المحادثات" }).click();
  await expect(page.getByRole("switch", { name: "المحادثات" })).toHaveAttribute("aria-checked", "false");
  await saveBar(page).getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("حُفظت الإعدادات، وتسري على الجميع الآن.")).toBeVisible();
  const menu = page.getByRole("navigation", { name: "القائمة الرئيسية" });
  await expect(menu.getByRole("link", { name: "المحادثات" })).toHaveCount(1);

  await signOut(page);
  await signInAs(page, /سارة علي/);
  await expect(menu.getByRole("link", { name: "المشاريع" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "المحادثات" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "الأخطاء البرمجية" })).toHaveCount(1);
});

test("the banner shows on top of the pages for the chosen job only", async ({ page }) => {
  // Three sign-ins in one test: more time than the usual 30 s, like the other tests that sign in more than once.
  test.setTimeout(60_000);
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/advanced?s=announce");
  await page.getByRole("switch", { name: "الإعلان" }).click();
  await page.getByLabel("نص الإعلان", { exact: true }).fill("اجتماع عام يوم الأحد الساعة العاشرة");
  await page.getByRole("group", { name: "لمن يظهر الإعلان" }).getByRole("button", { name: "موظف", exact: true }).click();
  await saveBar(page).getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("حُفظت الإعدادات، وتسري على الجميع الآن.")).toBeVisible();

  await signOut(page);
  await signInAs(page, /سارة علي/);
  await expect(page.getByRole("status").filter({ hasText: "اجتماع عام يوم الأحد الساعة العاشرة" })).toBeVisible();

  await signOut(page);
  await signInAs(page, /أحمد كريم/);
  await expect(page.getByText("اجتماع عام يوم الأحد الساعة العاشرة")).toHaveCount(0);
});

test("the advanced settings are the CEO's only", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الإعدادات المتقدمة" })).toHaveCount(0);
  await page.goto("/advanced");
  await expect(page.getByText("الإعدادات المتقدمة للمدير التنفيذي وحده")).toBeVisible();
});
