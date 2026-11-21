import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the monitoring officer writes feedback on someone and sends it to the CEO; the CEO opens it, answers, and she sees the answer", async ({ page }) => {
  // Three sign-ins in one test: more time than the usual 30 s.
  test.setTimeout(60_000);
  await signInAs(page, /هدى ناصر/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "المتابعة" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "المتابعة" })).toBeVisible();
  await page.getByRole("button", { name: "ملاحظة على أي شخص" }).click();
  await page.getByLabel("على من").selectOption({ label: "علي حسين" });
  await page.getByLabel("العنوان").fill("تعاون ممتاز مع الفريق");
  await page.getByLabel("النص").fill("ساعد زملاءه في إصلاح مشكلة الدفع قبل موعدها.");
  await page.getByRole("button", { name: "احفظ وأرسل" }).click();
  const mine = page.getByRole("list", { name: "ما كتبته" });
  await expect(mine.getByRole("article").filter({ hasText: "تعاون ممتاز مع الفريق" }).getByText("أُرسلت، لم تُفتح بعد")).toBeVisible();

  // The CEO.
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await page.getByRole("button", { name: /مريم العبيدي/ }).click();
  // Signed in: the menu is there (signing in goes back to the page you were on).
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" })).toBeVisible();
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الوارد من المتابعة" }).click();
  const inbox = page.getByRole("list", { name: "الوارد" });
  await inbox.getByRole("button", { name: "تعاون ممتاز مع الفريق" }).click();
  await page.getByLabel("ردك").fill("شكراً، سأشكره بنفسي.");
  await page.getByRole("button", { name: "أرسل الرد" }).click();
  await expect(inbox.getByText("شكراً، سأشكره بنفسي.")).toBeVisible();

  // Back to her: the answer is on her note.
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await page.getByRole("button", { name: /هدى ناصر/ }).click();
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" })).toBeVisible();
  await page.goto("/monitoring");
  await expect(page.getByRole("list", { name: "ما كتبته" }).getByText("شكراً، سأشكره بنفسي.")).toBeVisible();
});

test("other jobs don't have the monitoring workspace or the CEO's inbox", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  const nav = page.getByRole("navigation", { name: "القائمة الرئيسية" });
  await expect(nav.getByText("المتابعة", { exact: true })).toHaveCount(0);
  await page.goto("/inbox");
  await expect(page.getByText("هذا الوارد للمدير التنفيذي")).toBeVisible();
});

test("a problem can be about anything and involve any people", async ({ page }) => {
  await signInAs(page, /هدى ناصر/);
  await page.goto("/monitoring");
  await page.getByRole("button", { name: "مشكلة تحتاج قراراً" }).click();
  await page.getByLabel("عن ماذا").fill("الموافقات على الإجازات");
  await page.getByRole("group", { name: /الأشخاص المعنيون/ }).getByRole("checkbox", { name: /سارة علي/ }).check();
  await page.getByRole("group", { name: /الأشخاص المعنيون/ }).getByRole("checkbox", { name: /علي حسين/ }).check();
  await page.getByLabel("العنوان").fill("الموافقات تتأخر");
  await page.getByLabel("النص").fill("طلبات الإجازة تنتظر أكثر من أسبوع.");
  await page.getByRole("button", { name: "احفظ وأرسل" }).click();
  const card = page.getByRole("list", { name: "ما كتبته" }).getByRole("article").filter({ hasText: "الموافقات تتأخر" });
  await expect(card.getByText("الموافقات على الإجازات")).toBeVisible();
  await expect(card.getByText(/سارة علي، علي حسين/)).toBeVisible();
});
