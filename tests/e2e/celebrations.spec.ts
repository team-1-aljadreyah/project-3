import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { signInAs } from "./helpers";

// Every test starts with celebrations off (playwright.config.ts); these turn them on where they need them.
const turnOn = (page: Page) => page.evaluate(() => localStorage.removeItem("p3.celebrations"));

/**
 * Another person in a new tab of the same browser (the same demo data), with celebrations on. The demo keeps a session
 * per tab; a new tab would open as the last person signed in, so this one forgets it and signs in as `name`.
 */
async function freshTab(context: BrowserContext, name: RegExp) {
  const tab = await context.newPage();
  await tab.goto("/login");
  await tab.evaluate(() => {
    localStorage.removeItem("p3.session");
    localStorage.removeItem("p3.celebrations");
    sessionStorage.clear();
  });
  await signInAs(tab, name);
  return tab;
}

test("the monitor celebrates the development team; a member sees it once, with her words", async ({ page, context }) => {
  test.setTimeout(60_000);
  await signInAs(page, /هدى ناصر/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الفرق", exact: true }).click();
  await page.getByRole("button", { name: "احتفل بفريق" }).click();
  const dialog = page.getByRole("dialog", { name: "احتفل بفريق" });
  await dialog.getByRole("button", { name: "احتفل" }).click();
  await expect(dialog.getByText("اختر فريقاً.")).toBeVisible();
  await dialog.getByLabel("الفريق").selectOption({ label: "فريق التطوير" });
  await dialog.getByText("إنجاز كبير", { exact: true }).click();
  await dialog.getByLabel(/كلمة للفريق/).fill("أطلقتم النسخة الأولى قبل موعدها!");

  // The preview shows what the team will see, then back to the window.
  await dialog.getByRole("button", { name: "معاينة" }).click();
  const preview = page.getByRole("dialog", { name: "إنجاز كبير!" });
  await expect(preview.getByText("«أطلقتم النسخة الأولى قبل موعدها!»")).toBeVisible();
  await preview.getByRole("button", { name: "أغلق المعاينة" }).click();
  await dialog.getByRole("button", { name: "احتفل" }).click();
  await expect(page.getByText(/أُرسل الاحتفال إلى «فريق التطوير»/)).toBeVisible();

  // Mustafa (the team's leader) opens the platform in another tab: the celebration comes by itself.
  const lead = await freshTab(context, /مصطفى جواد/);
  const card = lead.getByRole("dialog", { name: "إنجاز كبير!" });
  await expect(card).toBeVisible();
  await expect(card.getByText("احتفال مع فريق التطوير")).toBeVisible();
  await expect(card.getByText("هدى ناصر")).toBeVisible();
  await card.getByRole("button", { name: "شكراً!" }).click();
  await expect(card).toBeHidden();

  // Seen: it doesn't come back.
  await lead.reload();
  await expect(lead.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
  await lead.waitForTimeout(3500);
  await expect(lead.getByRole("dialog", { name: "إنجاز كبير!" })).toBeHidden();
});

test("on her birthday Sara gets a cake; the monitor is reminded today and a week before", async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await turnOn(page);
  await signInAs(page, /سارة علي/);
  const mine = page.getByRole("dialog", { name: "عيد ميلاد سعيد يا سارة!" });
  await expect(mine).toBeVisible();
  await mine.getByRole("button", { name: "شكراً!" }).click();
  await expect(mine).toBeHidden();

  const huda = await freshTab(context, /هدى ناصر/);
  const today = huda.getByRole("dialog", { name: "اليوم عيد ميلاد سارة علي" });
  await expect(today).toBeVisible();
  await today.getByRole("button", { name: "حسناً" }).click();
  const soon = huda.getByRole("dialog", { name: "بعد أسبوع: عيد ميلاد مصطفى جواد" });
  await expect(soon).toBeVisible();
  await soon.getByRole("button", { name: "حسناً" }).click();
  await expect(soon).toBeHidden();
});

test("celebrations can be turned off in the account menu", async ({ page }) => {
  await page.goto("/login");
  await turnOn(page);
  await signInAs(page, /مصطفى جواد/);
  await page.getByRole("button", { name: /حسابي/ }).click();
  const group = page.getByRole("group", { name: "الاحتفالات" });
  await group.getByRole("menuitemradio", { name: "إيقاف" }).click();
  await expect(group.getByRole("menuitemradio", { name: "إيقاف" })).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => localStorage.getItem("p3.celebrations"))).toBe("off");
});
