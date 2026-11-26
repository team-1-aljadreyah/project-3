import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

// The demo's invented birthdays (src/mock/seed.ts): Sara Ali's is today, Mustafa Jawad's is in exactly a week.
const saraBirthYear = String(new Date().getFullYear() - 28);
const arDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { day: "numeric", month: "long" }).format(d);
};

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}

test("the admin sets a birth date: wrong ones are refused, a good one is kept, an empty one is marked", async ({ page }) => {
  await signInAs(page, /حسن رعد/);
  await page.goto("/admin");
  const users = page.getByRole("list", { name: "المستخدمون" });
  await users.getByRole("button", { name: /علي حسين/ }).click();
  let dialog = page.getByRole("dialog", { name: /تعديل علي حسين/ });
  const field = dialog.getByLabel("تاريخ الميلاد");
  // Too young (the server checks it again, whatever the date picker allows).
  await field.fill("2020-05-01");
  await dialog.getByRole("button", { name: "احفظ" }).click();
  await expect(dialog.getByText("العمر أقل من 16 سنة: راجع السنة.")).toBeVisible();
  await field.fill("1994-03-07");
  await expect(dialog.getByText("يرى الزملاء اليوم والشهر فقط: 7 آذار")).toBeVisible();
  await dialog.getByRole("button", { name: "احفظ" }).click();
  await expect(page.getByText("حُفظ المستخدم.")).toBeVisible();
  // Kept: it is there after a reload (the list reloads in the background, so open it from a fresh page).
  await page.reload();
  await users.getByRole("button", { name: /علي حسين/ }).click();
  dialog = page.getByRole("dialog", { name: /تعديل علي حسين/ });
  await expect(dialog.getByLabel("تاريخ الميلاد")).toHaveValue("1994-03-07");
  // Cleared: allowed (it is optional), and the list marks the account.
  await dialog.getByLabel("تاريخ الميلاد").fill("");
  await expect(dialog.getByText("يُستحسن ملؤه: تعتمد عليه تذكيرات أعياد الميلاد.")).toBeVisible();
  await dialog.getByRole("button", { name: "احفظ" }).click();
  await expect(users.getByRole("button", { name: /علي حسين/ }).getByText("بلا تاريخ ميلاد")).toBeVisible();
  await page.getByRole("button", { name: "بلا تاريخ ميلاد: 1" }).click();
  await expect(users.getByRole("listitem")).toHaveCount(1);
});

test("the monitoring officer hears of today's birthday and next week's, and sees them on her dashboard", async ({ page }) => {
  await signInAs(page, /هدى ناصر/);
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  const panel = page.getByRole("dialog", { name: "آخر الإشعارات" });
  await expect(panel.getByRole("link", { name: /عيد ميلاد مصطفى جواد بعد أسبوع/ })).toContainText(arDay(7));
  await panel.getByRole("link", { name: /اليوم عيد ميلاد سارة علي/ }).click();
  // She may open anyone's performance page: the reminder opens Sara's.
  await expect(page).toHaveURL(/\/performance\/5$/);

  await page.goto("/dashboard");
  const card = page.getByRole("region", { name: "أعياد الميلاد القادمة" });
  const rows = card.getByRole("listitem");
  await expect(rows.first()).toContainText("سارة علي");
  await expect(rows.first()).toContainText("اليوم");
  await expect(rows.filter({ hasText: "مصطفى جواد" })).toContainText("بعد أسبوع");
  await expect(rows.filter({ hasText: "مصطفى جواد" })).toContainText(arDay(7));
  // Day and month only, never the year.
  await expect(card).not.toContainText(saraBirthYear);
  // A reload makes no second reminder.
  await page.reload();
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  await expect(page.getByRole("dialog", { name: "آخر الإشعارات" }).getByRole("link", { name: /اليوم عيد ميلاد سارة علي/ })).toHaveCount(1);
});

test("colleagues see only the day and month; Sara sees her own full date; employees get no reminders", async ({ page }) => {
  test.setTimeout(60_000);
  // The team leader opens Sara's performance page: her birthday, without the year.
  await signInAs(page, /مصطفى جواد/);
  await page.goto("/performance/5");
  await expect(page.getByText(`عيد الميلاد ${arDay(0)}`)).toBeVisible();
  await expect(page.locator("main")).not.toContainText(saraBirthYear);
  await signOut(page);

  // Another employee (Ali has no one-tap button: the form): no birthday reminders in the bell.
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("ali@demo.test");
  await page.getByLabel("كلمة المرور").fill("123456");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  const panel = page.getByRole("dialog", { name: "آخر الإشعارات" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: /عيد ميلاد/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await signOut(page);

  // Sara's own profile shows her full birth date.
  await signInAs(page, /سارة علي/);
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "ملفي الشخصي" }).click();
  await expect(page.getByRole("dialog", { name: "ملفي الشخصي" })).toContainText(saraBirthYear);
});
