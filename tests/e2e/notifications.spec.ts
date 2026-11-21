import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}

test("a task given to Sara reaches her bell; a click opens the task and it is read", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await page.getByRole("button", { name: "مهمة جديدة" }).click();
  const dialog = page.getByRole("dialog", { name: "مهمة جديدة" });
  await dialog.getByLabel("العنوان").fill("مراجعة نصوص صفحة الدخول");
  await dialog.getByLabel("المسؤول عنها").selectOption({ label: "سارة علي" });
  await dialog.getByRole("button", { name: "أضف المهمة" }).click();
  await expect(dialog).toBeHidden();
  await signOut(page);

  await signInAs(page, /سارة علي/);
  const bell = page.getByRole("button", { name: /الإشعارات: \d+ غير مقروءة/ });
  await expect(bell).toBeVisible();
  const before = Number((await bell.getAttribute("aria-label"))!.match(/\d+/)![0]);
  await bell.click();
  await page.getByRole("dialog", { name: "آخر الإشعارات" }).getByRole("link", { name: /أسند إليك.*مراجعة نصوص صفحة الدخول/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "مراجعة نصوص صفحة الدخول" })).toBeVisible();
  await expect(page.getByRole("button", { name: before > 1 ? new RegExp(`الإشعارات: ${before - 1} غير مقروءة`) : "الإشعارات" })).toBeVisible();
});

test("My tasks lists Sara's tasks, the late ones first, and each row opens its task", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "مهامي" }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
  const late = page.getByRole("region", { name: /متأخرة/ });
  await expect(late.getByRole("link", { name: /TSK-109/ })).toBeVisible();
  // The first task group on the page is the late one (the summary above it has its own headings).
  await expect(page.locator("h2[id^=group-]").first()).toHaveText(/متأخرة/);
  await late.getByRole("link", { name: /TSK-109/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "صفحة إعلانات الشركة" })).toBeVisible();
});

test("a required notification is locked; an optional one can be turned off", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/notifications");
  await expect(page.getByRole("checkbox", { name: /إسناد مهمة إليك/ })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: /إسناد مهمة إليك/ })).toBeChecked();
  await page.getByRole("checkbox", { name: /تعليق جديد/ }).uncheck();
  await page.getByRole("button", { name: "احفظ التفضيلات" }).click();
  await expect(page.getByText("حُفظت التفضيلات.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /تعليق جديد/ })).not.toBeChecked();
});

test("the notifications panel stays inside the screen (phone and computer)", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  const box = (await page.getByRole("dialog", { name: "آخر الإشعارات" }).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
