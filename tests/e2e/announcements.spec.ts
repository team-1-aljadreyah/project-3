import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}

test("the CEO posts; Sara is notified and opens it; the CEO then sees her under 'seen'", async ({ page }) => {
  // Three sign-ins in one test: more time than the usual 30 s.
  test.setTimeout(60_000);
  await signInAs(page, /مريم العبيدي/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الإعلانات" }).click();
  await page.getByRole("button", { name: "إعلان جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "إعلان جديد" });
  await dialog.getByLabel("العنوان").fill("تدريب على المنصة الجديدة");
  await dialog.getByLabel("النص").fill("تدريب لكل الفرق يوم الإثنين في قاعة الاجتماعات.");
  await dialog.getByRole("checkbox", { name: /إعلان مهم/ }).check();
  await dialog.getByRole("button", { name: "انشر لكل الشركة" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "تدريب على المنصة الجديدة" })).toBeVisible();
  await expect(page.getByRole("region", { name: "لم يشاهدوه بعد" }).getByText("سارة علي")).toBeVisible();
  const url = page.url();
  await signOut(page);

  await signInAs(page, /سارة علي/);
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  await page.getByRole("dialog", { name: "آخر الإشعارات" }).getByRole("link", { name: /نشر إعلاناً: تدريب على المنصة الجديدة/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "تدريب على المنصة الجديدة" })).toBeVisible();
  // An employee doesn't see who has read it.
  await expect(page.getByRole("region", { name: "شاهدوه" })).toHaveCount(0);
  await signOut(page);

  await signInAs(page, /مريم العبيدي/);
  await page.goto(url);
  await expect(page.getByRole("region", { name: "شاهدوه" }).getByText("سارة علي")).toBeVisible();
});

test("an unseen announcement is marked 'new' until it is opened; employees can't post", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/announcements");
  await expect(page.getByRole("button", { name: "إعلان جديد" })).toHaveCount(0);
  const card = page.getByRole("link", { name: /اجتماع عام يوم الخميس/ });
  await expect(card.getByText("جديد")).toBeVisible();
  await card.click();
  await expect(page.getByRole("heading", { level: 1, name: "اجتماع عام يوم الخميس" })).toBeVisible();
  await page.getByRole("link", { name: "الإعلانات" }).first().click();
  await expect(page.getByRole("link", { name: /اجتماع عام يوم الخميس/ }).getByText("جديد")).toHaveCount(0);
});

test("the monitoring officer posts an announcement too", async ({ page }) => {
  await signInAs(page, /هدى ناصر/);
  await page.goto("/announcements");
  await page.getByRole("button", { name: "إعلان جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "إعلان جديد" });
  await dialog.getByLabel("العنوان").fill("زيارة متابعة يوم الأحد");
  await dialog.getByLabel("النص").fill("سأزور الفرق يوم الأحد لمتابعة سير العمل.");
  await dialog.getByRole("button", { name: "انشر لكل الشركة" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "زيارة متابعة يوم الأحد" })).toBeVisible();
});
