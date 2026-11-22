import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the monitoring officer gives a bug a developer and closes a tested one from Quick actions, without opening them", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /هدى ناصر/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "إجراءات سريعة" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "إجراءات سريعة" })).toBeVisible();

  // "No developer" first: BUG-4 is there; giving it Sara also makes it "assigned", and the row stays in view.
  const noDev = page.getByRole("list", { name: "بلا مطوّر" });
  const bug4 = noDev.getByRole("article", { name: "رسالة خطأ بالإنجليزية في واجهة عربية" });
  await bug4.getByLabel("مطوّر BUG-4").selectOption({ label: "سارة علي" });
  await expect(bug4.getByText("مُسندة")).toBeVisible();
  await bug4.getByLabel("خطورة BUG-4").selectOption({ label: "عالية" });
  await expect(page.getByText(/BUG-4: الخطورة: عالية/)).toBeVisible();

  // A bug waiting for testing: close it in one press.
  await page.getByRole("button", { name: /تنتظر الاختبار/ }).click();
  await expect(page).toHaveURL(/q=testing/);
  const bug2 = page.getByRole("list", { name: "تنتظر الاختبار" }).getByRole("article", { name: "تاريخ التسليم يظهر بتوقيت خاطئ" });
  await bug2.getByRole("button", { name: "أُصلحت: أغلقها" }).click();
  await expect(bug2.getByText("مغلقة")).toBeVisible();

  // The bugs page is unchanged, and the change is in the bug's own history.
  await bug2.getByRole("link", { name: "تاريخ التسليم يظهر بتوقيت خاطئ" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "تاريخ التسليم يظهر بتوقيت خاطئ" })).toBeVisible();
});

test("Quick actions is the monitoring officer's (and the CEO's); others don't have it in their menu", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "إجراءات سريعة" })).toHaveCount(0);
});
