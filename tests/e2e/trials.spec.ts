import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the monitor makes a trial team, adds a new person, rates them with a note, decides, and sends the report to the CEO", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /هدى ناصر/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الفرق التجريبية" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "الفرق التجريبية" })).toBeVisible();
  await expect(page.getByText(/خاص بك: لا يراه أحد غيرك/)).toBeVisible();

  await page.getByRole("button", { name: "فريق تجريبي جديد" }).click();
  const make = page.getByRole("dialog", { name: "فريق تجريبي جديد" });
  await make.getByLabel("اسم الفريق").fill("فريق تطبيق الجوال");
  await make.getByLabel(/الهدف من التجربة/).fill("تجربة لمدة شهر قبل ضمّه إلى التطوير.");
  await make.getByRole("button", { name: "أنشئ الفريق" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /فريق تطبيق الجوال/ })).toBeVisible();
  await expect(page).toHaveURL(/trials\?team=\d+/);

  // A new person (not an account: a name and what they do).
  await page.getByRole("button", { name: "عضو جديد" }).first().click();
  const add = page.getByRole("dialog", { name: "عضو جديد" });
  await add.getByLabel("الاسم", { exact: true }).fill("ياسر محمود");
  await add.getByLabel("التخصص أو العمل").fill("مطوّر تطبيقات");
  await add.getByRole("button", { name: "أضف العضو" }).click();
  const people = page.getByRole("list", { name: "أعضاء الفريق" });
  await expect(people.getByText("ياسر محمود")).toBeVisible();

  // The whole row opens him: four stars and a note, then "kept".
  await people.getByRole("button", { name: /ياسر محمود/ }).click();
  const sheet = page.getByRole("dialog", { name: "ياسر محمود" });
  await sheet.getByText("بلا درجة").waitFor();
  await sheet.locator("label").filter({ has: page.getByRole("radio", { name: /^4 ·/ }) }).click();
  await expect(sheet.getByText("جيد جداً", { exact: true })).toBeVisible();
  await sheet.getByLabel(/ملاحظة/).fill("أنهى شاشة الدخول قبل موعدها.");
  await sheet.getByRole("button", { name: "احفظ", exact: true }).click();
  await expect(sheet.getByRole("heading", { name: "السجل (1)" })).toBeVisible();
  await sheet.getByText("مقبول", { exact: true }).click();
  await expect(page.getByText("القرار: مقبول")).toBeVisible();
  await sheet.getByRole("button", { name: "إغلاق" }).click();
  await expect(people.getByText("«أنهى شاشة الدخول قبل موعدها.»")).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF أو طباعة" })).toBeVisible();

  // The report to the CEO: what she will read, then sent.
  await page.getByRole("button", { name: "أرسل إلى المدير التنفيذي" }).click();
  const send = page.getByRole("dialog", { name: "أرسل التقرير إلى المدير التنفيذي" });
  await expect(send.getByText(/1\. ياسر محمود، مطوّر تطبيقات: 4 من 5/)).toBeVisible();
  await send.getByRole("button", { name: "أرسل", exact: true }).click();
  await expect(page.getByText(/أُرسل التقرير إلى المدير التنفيذي/)).toBeVisible();

  // The CEO gets the report in her inbox, but not the trial teams themselves.
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await page.getByRole("button", { name: /مريم العبيدي/ }).click();
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الفرق التجريبية" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الوارد", exact: true }).click();
  await expect(page.getByRole("list", { name: "الوارد" }).getByRole("button", { name: "تقرير الفريق التجريبي: فريق تطبيق الجوال" })).toBeVisible();
  await page.goto("/trials");
  await expect(page.getByText("هذه الصفحة لمسؤول المتابعة والتقييم")).toBeVisible();
});
