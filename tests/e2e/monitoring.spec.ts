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
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الوارد", exact: true }).click();
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

test("an employee sends the CEO a request instead of a message; the CEO answers it", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /سارة علي/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "طلباتي" }).click();
  await page.getByRole("button", { name: "طلب جديد" }).click();
  await page.getByLabel("عن ماذا").fill("جهاز العمل");
  await page.getByLabel("العنوان").fill("حاسوب أسرع");
  await page.getByLabel("الطلب").fill("حاسوبي بطيء في تشغيل الاختبارات.");
  await page.getByRole("button", { name: "أرسل إلى المدير التنفيذي" }).click();
  await expect(page.getByRole("list", { name: "طلباتي" }).getByText("حاسوب أسرع")).toBeVisible();
  // The CEO is not in her list for a new private chat.
  await page.goto("/chat");
  await page.getByRole("button", { name: /محادثة خاصة جديدة/ }).click();
  await expect(page.getByRole("dialog").getByText("مريم العبيدي")).toHaveCount(0);
});

test("the monitoring officer builds a report from the numbers, adds her comments and sends it to the CEO", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /هدى ناصر/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "المتابعة" }).click();
  await page.getByRole("link", { name: /تقرير بالأرقام/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "صانع التقارير" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "فريق" })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("الفريق").selectOption({ label: "فريق التطوير" });
  await page.getByRole("button", { name: "احسب الأرقام" }).click();
  const report = page.getByRole("article", { name: "التقرير" });
  // One row per member, each a link to the person's performance.
  await expect(report.getByRole("link", { name: "سارة علي" })).toHaveAttribute("href", /\/performance\/5/);
  await expect(page.getByLabel("نص التقرير")).toHaveValue(/كان لدى فريق التطوير/);
  await page.getByLabel("ملاحظاتي وتوصياتي").fill("أقترح توزيع المهام المتأخرة على الفريق.");
  await page.getByRole("button", { name: "احفظ وأرسل إلى المدير التنفيذي" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "المتابعة" })).toBeVisible();
  const card = page.getByRole("list", { name: "ما كتبته" }).getByRole("article").filter({ hasText: "تقرير فريق التطوير" });
  await expect(card.getByText("أُرسلت، لم تُفتح بعد")).toBeVisible();
  await expect(card.getByLabel("أرقام التقرير")).toBeVisible();
  await expect(card.getByText("أقترح توزيع المهام المتأخرة على الفريق.")).toBeVisible();
});
