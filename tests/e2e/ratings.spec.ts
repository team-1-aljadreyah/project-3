import { expect, type Page, test } from "@playwright/test";
import { signInAs } from "./helpers";

/** Signs out and signs in again as someone else (the login page's one-tap button). */
async function switchTo(page: Page, name: RegExp) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await page.getByRole("button", { name }).click();
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" })).toBeVisible();
}

/** Fills the rating window: the score, the kind of reason, the reason, and private or not. */
async function fillRating(page: Page, title: string, o: { score: string; type: string; reason: string; private?: boolean }) {
  const dialog = page.getByRole("dialog", { name: title });
  await dialog.getByRole("radio", { name: o.score }).check();
  await dialog.getByRole("radio", { name: o.type }).check();
  await dialog.getByLabel("السبب بكلماتك").fill(o.reason);
  if (o.private) await dialog.getByRole("radio", { name: /^خاص/ }).check();
  await dialog.getByRole("button", { name: "احفظ التقييم" }).click();
  await expect(dialog).toHaveCount(0);
}

test("the monitoring officer rates a team for another reason; the leader is told and reads it, but not her private one", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /هدى ناصر/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الفرق", exact: true }).click();
  await page.getByRole("list", { name: "قائمة الفرق" }).getByRole("link", { name: "فريق التطوير" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "فريق التطوير" })).toBeVisible();

  // An empty form shows every problem under its field.
  await page.getByRole("button", { name: "قيّم الفريق" }).click();
  await page.getByRole("dialog", { name: "تقييم فريق التطوير" }).getByRole("button", { name: "احفظ التقييم" }).click();
  await expect(page.getByText("اكتب سبب التقييم بكلماتك.")).toBeVisible();
  await fillRating(page, "تقييم فريق التطوير", { score: "ممتاز، 5 من 5", type: "سبب آخر", reason: "نظّم الفريق يوماً مفتوحاً لتعريف الأقسام بالمنصة." });
  await expect(page.getByText("حُفظ التقييم وأُبلغ قائد الفريق.")).toBeVisible();
  const list = page.getByRole("list", { name: "التقييمات، الأحدث أولاً" });
  const line = list.getByRole("listitem").filter({ hasText: "نظّم الفريق يوماً مفتوحاً" });
  await expect(line.getByText("سبب آخر")).toBeVisible();
  await expect(line.getByText("ممتاز")).toBeVisible();

  // A private one: only the CEO and her.
  await page.getByRole("button", { name: "قيّم الفريق" }).click();
  await fillRating(page, "تقييم فريق التطوير", { score: "مقبول، 2 من 5", type: "السلوك والانضباط", reason: "ملاحظة خاصة عن تأخر الردود هذا الأسبوع.", private: true });
  await expect(list.getByRole("listitem").filter({ hasText: "ملاحظة خاصة عن تأخر الردود" }).getByText(/خاص: المدير التنفيذي وكاتبه فقط/)).toBeVisible();

  // The team leader: the notification opens the team page with the rating; the private ones aren't there.
  await switchTo(page, /مصطفى جواد/);
  await page.goto("/notifications");
  await page.getByRole("link", { name: /هدى ناصر قيّم «فريق التطوير»: ممتاز \(5 من 5\)/ }).first().click();
  await expect(page).toHaveURL(/\/teams\/1/);
  await expect(page.getByText("نظّم الفريق يوماً مفتوحاً لتعريف الأقسام بالمنصة.")).toBeVisible();
  await expect(page.getByText("ملاحظة خاصة عن تأخر الردود هذا الأسبوع.")).toHaveCount(0);
  await expect(page.getByText(/ملاحظة للإدارة فقط/)).toHaveCount(0); // the seeded private one
  await expect(page.getByRole("button", { name: "قيّم الفريق" })).toHaveCount(0); // leaders don't rate
});

test("the monitoring officer rates Sara from the performance page; Sara reads it on her page, not the private one", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /هدى ناصر/);
  await page.goto("/performance");
  const table = page.getByRole("table", { name: "أداء الموظفين" });
  await table.getByRole("button", { name: "قيّم سارة علي" }).click();
  await fillRating(page, "تقييم سارة علي", { score: "جيد جداً، 4 من 5", type: "سبب آخر", reason: "قدّمت عرضاً واضحاً للعميل عن شاشات الحجز." });
  await expect(page.getByText("حُفظ التقييم وأُبلغ صاحبه.")).toBeVisible();
  await table.getByRole("button", { name: "قيّم سارة علي" }).click();
  await fillRating(page, "تقييم سارة علي", { score: "جيد، 3 من 5", type: "جودة العمل", reason: "للإدارة: تحتاج مراجعة أدق قبل الدمج.", private: true });
  // The Rate button didn't open her page (it sits above the row's link); her average opens her ratings.
  await expect(page).toHaveURL(/\/performance$/);
  await table.getByRole("link", { name: /متوسط التقييم .* 4 تقييم/ }).click();
  await expect(page).toHaveURL(/\/performance\/5#ratings/);
  await expect(page.getByRole("heading", { name: /تقييمات سريعة/ })).toBeVisible();

  await switchTo(page, /سارة علي/);
  await page.goto("/performance");
  const mine = page.getByRole("region", { name: /تقييمات سريعة/ });
  await expect(mine.getByText("قدّمت عرضاً واضحاً للعميل عن شاشات الحجز.")).toBeVisible();
  await expect(mine.getByText("سبب آخر").first()).toBeVisible();
  await expect(page.getByText("للإدارة: تحتاج مراجعة أدق قبل الدمج.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "تقييم سريع" })).toHaveCount(0); // she doesn't rate herself
});

test("the monitoring officer's dashboard has a quick way to rate a team, and team names open the team page", async ({ page }) => {
  await signInAs(page, /هدى ناصر/);
  await page.goto("/dashboard");
  const box = page.getByRole("region", { name: "قيّم فريقاً" });
  await box.getByRole("button", { name: "قيّم فريق التطوير" }).click();
  await expect(page.getByRole("dialog", { name: "تقييم فريق التطوير" })).toBeVisible();
  await page.getByRole("dialog", { name: "تقييم فريق التطوير" }).getByRole("button", { name: "إلغاء" }).click();
  // Every team name on the dashboard opens its page.
  await page.getByRole("region", { name: "مستوى الفرق" }).getByRole("link", { name: "فريق التطوير" }).click();
  await expect(page).toHaveURL(/\/teams\/1$/);
});
